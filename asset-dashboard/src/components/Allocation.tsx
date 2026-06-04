import React, { useState } from 'react';
import { User, Undo2, Award } from 'lucide-react';

interface Asset {
  id: string;
  asset_id: string;
  hostname: string;
  category: string;
  status: string;
}

interface AllocationRecord {
  id: string;
  asset_id: string;
  hostname: string;
  employee_name: string;
  employee_email: string;
  allocated_at: string;
  returned_at: string | null;
}

interface HistoryLog {
  id: string;
  hostname: string;
  event_type: string;
  description: string;
  changed_by: string;
  created_at: string;
}

interface AllocationProps {
  assets: Asset[];
  allocations: AllocationRecord[];
  historyLogs: HistoryLog[];
  onAllocate: (assetId: string, employeeName: string, employeeEmail: string) => void;
  onReturn: (allocationId: string) => void;
}

export const Allocation: React.FC<AllocationProps> = ({ assets, allocations, historyLogs, onAllocate, onReturn }) => {
  const [selectedAssetId, setSelectedAssetId] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [employeeEmail, setEmployeeEmail] = useState('');

  const activeAllocations = allocations.filter(a => a.returned_at === null);
  const returnedAllocations = allocations.filter(a => a.returned_at !== null);

  const availableAssets = assets.filter(a => a.status === 'Available');

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !employeeName || !employeeEmail) return;
    onAllocate(selectedAssetId, employeeName, employeeEmail);
    // Reset form
    setSelectedAssetId('');
    setEmployeeName('');
    setEmployeeEmail('');
  };

  return (
    <div className="animated-fade" style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px' }}>
      
      {/* Left: Allocation Form & History */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2>Allocate Asset to User</h2>
          </div>
          <form onSubmit={handleAllocateSubmit}>
            <div className="form-group">
              <label>Select Available Asset</label>
              <select 
                className="form-control" 
                value={selectedAssetId} 
                onChange={e => setSelectedAssetId(e.target.value)}
                required
              >
                <option value="">-- Choose Asset --</option>
                {availableAssets.map(asset => (
                  <option key={asset.id} value={asset.id}>
                    [{asset.category}] {asset.hostname} ({asset.asset_id})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Employee Name</label>
              <input 
                type="text" 
                className="form-control" 
                placeholder="e.g. John Doe" 
                value={employeeName}
                onChange={e => setEmployeeName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Employee Email</label>
              <input 
                type="email" 
                className="form-control" 
                placeholder="e.g. john@company.com" 
                value={employeeEmail}
                onChange={e => setEmployeeEmail(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '10px' }}>
              <Award size={18} /> Assign Asset
            </button>
          </form>
        </div>

        {/* Global Asset Audit Log */}
        <div className="card" style={{ flexGrow: 1 }}>
          <div className="card-header">
            <h2>Audit History Logs</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '350px', overflowY: 'auto' }}>
            {historyLogs.map(log => (
              <div key={log.id} style={{ 
                borderLeft: `4px solid ${
                  log.event_type === 'Allocation' ? 'var(--primary)' : 
                  log.event_type === 'Return' ? 'var(--success)' : 'var(--text-tertiary)'
                }`,
                padding: '10px 14px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '0 8px 8px 0'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{log.event_type.toUpperCase()}</span>
                  <span>{log.created_at}</span>
                </div>
                <p style={{ fontSize: '0.85rem', marginTop: '4px', fontWeight: '500' }}>
                  {log.description}
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '4px' }}>
                  Device: {log.hostname} • Changed by: {log.changed_by}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Active & Archived Allocations Table */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2>Active User Allocations</h2>
          </div>
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Asset / Hostname</th>
                  <th>Allocation Date</th>
                  <th style={{ textAlign: 'center' }}>Return Device</th>
                </tr>
              </thead>
              <tbody>
                {activeAllocations.length > 0 ? (
                  activeAllocations.map(a => (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: '600' }}>{a.employee_name}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.employee_email}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600', color: 'var(--primary)' }}>{a.hostname}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{a.asset_id}</div>
                      </td>
                      <td>{a.allocated_at}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', borderColor: 'var(--success)', color: 'var(--success)' }} onClick={() => onReturn(a.id)}>
                          <Undo2 size={14} style={{ marginRight: '4px' }} /> Return
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-tertiary)' }}>
                      <User size={30} style={{ marginBottom: '8px' }} />
                      <p>No active allocations. Use the form on the left to assign devices.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* History Archive */}
        <div className="card">
          <div className="card-header">
            <h2>Archived Return Records</h2>
          </div>
          <div className="table-container" style={{ maxHeight: '200px', overflowY: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Hostname</th>
                  <th>Allocated</th>
                  <th>Returned</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {returnedAllocations.map(a => (
                  <tr key={a.id}>
                    <td>{a.employee_name}</td>
                    <td style={{ fontWeight: '600' }}>{a.hostname}</td>
                    <td>{a.allocated_at}</td>
                    <td>{a.returned_at}</td>
                    <td>
                      <span className="badge badge-success">Archived</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

    </div>
  );
};
