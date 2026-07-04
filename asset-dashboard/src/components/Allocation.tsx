import React, { useState, useRef, useEffect, useMemo } from 'react';
import { User, Undo2, Award, Plus, ChevronDown } from 'lucide-react';

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
  const [allocateSearch, setAllocateSearch] = useState('');
  const [showAllocateDropdown, setShowAllocateDropdown] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);
  const allocateRef = useRef<HTMLDivElement>(null);
  const [highlightedUserIdx, setHighlightedUserIdx] = useState(0);

  const activeAllocations = allocations.filter(a => a.returned_at === null);
  const returnedAllocations = allocations.filter(a => a.returned_at !== null);

  const availableAssets = assets.filter(a => a.status === 'Available');

  const previousUsers = useMemo(() => {
    const map = new Map<string, string>();
    allocations.forEach(a => {
      if (a.employee_name) map.set(a.employee_name, a.employee_email);
    });
    return Array.from(map.entries())
      .map(([name, email]) => ({ name, email }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allocations]);

  const filteredUsers = useMemo(() => {
    if (!allocateSearch) return previousUsers;
    const q = allocateSearch.toLowerCase();
    return previousUsers.filter(u => u.name.toLowerCase().includes(q));
  }, [previousUsers, allocateSearch]);

  const handleNameSelect = (name: string, email: string) => {
    if (name === '__new__') {
      setIsNewUser(true);
      setEmployeeName('');
      setEmployeeEmail('');
      setAllocateSearch('');
    } else {
      setIsNewUser(false);
      setEmployeeName(name);
      setEmployeeEmail(email);
      setAllocateSearch(name);
    }
    setShowAllocateDropdown(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (allocateRef.current && !allocateRef.current.contains(e.target as Node)) {
        setShowAllocateDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleAllocateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssetId || !employeeName || !employeeEmail) return;
    onAllocate(selectedAssetId, employeeName, employeeEmail);
    // Reset form
    setSelectedAssetId('');
    setEmployeeName('');
    setEmployeeEmail('');
    setAllocateSearch('');
    setIsNewUser(false);
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
              <label>Allocate To</label>
              <div ref={allocateRef} style={{ position: 'relative' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px',
                  border: '1px solid var(--border-color)', borderRadius: '6px',
                  background: 'var(--bg-primary)', minHeight: '36px',
                  cursor: 'pointer',
                }}>
                  <input
                    type="text"
                    className="form-control"
                    style={{ border: 'none', outline: 'none', background: 'transparent', flex: 1, padding: '8px 0', cursor: 'pointer' }}
                    placeholder="Search or select user..."
                    value={isNewUser ? employeeName : allocateSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setIsNewUser(true);
                      setEmployeeName(val);
                      setAllocateSearch(val);
                      setShowAllocateDropdown(true);
                    }}
                    onFocus={() => { setShowAllocateDropdown(true); setHighlightedUserIdx(0); }}
                    onKeyDown={e => {
                      if (!showAllocateDropdown) return;
                      const items = [{ name: '__new__', email: '' }, ...filteredUsers];
                      if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        setHighlightedUserIdx(p => Math.min(p + 1, items.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        setHighlightedUserIdx(p => Math.max(p - 1, 0));
                      } else if (e.key === 'Enter') {
                        e.preventDefault();
                        const item = items[highlightedUserIdx];
                        if (item) handleNameSelect(item.name, item.email);
                      } else if (e.key === 'Escape') {
                        setShowAllocateDropdown(false);
                      }
                    }}
                    required={!employeeName}
                  />
                  <ChevronDown size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} onClick={() => setShowAllocateDropdown(v => !v)} />
                </div>
                {showAllocateDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: '4px',
                    maxHeight: '220px', overflowY: 'auto',
                  }}>
                    <div
                      onClick={() => handleNameSelect('__new__', '')}
                      onMouseEnter={() => setHighlightedUserIdx(0)}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                        backgroundColor: highlightedUserIdx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                        color: 'var(--primary)', fontWeight: 600,
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      <Plus size={16} /> New
                    </div>
                    {filteredUsers.length > 0 ? (
                      filteredUsers.map((u, i) => (
                        <div
                          key={u.name}
                          onClick={() => handleNameSelect(u.name, u.email)}
                          onMouseEnter={() => setHighlightedUserIdx(i + 1)}
                          style={{
                            padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                            backgroundColor: highlightedUserIdx === i + 1 ? 'var(--bg-tertiary)' : 'transparent',
                            color: 'var(--text-primary)',
                            borderBottom: i < filteredUsers.length - 1 ? '1px solid var(--border-color)' : 'none',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{u.name}</div>
                          {u.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{u.email}</div>}
                        </div>
                      ))
                    ) : !isNewUser && (
                      <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        No matching users
                      </div>
                    )}
                  </div>
                )}
              </div>
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
