import { useState, useRef, useEffect, useMemo } from 'react';
import { X, Loader2, Plus, ChevronDown } from 'lucide-react';
import { apiUrl } from '../services/apiConfig';

interface RequestAssetModalProps {
  onClose: () => void;
  onSubmit: (data: { request_type: string; form_data: any }) => Promise<void>;
  allocatedUsers?: Array<{ name: string; email: string }>;
}

const DEFAULT_HW_CATEGORIES = [
  'Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Firewall', 'Mobile Device', 'Other',
];

const SW_TYPES = ['License', 'Subscription', 'API', 'Other'];

export function RequestAssetModal({ onClose, onSubmit, allocatedUsers = [] }: RequestAssetModalProps) {
  const [requestType, setRequestType] = useState<'hardware' | 'software'>('hardware');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [hwCategory, setHwCategory] = useState('Laptop');
  const [customCategory, setCustomCategory] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [totalCost, setTotalCost] = useState('');

  const [swType, setSwType] = useState('License');
  const [customSwType, setCustomSwType] = useState('');
  const [swName, setSwName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [swTotalCost, setSwTotalCost] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [publisher, setPublisher] = useState('');
  const [reqEmployeeName, setReqEmployeeName] = useState('');
  const [reqEmployeeEmail, setReqEmployeeEmail] = useState('');
  const [allocSearch, setAllocSearch] = useState('');
  const [showAllocDropdown, setShowAllocDropdown] = useState(false);
  const [isNewAllocUser, setIsNewAllocUser] = useState(false);
  const [highlightedAllocIdx, setHighlightedAllocIdx] = useState(0);
  const allocRef = useRef<HTMLDivElement>(null);

  // Fetch categories dynamically from the backend
  const [hwCategories, setHwCategories] = useState<string[]>(DEFAULT_HW_CATEGORIES);
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch(apiUrl('/api/categories'));
        if (res.ok) {
          const cats: string[] = await res.json();
          // Merge server categories with 'Other' option for truly new categories
          const merged = [...new Set([...cats, 'Other'])];
          setHwCategories(merged);
        }
      } catch {
        // Fallback to defaults
      }
    };
    fetchCategories();
  }, []);

  const filteredAllocUsers = useMemo(() => {
    if (!allocSearch) return allocatedUsers;
    const q = allocSearch.toLowerCase();
    return allocatedUsers.filter(u => u.name.toLowerCase().includes(q));
  }, [allocatedUsers, allocSearch]);

  const handleAllocSelect = (name: string, email: string) => {
    if (name === '__new__') {
      setIsNewAllocUser(true);
      setReqEmployeeName('');
      setReqEmployeeEmail('');
      setAllocSearch('');
    } else {
      setIsNewAllocUser(false);
      setReqEmployeeName(name);
      setReqEmployeeEmail(email);
      setAllocSearch(name);
    }
    setShowAllocDropdown(false);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (allocRef.current && !allocRef.current.contains(e.target as Node)) {
        setShowAllocDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const resolvedCategory = hwCategory === 'Other' ? customCategory : hwCategory;
      const resolvedSwType = swType === 'Other' ? customSwType : swType;
      const common = { employee_name: reqEmployeeName, employee_email: reqEmployeeEmail };
      const form_data = requestType === 'hardware'
        ? { ...common, category: resolvedCategory, serial_number: serialNumber, manufacturer, model, purchase_date: purchaseDate, total_cost: totalCost }
        : { ...common, license_type: resolvedSwType, name: swName, purpose, total_cost: swTotalCost, expiry_date: expiryDate, publisher };
      await onSubmit({ request_type: requestType, form_data });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to submit request');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 560, width: '90%' }}>
        <div className="modal-header">
          <h2>Request New Asset</h2>
          <button className="btn btn-secondary" style={{ padding: '6px' }} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {error && (
              <div className="login-toast login-toast-error">{error}</div>
            )}

            <div>
              <label className="form-label">Request Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button type="button" className={`btn ${requestType === 'hardware' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setRequestType('hardware')}>
                  🖥 Hardware
                </button>
                <button type="button" className={`btn ${requestType === 'software' ? 'btn-primary' : 'btn-secondary'}`} style={{ flex: 1 }} onClick={() => setRequestType('software')}>
                  💿 Software
                </button>
              </div>
            </div>

            <div>
              <label className="form-label">Allocated To</label>
              <div ref={allocRef} style={{ position: 'relative' }}>
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
                    value={isNewAllocUser ? reqEmployeeName : allocSearch}
                    onChange={e => {
                      const val = e.target.value;
                      setIsNewAllocUser(true);
                      setReqEmployeeName(val);
                      setAllocSearch(val);
                      setShowAllocDropdown(true);
                    }}
                    onFocus={() => { setShowAllocDropdown(true); setHighlightedAllocIdx(0); }}
                    onKeyDown={e => {
                      if (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') e.preventDefault();
                      const items = [{ name: '__new__', email: '' }, ...filteredAllocUsers];
                      if (e.key === 'ArrowDown') {
                        setHighlightedAllocIdx(p => Math.min(p + 1, items.length - 1));
                      } else if (e.key === 'ArrowUp') {
                        setHighlightedAllocIdx(p => Math.max(p - 1, 0));
                      } else if (e.key === 'Enter') {
                        if (!showAllocDropdown) { setShowAllocDropdown(true); return; }
                        const item = items[highlightedAllocIdx];
                        if (item) handleAllocSelect(item.name, item.email);
                      } else if (e.key === 'Escape') {
                        setShowAllocDropdown(false);
                      }
                    }}
                  />
                  <ChevronDown size={15} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} onClick={() => setShowAllocDropdown(v => !v)} />
                </div>
                {showAllocDropdown && (
                  <div style={{
                    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 1000,
                    backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)',
                    borderRadius: '8px', boxShadow: '0 8px 24px rgba(0,0,0,0.2)', marginTop: '4px',
                    maxHeight: '220px', overflowY: 'auto',
                  }}>
                    <div
                      onClick={() => handleAllocSelect('__new__', '')}
                      onMouseEnter={() => setHighlightedAllocIdx(0)}
                      style={{
                        padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                        backgroundColor: highlightedAllocIdx === 0 ? 'var(--bg-tertiary)' : 'transparent',
                        color: 'var(--primary)', fontWeight: 600,
                        borderBottom: '1px solid var(--border-color)',
                        display: 'flex', alignItems: 'center', gap: '8px',
                      }}
                    >
                      <Plus size={16} /> New
                    </div>
                    {filteredAllocUsers.length > 0 ? (
                      filteredAllocUsers.map((u, i) => (
                        <div
                          key={u.name}
                          onClick={() => handleAllocSelect(u.name, u.email)}
                          onMouseEnter={() => setHighlightedAllocIdx(i + 1)}
                          style={{
                            padding: '10px 12px', cursor: 'pointer', fontSize: '0.85rem',
                            backgroundColor: highlightedAllocIdx === i + 1 ? 'var(--bg-tertiary)' : 'transparent',
                            color: 'var(--text-primary)',
                            borderBottom: i < filteredAllocUsers.length - 1 ? '1px solid var(--border-color)' : 'none',
                          }}
                        >
                          <div style={{ fontWeight: 500 }}>{u.name}</div>
                          {u.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>{u.email}</div>}
                        </div>
                      ))
                    ) : !isNewAllocUser && (
                      <div style={{ padding: '12px', fontSize: '0.8rem', color: 'var(--text-tertiary)', textAlign: 'center' }}>
                        No matching users
                      </div>
                    )}
                  </div>
                )}
              </div>
              <input
                type="email"
                className="form-control"
                style={{ marginTop: '8px' }}
                placeholder="Email (auto-filled for existing users)"
                value={reqEmployeeEmail}
                onChange={e => setReqEmployeeEmail(e.target.value)}
              />
            </div>

            {requestType === 'hardware' ? (
              <>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-control" value={hwCategory} onChange={e => { setHwCategory(e.target.value); if (e.target.value !== 'Other') setCustomCategory(''); }} required>
                    {hwCategories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  {hwCategory === 'Other' && (
                    <input className="form-control" style={{ marginTop: 8 }} value={customCategory} onChange={e => setCustomCategory(e.target.value)} placeholder="Describe the item type..." required />
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Serial Number</label>
                    <input className="form-control" value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="e.g. SN-12345" />
                  </div>
                  <div>
                    <label className="form-label">Manufacturer</label>
                    <input className="form-control" value={manufacturer} onChange={e => setManufacturer(e.target.value)} placeholder="e.g. Dell" required />
                  </div>
                  <div>
                    <label className="form-label">Model</label>
                    <input className="form-control" value={model} onChange={e => setModel(e.target.value)} placeholder="e.g. XPS 15" required />
                  </div>
                  <div>
                    <label className="form-label">Purchase Date</label>
                    <input className="form-control" type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="form-label">Total Cost (₹)</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={totalCost} onChange={e => setTotalCost(e.target.value)} placeholder="0.00" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label className="form-label">License Type</label>
                  <select className="form-control" value={swType} onChange={e => { setSwType(e.target.value); if (e.target.value !== 'Other') setCustomSwType(''); }} required>
                    {SW_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {swType === 'Other' && (
                    <input className="form-control" style={{ marginTop: 8 }} value={customSwType} onChange={e => setCustomSwType(e.target.value)} placeholder="Describe the type..." required />
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label className="form-label">Software Name</label>
                    <input className="form-control" value={swName} onChange={e => setSwName(e.target.value)} placeholder="e.g. Microsoft 365" required />
                  </div>
                  <div>
                    <label className="form-label">Publisher</label>
                    <input className="form-control" value={publisher} onChange={e => setPublisher(e.target.value)} placeholder="e.g. Microsoft" />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Purpose</label>
                    <textarea className="form-control" value={purpose} onChange={e => setPurpose(e.target.value)} placeholder="Why is this software needed?" rows={2} required />
                  </div>
                  <div>
                    <label className="form-label">Total Cost (₹)</label>
                    <input className="form-control" type="number" min="0" step="0.01" value={swTotalCost} onChange={e => setSwTotalCost(e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="form-label">Expiry Date</label>
                    <input className="form-control" type="date" value={expiryDate} onChange={e => setExpiryDate(e.target.value)} />
                  </div>
                </div>
              </>
            )}
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <><Loader2 size={16} className="animate-spin" /> Submitting...</> : 'Submit Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
