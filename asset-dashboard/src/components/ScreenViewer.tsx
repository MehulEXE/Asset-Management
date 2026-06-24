import { useState, useEffect, useRef } from 'react';
import { X, Loader2, Clock, AlertCircle } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';

interface ScreenViewerProps {
  agentId: string;
  hostname: string;
  onClose: () => void;
}

type ConnectionStatus = 'requesting' | 'pending' | 'connected' | 'declined' | 'offline';

export function ScreenViewer({ agentId, hostname, onClose }: ScreenViewerProps) {
  const [frame, setFrame] = useState<string | null>(null);
  const [status, setStatus] = useState<ConnectionStatus>('requesting');
  const intervalRef = useRef<number | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    const poll = async () => {
      try {
        const res = await fetch(apiUrl(`/api/screen/frame/${encodeURIComponent(agentId)}`));
        if (!res.ok) {
          if (activeRef.current) setStatus('offline');
          return;
        }
        const data = await res.json();
        if (!activeRef.current) return;

        if (data.pending) {
          setStatus('pending');
          return;
        }

        if (data.active && data.frame) {
          setFrame(data.frame);
          setStatus('connected');
          return;
        }

        if (!data.active && !data.pending) {
          setStatus('declined');
          return;
        }
      } catch {
        if (activeRef.current) setStatus('offline');
      }
    };

    poll();
    intervalRef.current = window.setInterval(poll, 300);

    return () => {
      activeRef.current = false;
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [agentId]);

  const handleStop = async () => {
    try {
      await fetch(apiUrl(`/api/screen/${encodeURIComponent(agentId)}/stop`), { method: 'POST' });
    } catch {
      // silent
    }
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
          {status === 'pending' ? (
            <Clock size={48} style={{ opacity: 0.7 }} />
          ) : (
            <Loader2 size={48} className="animate-spin" />
          )}
          <div style={{ fontSize: '1.2rem' }}>
            {status === 'pending' ? 'Awaiting user consent...' : 'Requesting screen access...'}
          </div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
          {status === 'pending' && (
            <div style={{
              marginTop: 8, padding: '8px 16px', borderRadius: 8,
              background: 'rgba(255,255,255,0.1)', fontSize: '0.85rem',
            }}>
              A popup has been sent to the user's screen
            </div>
          )}
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
          <button
            onClick={onClose}
            style={{
              marginTop: 16, padding: '10px 24px', borderRadius: 8,
              background: '#ef4444', border: 'none', color: '#fff',
              cursor: 'pointer', fontSize: '0.9rem',
            }}
          >
            Close
          </button>
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

      {frame && (
        <img
          src={`data:image/jpeg;base64,${frame}`}
          alt={`Screen of ${hostname}`}
          style={{
            flex: 1, objectFit: 'contain', width: '100%',
            display: 'block',
          }}
        />
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
        {status === 'connected' ? `Watching: ${hostname}` :
         status === 'pending' ? `Awaiting consent: ${hostname}` :
         status === 'declined' ? `Declined: ${hostname}` :
         hostname}
      </div>

      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
      }}>
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
