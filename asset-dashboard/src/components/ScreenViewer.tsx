import { useState, useEffect, useRef } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';
import { useAuth } from '../contexts/AuthContext';

interface ScreenViewerProps {
  agentId: string;
  hostname: string;
  onClose: () => void;
}

type ConnectionStatus = 'requesting' | 'pending' | 'signaling' | 'connecting' | 'connected' | 'declined' | 'offline' | 'error';

const STUN_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

export function ScreenViewer({ agentId, hostname, onClose }: ScreenViewerProps) {
  const { token } = useAuth();
  const [status, setStatus] = useState<ConnectionStatus>('requesting');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [frame, setFrame] = useState<string | null>(null);
  const [useWebrtc, setUseWebrtc] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const activeRef = useRef(true);
  const pollIntervalRef = useRef<number | null>(null);

  const fallbackTimerRef = useRef<number | null>(null);

  useEffect(() => {
    activeRef.current = true;
    initScreenShare();
    return () => {
      activeRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      if (pcRef.current) {
        pcRef.current.close();
        pcRef.current = null;
      }
    };
  }, [agentId]);

  const initScreenShare = async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl(`/api/screen/${encodeURIComponent(agentId)}/start`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hostname }),
      });
      if (!res.ok) {
        setStatus('error');
        setErrorMsg('Failed to request screen access');
        return;
      }
      setStatus('pending');
      pollForOffer();
    } catch {
      setStatus('offline');
    }
  };

  const pollForOffer = () => {
    pollIntervalRef.current = window.setInterval(async () => {
      if (!activeRef.current) return;
      try {
        const res = await fetch(apiUrl(`/api/v1/signal/offer/${encodeURIComponent(agentId)}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.sdp && useWebrtc) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
          pollIntervalRef.current = null;
          setStatus('signaling');
          startWebRTC(data);
        } else if (!useWebrtc) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
          pollIntervalRef.current = null;
          startHttpPolling();
        }
      } catch {
        if (activeRef.current) setStatus('offline');
      }
    }, 500);

    fallbackTimerRef.current = window.setTimeout(() => {
      if (!activeRef.current) return;
      if (useWebrtc) {
        setUseWebrtc(false);
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
        startHttpPolling();
      }
    }, 15000);
  };

  const startWebRTC = async (offer: { sdp: string; type: string }) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
      pcRef.current = pc;

      pc.ontrack = (event) => {
        if (videoRef.current && event.streams[0]) {
          videoRef.current.srcObject = event.streams[0];
          videoRef.current.play().catch(() => {});
        }
      };

      pc.onicecandidate = async (event) => {
        if (event.candidate && activeRef.current) {
          try {
            await fetch(apiUrl(`/api/v1/signal/ice-candidate/${encodeURIComponent(agentId)}`), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
              body: JSON.stringify({ candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid }),
            });
          } catch {}
        }
      };

      pc.onconnectionstatechange = () => {
        if (!activeRef.current) return;
        if (pc.connectionState === 'connected') setStatus('connected');
        else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setUseWebrtc(false);
          startHttpPolling();
        }
      };

      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
          setStatus('connected');
        }
      };

      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      await fetch(apiUrl(`/api/v1/signal/answer/${encodeURIComponent(agentId)}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sdp: answer.sdp, type: answer.type }),
      });

      setStatus('connecting');
    } catch (err) {
      console.error('WebRTC init error:', err);
      setUseWebrtc(false);
      startHttpPolling();
    }
  };

  const startHttpPolling = () => {
    if (pollIntervalRef.current) return;
    setStatus('connecting');
    pollIntervalRef.current = window.setInterval(async () => {
      if (!activeRef.current) return;
      try {
        const res = await fetch(apiUrl(`/api/screen/frame/${encodeURIComponent(agentId)}`), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) { setStatus('offline'); return; }
        const data = await res.json();
        if (data.declined) {
          setStatus('declined');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          return;
        }
        if (data.active && data.frame) {
          setFrame(data.frame);
          setStatus('connected');
          return;
        }
        if (!data.active && !data.pending) {
          setStatus('declined');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
        }
      } catch {
        if (activeRef.current) setStatus('offline');
      }
    }, 300);
  };

  const handleStop = async () => {
    try {
      await fetch(apiUrl(`/api/screen/${encodeURIComponent(agentId)}/stop`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: '#000', display: 'flex', flexDirection: 'column',
    }}>
      {(status === 'requesting' || status === 'pending') && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: 16,
        }}>
          <Loader2 size={48} className="animate-spin" />
          <div style={{ fontSize: '1.2rem' }}>
            Connecting to {hostname}...
          </div>
        </div>
      )}

      {(status === 'signaling' || status === 'connecting') && !frame && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: 16,
        }}>
          <Loader2 size={48} className="animate-spin" />
          <div style={{ fontSize: '1.2rem' }}>{status === 'signaling' ? 'Establishing secure connection...' : 'Connecting...'}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
        </div>
      )}

      {status === 'declined' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: 16,
        }}>
          <AlertCircle size={48} color="#ef4444" />
          <div style={{ fontSize: '1.2rem' }}>Screen share declined</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
          <div style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: 8 }}>
            User declined the screen share request
          </div>
          <button onClick={onClose} style={{ marginTop: 16, padding: '10px 24px', borderRadius: 8, background: '#ef4444', border: 'none', color: '#fff', cursor: 'pointer', fontSize: '0.9rem' }}>Close</button>
        </div>
      )}

      {status === 'offline' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: 16,
        }}>
          <Loader2 size={48} className="animate-spin" />
          <div style={{ fontSize: '1.2rem' }}>Connecting to the screen...</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
          <div style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: 8 }}>
            Device is offline or screen sharing unavailable
          </div>
        </div>
      )}

      {status === 'error' && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: 16,
        }}>
          <AlertCircle size={48} color="#f59e0b" />
          <div style={{ fontSize: '1.2rem' }}>{errorMsg || 'Connection error'}</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
        </div>
      )}

      {useWebrtc && status === 'connected' && (
        <video ref={videoRef} autoPlay playsInline muted style={{ flex: 1, objectFit: 'contain', width: '100%', display: 'block', background: '#111' }} />
      )}

      {!useWebrtc && frame && (
        <img src={`data:image/jpeg;base64,${frame}`} alt={`Screen of ${hostname}`} style={{ flex: 1, objectFit: 'contain', width: '100%', display: 'block' }} />
      )}

      <div style={{
        position: 'absolute', top: 12, left: 12,
        color: '#fff', fontSize: '0.85rem', opacity: 0.7,
        background: 'rgba(0,0,0,0.5)', padding: '6px 12px', borderRadius: 6,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          width: 8, height: 8, borderRadius: '50%',
          background: status === 'connected' ? '#22c55e' : status === 'pending' ? '#f59e0b' : status === 'declined' ? '#ef4444' : '#6b7280',
          display: 'inline-block',
        }} />
        {status === 'connected' ? `Watching: ${hostname}${!useWebrtc ? ' (HTTP)' : ''}` :
         status === 'pending' ? `Connecting: ${hostname}` :
         status === 'declined' ? `Declined: ${hostname}` :
         hostname}
      </div>

      {!useWebrtc && status === 'connected' && (
        <div style={{ position: 'absolute', top: 12, right: 12, padding: '4px 8px', background: 'rgba(245,158,11,0.8)', borderRadius: 4, color: '#fff', fontSize: '0.75rem' }}>
          Fallback mode
        </div>
      )}

      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)' }}>
        <button
          onClick={handleStop}
          style={{
            width: 56, height: 56, borderRadius: '50%',
            background: '#ef4444', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
            transition: 'transform 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.1)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
          title="Stop"
        >
          <X size={28} color="#fff" />
        </button>
      </div>
    </div>
  );
}
