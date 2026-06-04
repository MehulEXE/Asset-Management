import { useState, useEffect } from 'react';
import { Laptop, HardDrive, ShieldCheck, FileCheck, Clock, AlertTriangle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../services/apiConfig';

interface Asset {
  id: string;
  asset_id: string;
  hostname: string;
  category: string;
  manufacturer: string;
  model: string;
  status: string;
  last_seen: string;
}

interface DashboardProps {
  assets: Asset[];
  setActiveTab: (tab: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ assets, setActiveTab }) => {
  const { token } = useAuth();
  const [pendingRequests, setPendingRequests] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/api/asset-requests'), {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setPendingRequests(data.filter((r: any) => r.status === 'pending').length);
        }
      })
      .catch(() => {});
  }, [token]);

  // Compute metrics
  const totalAssets = assets.length;
  const allocatedAssets = assets.filter(a => a.status === 'Allocated').length;
  const availableAssets = assets.filter(a => a.status === 'Available').length;

  // Categories Breakdown
  const categories = assets.reduce((acc: { [key: string]: number }, cur) => {
    acc[cur.category] = (acc[cur.category] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="animated-fade">
      {/* 1. KPIs */}
      <div className="grid-kpi">
        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Laptop />
          </div>
          <div className="kpi-info">
            <h3>Total Assets</h3>
            <p>{totalAssets}</p>
          </div>
        </div>

        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)' }}>
            <ShieldCheck />
          </div>
          <div className="kpi-info">
            <h3>Allocated</h3>
            <p>{allocatedAssets}</p>
          </div>
        </div>

        <div className="card-kpi">
          <div className="kpi-icon" style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)' }}>
            <HardDrive />
          </div>
          <div className="kpi-info">
            <h3>Available</h3>
            <p>{availableAssets}</p>
          </div>
        </div>

        <div className="card-kpi" style={{ cursor: 'pointer' }} onClick={() => setActiveTab('requests')}>
          <div className="kpi-icon" style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)' }}>
            <FileCheck />
          </div>
          <div className="kpi-info">
            <h3>Pending Requests</h3>
            <p>{pendingRequests}</p>
          </div>
        </div>
      </div>

      {/* 2. Charts and Tables Row */}
      <div className="dashboard-row">
        {/* Left Side: Recent Discovered Assets */}
        <div className="card">
          <div className="card-header">
            <h2>Recent Endpoint Discoveries</h2>
            <button className="btn btn-secondary" onClick={() => setActiveTab('assets')} style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
              View All
            </button>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Asset ID</th>
                  <th>Hostname</th>
                  <th>Category</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Last Seen</th>
                </tr>
              </thead>
              <tbody>
                {assets.slice(0, 5).map(asset => (
                  <tr key={asset.id}>
                    <td style={{ fontWeight: 'bold', color: 'var(--primary)' }}>{asset.asset_id}</td>
                    <td>{asset.hostname}</td>
                    <td>{asset.category}</td>
                    <td>{asset.manufacturer} {asset.model}</td>
                    <td>
                      <span className={`badge badge-${
                        asset.status === 'Available' ? 'success' : 
                        asset.status === 'Allocated' ? 'info' : 'warning'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {asset.last_seen}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Side: Category Distributions & Quick Alerts */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '15px' }}>Fleet Distribution</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(categories).map(([cat, count]) => (
                <div key={cat}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-secondary)', fontWeight: '500' }}>{cat}</span>
                    <span style={{ fontWeight: 'bold' }}>{count} ({Math.round((count / totalAssets) * 100)}%)</span>
                  </div>
                  <div style={{ height: '6px', backgroundColor: 'var(--bg-tertiary)', borderRadius: '4px', overflow: 'hidden' }}>
                    <div style={{ 
                      height: '100%', 
                      backgroundColor: 'var(--primary)', 
                      width: `${(count / totalAssets) * 100}%` 
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '15px', color: 'var(--danger)' }}>System Alerts</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--danger-light)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--danger)' }}>
                <AlertTriangle style={{ color: 'var(--danger)', flexShrink: 0 }} size={20} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <strong>C-SYSTEM-01</strong>: Firewalls reported offline during the last agent checkin.
                </p>
              </div>

              <div style={{ display: 'flex', gap: '10px', backgroundColor: 'var(--warning-light)', padding: '10px', borderRadius: '8px', borderLeft: '3px solid var(--warning)' }}>
                <Clock style={{ color: 'var(--warning)', flexShrink: 0 }} size={20} />
                <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                  <strong>L-SERVER-NODE2</strong>: Unscheduled check-in lag exceeded 3 hours.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
