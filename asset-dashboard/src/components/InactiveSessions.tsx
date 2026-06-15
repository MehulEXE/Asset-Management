import { useState, useMemo } from 'react';
import { Clock, Filter, ChevronDown, Activity, ToggleLeft, ToggleRight } from 'lucide-react';

interface Asset {
  id: string;
  asset_id: string;
  hostname: string;
  category: string;
  manufacturer: string;
  model: string;
  status: string;
  last_seen: string;
  employee_name?: string;
  employee_email?: string;
  logged_in_user?: string;
  last_login_time?: string;
}

interface InactiveSessionsProps {
  assets: Asset[];
  onBack: () => void;
}

type Preset = '1d' | '2d' | '1w' | '1m' | 'custom';

const presets: { label: string; value: Preset; hours: number | null }[] = [
  { label: '1 Day', value: '1d', hours: 24 },
  { label: '2 Days', value: '2d', hours: 48 },
  { label: '1 Week', value: '1w', hours: 168 },
  { label: '1 Month', value: '1m', hours: 720 },
  { label: 'Custom Range', value: 'custom', hours: null },
];

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  return `${hours}h`;
}

export const InactiveSessions: React.FC<InactiveSessionsProps> = ({ assets, onBack }) => {
  const [selectedPreset, setSelectedPreset] = useState<Preset>('2d');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showActive, setShowActive] = useState(false);

  const threshold = useMemo<{ cutoff: number } | { start: number; end: number } | null>(() => {
    if (selectedPreset === 'custom') {
      if (!customStart || !customEnd) return null;
      return { start: new Date(customStart).getTime(), end: new Date(customEnd).getTime() };
    }
    const preset = presets.find(p => p.value === selectedPreset);
    if (!preset || preset.hours === null) return null;
    return { cutoff: Date.now() - preset.hours * 3600000 };
  }, [selectedPreset, customStart, customEnd]);

  const displayAssets = useMemo(() => {
    const laptopsAndDesktops = assets.filter(a =>
      a.category === 'Laptop' || a.category === 'Desktop'
    );

    if (!threshold) return [];

    const isCutoff = 'cutoff' in threshold;
    const cutoffVal = isCutoff ? (threshold as { cutoff: number }).cutoff : 0;
    const startVal = isCutoff ? 0 : (threshold as { start: number; end: number }).start;
    const endVal = isCutoff ? 0 : (threshold as { start: number; end: number }).end;

    let filtered = laptopsAndDesktops.filter(a => {
      const lastSeen = a.last_seen ? new Date(a.last_seen).getTime() : 0;
      if (!lastSeen) return false;

      if (showActive) return true;
      if (isCutoff) return lastSeen < cutoffVal;
      return lastSeen >= startVal && lastSeen <= endVal;
    });

    filtered = filtered.filter(a => {
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return a.hostname.toLowerCase().includes(q) ||
             a.asset_id.toLowerCase().includes(q) ||
             (a.employee_name || '').toLowerCase().includes(q) ||
             (a.logged_in_user || '').toLowerCase().includes(q);
    });

    if (showActive) {
      filtered.sort((a, b) => new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime());
    } else {
      filtered.sort((a, b) => new Date(a.last_seen).getTime() - new Date(b.last_seen).getTime());
    }

    return filtered;
  }, [assets, threshold, searchTerm, showActive]);

  const activeThresholdMs = useMemo(() => {
    if (selectedPreset === 'custom') return 0;
    const preset = presets.find(p => p.value === selectedPreset);
    return preset?.hours ? preset.hours * 3600000 : 0;
  }, [selectedPreset]);

  const selectPreset = (value: Preset) => {
    setSelectedPreset(value);
    setShowDropdown(false);
  };

  return (
    <div className="animated-fade">
      <div className="card" style={{ marginBottom: '24px', padding: '16px 24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={onBack} style={{ padding: '6px 12px' }}>
              &larr; Back to Dashboard
            </button>
            <h2 style={{ fontSize: '1.2rem', margin: 0 }}>Inactive Sessions</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', position: 'relative' }}>
            <Filter size={16} style={{ color: 'var(--text-secondary)' }} />
            <div style={{ position: 'relative' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowDropdown(!showDropdown)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: '140px', justifyContent: 'space-between' }}
              >
                <span>{presets.find(p => p.value === selectedPreset)?.label}</span>
                <ChevronDown size={14} />
              </button>
              {showDropdown && (
                <div style={{
                  position: 'absolute', top: '100%', left: 0, zIndex: 1000, marginTop: '4px',
                  backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                  borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  minWidth: '180px', overflow: 'hidden',
                }}>
                  {presets.map(p => (
                    <div
                      key={p.value}
                      onClick={() => selectPreset(p.value)}
                      style={{
                        padding: '8px 14px', cursor: 'pointer', fontSize: '0.85rem',
                        backgroundColor: selectedPreset === p.value ? 'var(--bg-tertiary)' : 'transparent',
                        color: 'var(--text-primary)',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'; }}
                      onMouseLeave={e => { e.currentTarget.style.backgroundColor = selectedPreset === p.value ? 'var(--bg-tertiary)' : 'transparent'; }}
                    >
                      {p.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {selectedPreset === 'custom' && (
        <div className="card" style={{ marginBottom: '24px', padding: '16px 24px' }}>
          <div style={{ display: 'flex', gap: '15px', alignItems: 'end', flexWrap: 'wrap' }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', marginBottom: '4px', display: 'block' }}>Start Date</label>
              <input type="datetime-local" className="form-control" value={customStart} onChange={e => setCustomStart(e.target.value)} />
            </div>
            <div className="form-group" style={{ margin: 0 }}>
              <label style={{ fontSize: '0.8rem', marginBottom: '4px', display: 'block' }}>End Date</label>
              <input type="datetime-local" className="form-control" value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          </div>
        </div>
      )}

      <div className="card" style={{ marginBottom: '24px', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '15px', flexWrap: 'wrap' }}>
        <input
          type="text"
          className="form-control"
          placeholder="Filter by hostname, asset ID, employee, or logged-in user..."
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ maxWidth: '350px' }}
        />
        <button
          className={`btn ${showActive ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setShowActive(!showActive)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 14px' }}
        >
          {showActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
          <Activity size={15} />
          <span>{showActive ? 'Showing All Sessions' : 'Show Active Sessions'}</span>
        </button>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          {showActive
            ? `${displayAssets.length} device${displayAssets.length !== 1 ? 's' : ''} found`
            : `${displayAssets.length} inactive device${displayAssets.length !== 1 ? 's' : ''} found`
          }
        </span>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Asset ID</th>
                <th>Hostname</th>
                <th>Category</th>
                <th>Allocated To</th>
                <th>Logged In User</th>
                <th>{showActive ? 'Last Seen / Uptime' : 'Inactive Duration'}</th>
                <th>Last Seen</th>
              </tr>
            </thead>
            <tbody>
              {displayAssets.map(asset => {
                const msAgo = Date.now() - new Date(asset.last_seen).getTime();
                const isActive = showActive && msAgo < activeThresholdMs;
                return (
                  <tr key={asset.id}>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{asset.asset_id}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{asset.hostname}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{asset.manufacturer} {asset.model}</div>
                    </td>
                    <td>{asset.category}</td>
                    <td>
                      {asset.employee_name || (
                        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      {asset.logged_in_user || (
                        <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>N/A</span>
                      )}
                    </td>
                    <td>
                      {isActive ? (
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--success)', fontWeight: 600 }}>
                          <Activity size={14} />
                          <span>Active &middot; {formatDuration(msAgo)} uptime</span>
                        </div>
                      ) : (
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          color: msAgo > 7 * 86400000 ? 'var(--danger)' : msAgo > 2 * 86400000 ? 'var(--warning)' : 'var(--text-secondary)',
                          fontWeight: msAgo > 2 * 86400000 ? 600 : 400,
                        }}>
                          <Clock size={14} />
                          {formatDuration(msAgo)}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {asset.last_seen}
                    </td>
                  </tr>
                );
              })}
              {displayAssets.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>
                    <Clock size={32} style={{ marginBottom: '10px', opacity: 0.5 }} />
                    <p>{showActive ? 'No devices found.' : 'No inactive devices found for the selected timeframe.'}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
