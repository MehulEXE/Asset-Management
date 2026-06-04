import { useState, useEffect, useRef } from 'react';
import { X, Loader2 } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';

interface ScreenViewerProps {
  agentId: string;
  hostname: string;
  onClose: () => void;
}

export function ScreenViewer({ agentId, hostname, onClose }: ScreenViewerProps) {
  const [frame, setFrame] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const activeRef = useRef(true);

  useEffect(() => {
    activeRef.current = true;

    const pollFrame = async () => {
      try {
        const res = await fetch(apiUrl(`/api/screen/frame/${encodeURIComponent(agentId)}`));
        if (!res.ok) {
          if (activeRef.current) setError(true);
          return;
        }
        const data = await res.json();
        if (!activeRef.current) return;
        if (data.frame) {
          setFrame(data.frame);
          setConnected(true);
          setError(false);
        } else if (!data.active) {
          if (activeRef.current) {
            setConnected(false);
            setError(true);
          }
        }
      } catch {
        if (activeRef.current) setError(true);
      }
    };

    pollFrame();
    intervalRef.current = window.setInterval(pollFrame, 300);

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
      {!connected && (
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          color: '#fff', gap: 16,
        }}>
          <Loader2 size={48} className="animate-spin" />
          <div style={{ fontSize: '1.2rem' }}>Connecting to the screen...</div>
          <div style={{ fontSize: '0.85rem', opacity: 0.6 }}>{hostname}</div>
          {error && (
            <div style={{ color: '#ef4444', fontSize: '0.9rem', marginTop: 8 }}>
              Device is offline or screen sharing unavailable
            </div>
          )}
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
      }}>
        Watching: {hostname}
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
          title="Stop watching"
        >
          <X size={28} color="#fff" />
        </button>
      </div>
    </div>
  );
}
