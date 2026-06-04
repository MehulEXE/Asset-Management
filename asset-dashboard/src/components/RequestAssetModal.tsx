import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface RequestAssetModalProps {
  onClose: () => void;
  onSubmit: (data: { request_type: string; form_data: any }) => Promise<void>;
}

const HW_CATEGORIES = [
  'Laptop', 'Desktop', 'Server', 'Printer', 'Network Device', 'Firewall', 'Mobile Device', 'Other',
];

const SW_TYPES = ['License', 'Subscription', 'API', 'Other'];

export function RequestAssetModal({ onClose, onSubmit }: RequestAssetModalProps) {
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const resolvedCategory = hwCategory === 'Other' ? customCategory : hwCategory;
      const resolvedSwType = swType === 'Other' ? customSwType : swType;
      const form_data = requestType === 'hardware'
        ? { category: resolvedCategory, serial_number: serialNumber, manufacturer, model, purchase_date: purchaseDate, total_cost: totalCost }
        : { license_type: resolvedSwType, name: swName, purpose, total_cost: swTotalCost, expiry_date: expiryDate, publisher };
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

            {requestType === 'hardware' ? (
              <>
                <div>
                  <label className="form-label">Type</label>
                  <select className="form-control" value={hwCategory} onChange={e => { setHwCategory(e.target.value); if (e.target.value !== 'Other') setCustomCategory(''); }} required>
                    {HW_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
