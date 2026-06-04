import { useState, useEffect, useCallback } from 'react';
import { Plus, Check, X, Clock, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { RequestAssetModal } from './RequestAssetModal';
import { apiUrl } from '../services/apiConfig';

interface AssetRequest {
  id: string;
  user_email: string;
  user_name: string;
  request_type: 'hardware' | 'software';
  status: 'pending' | 'approved' | 'rejected';
  form_data: Record<string, string>;
  admin_notes?: string;
  created_at: string;
  reviewed_at?: string;
  reviewed_by?: string;
}

export function AssetRequests() {
  const { currentUser, token, isAdmin } = useAuth();
  const [requests, setRequests] = useState<AssetRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchRequests = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/asset-requests'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setRequests(await res.json());
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const handleSubmitRequest = async (data: { request_type: string; form_data: any }) => {
    if (!token) throw new Error('Not authenticated');
    const res = await fetch(apiUrl('/api/asset-requests'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to submit request');
    }
    await fetchRequests();
  };

  const handleApprove = async (id: string) => {
    if (!token) return;
    setActionLoading(id);
    try {
      await fetch(apiUrl(`/api/asset-requests/${id}/approve`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: '{}',
      });
      await fetchRequests();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (id: string) => {
    if (!token) return;
    const notes = prompt('Rejection reason (optional):');
    setActionLoading(id);
    try {
      await fetch(apiUrl(`/api/asset-requests/${id}/reject`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ notes: notes || '' }),
      });
      await fetchRequests();
    } catch {
      // silent
    } finally {
      setActionLoading(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'approved') return <span className="badge badge-success"><CheckCircle size={14} /> Approved</span>;
    if (status === 'rejected') return <span className="badge badge-error" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}><XCircle size={14} /> Rejected</span>;
    return <span className="badge badge-warning"><Clock size={14} /> Pending</span>;
  };

  const userRequests = isAdmin ? requests : requests.filter(r => r.user_email === currentUser?.email);

  return (
    <div className="animated-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>{isAdmin ? 'Pending Approvals' : 'My Requests'}</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={fetchRequests} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          {!isAdmin && (
            <button className="btn btn-primary" onClick={() => setShowModal(true)}>
              <Plus size={18} /> New Request
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: '20px' }}>
        <div className="card-kpi">
          <div className="kpi-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
            <Clock size={24} />
          </div>
          <div className="kpi-info">
            <h3>Pending</h3>
            <p>{userRequests.filter(r => r.status === 'pending').length}</p>
          </div>
        </div>
        <div className="card-kpi">
          <div className="kpi-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            <CheckCircle size={24} />
          </div>
          <div className="kpi-info">
            <h3>Approved</h3>
            <p>{userRequests.filter(r => r.status === 'approved').length}</p>
          </div>
        </div>
        <div className="card-kpi">
          <div className="kpi-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
            <XCircle size={24} />
          </div>
          <div className="kpi-info">
            <h3>Rejected</h3>
            <p>{userRequests.filter(r => r.status === 'rejected').length}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : userRequests.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
          <p>{isAdmin ? 'No pending requests to review.' : 'You have not submitted any requests yet.'}</p>
          {!isAdmin && (
            <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => setShowModal(true)}>
              <Plus size={18} /> Submit Your First Request
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  {isAdmin && <th>Requested By</th>}
                  <th>Type</th>
                  <th>Details</th>
                  <th>Status</th>
                  {isAdmin && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {userRequests.map(req => {
                  const fd = req.form_data;
                  const detail = req.request_type === 'hardware'
                    ? `${fd.manufacturer || ''} ${fd.model || ''} (${fd.category || ''})`
                    : `${fd.name || ''} (${fd.license_type || fd.purpose || ''})`;
                  return (
                    <tr key={req.id}>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      {isAdmin && <td>{req.user_name} <span style={{ color: 'var(--text-tertiary)', fontSize: '0.78rem' }}>({req.user_email})</span></td>}
                      <td>
                        <span className={`badge ${req.request_type === 'hardware' ? 'badge-info' : 'badge-warning'}`}>
                          {req.request_type === 'hardware' ? '🖥 Hardware' : '💿 Software'}
                        </span>
                      </td>
                      <td style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>{detail}</td>
                      <td>{statusBadge(req.status)}</td>
                      {isAdmin && (
                        <td>
                          {req.status === 'pending' ? (
                            <div style={{ display: 'flex', gap: '6px' }}>
                              <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: '0.8rem' }} onClick={() => handleApprove(req.id)} disabled={actionLoading === req.id}>
                                {actionLoading === req.id ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Approve
                              </button>
                              <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem', color: 'var(--danger)' }} onClick={() => handleReject(req.id)} disabled={actionLoading === req.id}>
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.82rem', color: 'var(--text-tertiary)' }}>
                              {req.admin_notes ? `Notes: ${req.admin_notes}` : '—'}
                            </span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && <RequestAssetModal onClose={() => setShowModal(false)} onSubmit={handleSubmitRequest} />}
    </div>
  );
}
