import { useState, useEffect } from 'react';
import { Monitor, MonitorPlay, Loader2, Wifi } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';

interface AllocatedDevice {
  id: string;
  asset_id: string;
  hostname: string;
  category: string;
  status: string;
  employee_name?: string;
  employee_email?: string;
  last_seen?: string;
}

interface LiveTelemetryProps {
  onWatchScreen: (agentId: string, hostname: string) => void;
}

const ALLOWED_CATEGORIES = ['Laptop', 'Desktop'];

export function LiveTelemetry({ onWatchScreen }: LiveTelemetryProps) {
  const [devices, setDevices] = useState<AllocatedDevice[]>([]);
  const [loading, setLoading] = useState(true);
  const [watchingId, setWatchingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchDevices = async () => {
      try {
        const res = await fetch(apiUrl('/api/v1/assets'));
        if (res.ok) {
          const all: AllocatedDevice[] = await res.json();
          const filtered = all.filter(a =>
            a.status === 'Allocated' &&
            ALLOWED_CATEGORIES.includes(a.category)
          );
          setDevices(filtered);
        }
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };

    fetchDevices();
    const interval = setInterval(fetchDevices, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleWatch = (device: AllocatedDevice) => {
    setWatchingId(device.asset_id);
    onWatchScreen(device.asset_id, device.hostname);
  };

  return (
    <div className="animated-fade">
      <div className="card" style={{ marginBottom: '24px', padding: '20px 24px', backgroundColor: 'var(--bg-secondary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Monitor />
          </div>
          <div>
            <h2 style={{ fontSize: '1.25rem', color: 'var(--text-primary)' }}>Live Screen Access</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Click "Watch Screen" to view the live desktop of any allocated Laptop or Desktop.</p>
          </div>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-tertiary)' }}>
          <Loader2 size={32} className="animate-spin" style={{ margin: '0 auto 12px' }} />
          <div>Loading devices...</div>
        </div>
      ) : devices.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-tertiary)' }}>
          <Monitor size={48} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <div style={{ fontSize: '1rem', marginBottom: 4 }}>No allocated Laptops or Desktops</div>
          <div style={{ fontSize: '0.85rem' }}>Register and allocate devices to enable screen sharing.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
          {devices.map(device => (
            <div key={device.id} className="card" style={{
              borderLeft: '5px solid var(--primary)',
              display: 'flex', flexDirection: 'column', gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontFamily: 'var(--font-header)', fontWeight: 'bold' }}>{device.hostname}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{device.category}</p>
                </div>
                <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Wifi size={12} /> Allocated
                </span>
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span>Employee: <strong>{device.employee_name || 'Unassigned'}</strong></span>
                <span>Asset ID: {device.asset_id}</span>
              </div>
              <button
                className="btn btn-primary"
                style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}
                onClick={() => handleWatch(device)}
                disabled={watchingId === device.asset_id}
              >
                {watchingId === device.asset_id ? <><Loader2 size={16} className="animate-spin" /> Connecting...</> : <><MonitorPlay size={16} /> Watch Screen</>}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
