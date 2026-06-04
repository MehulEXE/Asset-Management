import React, { useState } from 'react';
import { Shield, ShieldCheck, UserCheck, Plus, Check, Monitor, Apple, Terminal, Download } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';

interface ApiKey {
  id: string;
  key: string;
  description: string;
  is_active: boolean;
  created_at: string;
}

export const SecuritySettings: React.FC = () => {
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([
    { id: '1', key: 'key_prod_win_agent_d43f721a', description: 'Windows Endpoint Discovery Agents', is_active: true, created_at: '2026-05-20' },
    { id: '2', key: 'key_prod_linux_daemon_7841bc', description: 'Linux Server Monitoring Daemons', is_active: true, created_at: '2026-05-25' }
  ]);

  const [newKeyDesc, setNewKeyDesc] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);

  const handleGenerateKey = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKeyDesc) return;
    const randomHex = Array.from({length: 16}, () => Math.floor(Math.random()*16).toString(16)).join('');
    const newKeyStr = `key_prod_win_${randomHex}`;
    
    const newKeyObj: ApiKey = {
      id: String(apiKeys.length + 1),
      key: newKeyStr,
      description: newKeyDesc,
      is_active: true,
      created_at: new Date().toISOString().split('T')[0]
    };

    setApiKeys([...apiKeys, newKeyObj]);
    setGeneratedKey(newKeyStr);
    setNewKeyDesc('');
  };

  return (
    <div className="animated-fade" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Agent Deployment Center */}
      <div className="card">
        <div className="card-header">
          <h2>Agent Deployment Center</h2>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
          Roll out automated endpoint discovery agents across your organization's infrastructure. Discovered hardware and software telemetry will synchronize automatically with this dashboard.
        </p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
          {/* Windows card */}
          <div className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-tertiary)', borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'var(--primary-light)', color: 'var(--primary)', display: 'flex' }}>
                  <Monitor size={20} />
                </div>
                <h3 style={{ fontWeight: 'bold', fontSize: '1rem' }}>Windows Agent Installer</h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Self-contained installer that deploys the discovery agent as a background Windows Service. 
                <strong> Run as Administrator</strong> after download to automatically install, register, and start the service — no manual setup required.
              </p>
            </div>
            <a 
              href={apiUrl('/api/v1/download/windows')} 
              className="btn btn-primary" 
              style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
            >
              <Download size={18} /> Download Windows Installer
            </a>
          </div>

          {/* macOS card */}
          <div className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-tertiary)', borderLeft: '4px solid #a2a2a2', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', display: 'flex' }}>
                  <Apple size={20} />
                </div>
                <h3 style={{ fontWeight: 'bold', fontSize: '1rem' }}>macOS Daemon Setup</h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Enrolls a launchd daemon to perform lightweight hardware queries and gather system diagnostics. Automatically binds plist security configurations.
              </p>
            </div>
            <a 
              href={apiUrl('/api/v1/download/mac')} 
              className="btn btn-secondary" 
              style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none' }}
            >
              Download macOS Installer .SH
            </a>
          </div>

          {/* Linux card */}
          <div className="card" style={{ padding: '20px', backgroundColor: 'var(--bg-tertiary)', borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '220px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: 'var(--success-light)', color: 'var(--success)', display: 'flex' }}>
                  <Terminal size={20} />
                </div>
                <h3 style={{ fontWeight: 'bold', fontSize: '1rem' }}>Linux Daemon Setup</h3>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Quick enrollment systemd daemon. Installs light python collectors to query cpu, virtual memory, disks, and active interfaces.
              </p>
            </div>
            <a 
              href={apiUrl('/api/v1/download/linux')} 
              className="btn btn-secondary" 
              style={{ marginTop: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', textDecoration: 'none', borderColor: 'var(--success)', color: 'var(--success)' }}
            >
              Download Linux Daemon .SH
            </a>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
        
        {/* Left: Role Based Access Configurations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2>Role Based Access Control</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <div style={{ display: 'flex', gap: '15px', backgroundColor: 'var(--primary-light)', padding: '16px', borderRadius: '12px' }}>
              <ShieldCheck style={{ color: 'var(--primary)', flexShrink: 0 }} size={24} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>Administrator (Full Access)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Complete CRUD permissions for assets, invoice entries, employee assignments, and API key management.
                </p>
                <span className="badge badge-success" style={{ marginTop: '8px', fontSize: '0.7rem' }}>Active User</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
              <UserCheck style={{ color: 'var(--text-secondary)', flexShrink: 0 }} size={24} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Operator (Read/Write Allocations)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Can edit assets and modify allocations, but cannot view invoices, costs, or generate API enrollment keys.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '15px', backgroundColor: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
              <Shield style={{ color: 'var(--text-secondary)', flexShrink: 0 }} size={24} />
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-secondary)' }}>Viewer (Read-Only)</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: '2px' }}>
                  Read-only view of dashboard and assets. All creation, editing, and deletion operations are blocked.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right: API Key Enrollment Management */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2>Agent Enrollment API Keys</h2>
          </div>
          
          <form onSubmit={handleGenerateKey} style={{ display: 'flex', gap: '12px', marginBottom: '20px', alignItems: 'flex-end' }}>
            <div className="form-group" style={{ flexGrow: 1, marginBottom: 0 }}>
              <label>API Key Description</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. Sales Branch Laptops" 
                value={newKeyDesc}
                onChange={e => setNewKeyDesc(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn btn-primary">
              <Plus size={18} /> Generate Key
            </button>
          </form>

          {/* Show newly generated key */}
          {generatedKey && (
            <div style={{ 
              backgroundColor: 'var(--success-light)', 
              border: '1px solid var(--success)', 
              borderRadius: '8px', 
              padding: '12px 16px', 
              marginBottom: '20px' 
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--success)', fontWeight: 'bold', fontSize: '0.9rem' }}>
                <Check size={16} /> Key Generated Successfully!
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Copy this token now and paste it in your Agent's `config.json` inside `"agent_token"`. You won't see it again!
              </p>
              <div style={{ 
                fontFamily: 'Consolas', 
                fontSize: '1rem', 
                fontWeight: 'bold', 
                backgroundColor: 'var(--bg-secondary)', 
                padding: '8px', 
                borderRadius: '4px', 
                marginTop: '8px', 
                border: '1px dashed var(--success)',
                textAlign: 'center'
              }}>
                {generatedKey}
              </div>
            </div>
          )}

          {/* Keys list */}
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Description</th>
                  <th>API Enrollment Key (Hashed)</th>
                  <th>Created Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map((k: ApiKey) => (
                  <tr key={k.id}>
                    <td style={{ fontWeight: '600' }}>{k.description}</td>
                    <td style={{ fontFamily: 'Consolas', fontSize: '0.85rem' }}>{k.key}</td>
                    <td>{k.created_at}</td>
                    <td>
                      <span className={`badge badge-${k.is_active ? 'success' : 'danger'}`}>
                        {k.is_active ? 'Active' : 'Revoked'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      </div>
    </div>
  );
};
