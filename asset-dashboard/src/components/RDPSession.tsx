import { useEffect, useRef, useState } from 'react';
import { X, Loader2, AlertCircle } from 'lucide-react';
import API_BASE from '../services/apiConfig';
import { useAuth } from '../contexts/AuthContext';

interface RDPSessionProps {
  agentId: string;
  hostname: string;
  onClose: () => void;
}

type RDPStatus = 'requesting' | 'pending' | 'connecting' | 'connected' | 'declined' | 'offline' | 'error';

function getWsUrl(path: string): string {
  try {
    const url = new URL(API_BASE);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}${path}`;
  } catch {
    return `ws://localhost:8000${path}`;
  }
}

export function RDPSession({ agentId, hostname, onClose }: RDPSessionProps) {
  const { token } = useAuth();
  const [status, setStatus] = useState<RDPStatus>('requesting');
  const [errorMsg, setErrorMsg] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const rfbRef = useRef<any>(null);
  const activeRef = useRef(true);
  const pollIntervalRef = useRef<number | null>(null);

  useEffect(() => {
    activeRef.current = true;
    initRDP();
    return () => {
      activeRef.current = false;
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (rfbRef.current) {
        try { rfbRef.current.disconnect(); } catch {}
        rfbRef.current = null;
      }
    };
  }, [agentId]);

  const initRDP = async () => {
    if (!token) return;
    try {
      const res = await fetch(API_BASE + `/api/v1/rdp/${encodeURIComponent(agentId)}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ hostname }),
      });
      if (!res.ok) {
        setStatus('error');
        setErrorMsg('Failed to request remote control');
        return;
      }
      setStatus('pending');
      pollForStatus();
    } catch {
      setStatus('offline');
    }
  };

  const pollForStatus = () => {
    pollIntervalRef.current = window.setInterval(async () => {
      if (!activeRef.current) return;
      try {
        const res = await fetch(API_BASE + `/api/rdp/${encodeURIComponent(agentId)}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.declined) {
          setStatus('declined');
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          return;
        }
        if (data.active && data.vnc_port) {
          if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setStatus('connecting');
          connectRFB();
          return;
        }
      } catch {
        if (activeRef.current) setStatus('offline');
      }
    }, 500);
  };

  const connectRFB = async () => {
    try {
      const RFBModule = await import('@novnc/novnc');
      const RFB = RFBModule.default;

      if (!activeRef.current || !containerRef.current) return;

      const wsUrl = getWsUrl(`/ws/vnc/browser/${encodeURIComponent(agentId)}`);
      const rfb = new RFB(containerRef.current, wsUrl, {});

      rfbRef.current = rfb;
      rfb.viewOnly = false;
      rfb.scaleViewport = true;
      rfb.focusOnClick = true;

      rfb.addEventListener('connect', () => {
        if (activeRef.current) setStatus('connected');
      });

      rfb.addEventListener('disconnect', (e: any) => {
        if (!activeRef.current) return;
        if (e.detail && e.detail.clean === false) {
          setStatus('error');
          setErrorMsg('Connection lost');
        } else {
          onClose();
        }
      });

      rfb.addEventListener('securityfailure', (e: any) => {
        setStatus('error');
        setErrorMsg(e.detail?.reason || 'Security failure');
      });
    } catch (err) {
      console.error('RFB connection error:', err);
      setStatus('error');
      setErrorMsg('Failed to establish remote control session');
    }
  };

  const handleStop = async () => {
    try {
      await fetch(API_BASE + `/api/v1/rdp/${encodeURIComponent(agentId)}/stop`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    if (rfbRef.current) {
      try { rfbRef.current.disconnect(); } catch {}
      rfbRef.current = null;
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
            {status === 'requesting' ? `Requesting remote control of ${hostname}...` : `Waiting for user to accept...`}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
        </div>
      )}

      {(status === 'connecting') && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: 16,
        }}>
          <Loader2 size={48} className="animate-spin" />
          <div style={{ fontSize: '1.2rem' }}>Establishing remote control session...</div>
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
          <div style={{ fontSize: '1.2rem' }}>Remote control declined</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
          <div style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: 8 }}>
            User declined the remote control request
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
          <div style={{ fontSize: '1.2rem' }}>Connecting...</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
          <div style={{ color: '#f59e0b', fontSize: '0.9rem', marginTop: 8 }}>
            Device may be offline
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

      <div ref={containerRef} style={{
        flex: 1, position: 'relative', display: status === 'connected' ? 'block' : 'none',
      }} />

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
        {status === 'connected' ? `Remote Control: ${hostname}` :
         status === 'pending' ? `Waiting: ${hostname}` :
         status === 'declined' ? `Declined: ${hostname}` :
         status === 'connecting' ? `Connecting: ${hostname}` :
         hostname}
      </div>

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
          title="Stop Remote Control"
        >
          <X size={28} color="#fff" />
        </button>
      </div>
    </div>
  );
}
