import { useState, useEffect, useCallback } from 'react';
import { Users, ShieldCheck, User, Search, RefreshCw, Loader2, Laptop } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { authService, type UserWithDevices } from '../services/authService';

interface UserManagementProps {
  refreshKey?: number;
}

export function UserManagement({ refreshKey = 0 }: UserManagementProps) {
  const { token } = useAuth();

  const [users, setUsers] = useState<UserWithDevices[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [updatingEmail, setUpdatingEmail] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchUsers = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const data = await authService.listUsers(token);
      setUsers(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load users.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers, refreshKey]);

  // Auto-dismiss notifications
  useEffect(() => {
    if (!error && !success) return;
    const timer = setTimeout(() => { setError(''); setSuccess(''); }, 4000);
    return () => clearTimeout(timer);
  }, [error, success]);

  const handleToggleRole = async (user: UserWithDevices) => {
    if (!token) return;
    const newRole = user.role === 'admin' ? 'user' : 'admin';
    const action = newRole === 'admin' ? 'promote' : 'demote';

    if (!window.confirm(`Are you sure you want to ${action} ${user.name} (${user.email}) to ${newRole}?`)) {
      return;
    }

    setUpdatingEmail(user.email);
    setError('');
    setSuccess('');

    try {
      await authService.setUserRole(token, user.email, newRole);
      setSuccess(`${user.name} has been ${action}d to ${newRole}.`);
      await fetchUsers(); // Refresh the list
    } catch (err: any) {
      setError(err.message || `Failed to ${action} user.`);
    } finally {
      setUpdatingEmail(null);
    }
  };

  const adminCount = users.filter(u => u.role === 'admin').length;

  const filteredUsers = users.filter(u => {
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q)
      || u.email.toLowerCase().includes(q)
      || u.role.toLowerCase().includes(q);
  });

  return (
    <div className="animated-fade">
      {/* Notifications */}
      {error && (
        <div className="login-toast login-toast-error animated-fade" style={{ marginBottom: '16px' }}>
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="login-toast login-toast-success animated-fade" style={{ marginBottom: '16px' }}>
          <span>{success}</span>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid-kpi">
        <div className="card-kpi">
          <div className="kpi-icon">
            <Users size={24} />
          </div>
          <div className="kpi-info">
            <h3>Total Users</h3>
            <p>{users.length}</p>
          </div>
        </div>
        <div className="card-kpi">
          <div className="kpi-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            <ShieldCheck size={24} />
          </div>
          <div className="kpi-info">
            <h3>Admins</h3>
            <p>{adminCount}</p>
          </div>
        </div>
        <div className="card-kpi">
          <div className="kpi-icon" style={{ background: 'var(--warning-light)', color: 'var(--warning)' }}>
            <User size={24} />
          </div>
          <div className="kpi-info">
            <h3>Regular Users</h3>
            <p>{users.length - adminCount}</p>
          </div>
        </div>
        <div className="card-kpi">
          <div className="kpi-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
            <Laptop size={24} />
          </div>
          <div className="kpi-info">
            <h3>Total Allocated</h3>
            <p>{users.reduce((sum, u) => sum + (u.device_count || 0), 0)}</p>
          </div>
        </div>
      </div>

      {/* Users Table Card */}
      <div className="card">
        <div className="card-header">
          <h2>Registered Users</h2>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                className="form-control"
                placeholder="Search users…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '36px', width: '260px' }}
              />
            </div>
            <button className="btn btn-secondary" onClick={fetchUsers} disabled={isLoading}>
              <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
            <Loader2 size={28} className="animate-spin" />
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Devices</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-tertiary)' }}>
                      No users found.
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map(user => {
                    const isLastAdmin = user.role === 'admin' && adminCount <= 1;
                    const isUpdating = updatingEmail === user.email;

                    return (
                      <tr key={user.email}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div className="user-avatar-sm">
                              {user.name.charAt(0).toUpperCase()}
                            </div>
                            <strong>{user.name}</strong>
                          </div>
                        </td>
                        <td style={{ color: 'var(--text-secondary)' }}>{user.email}</td>
                        <td>
                          <span className={`badge ${user.role === 'admin' ? 'badge-success' : 'badge-info'}`}>
                            {user.role === 'admin' ? '🛡 Admin' : '👤 User'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${user.device_count > 0 ? 'badge-warning' : 'badge-info'}`}>
                            {user.device_count} device{user.device_count !== 1 ? 's' : ''}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
                          {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td>
                          {user.role === 'admin' ? (
                            <button
                              className="btn btn-secondary"
                              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                              onClick={() => handleToggleRole(user)}
                              disabled={isLastAdmin || isUpdating}
                              title={isLastAdmin ? 'Cannot demote the last admin' : 'Demote to User'}
                            >
                              {isUpdating ? <Loader2 size={14} className="animate-spin" /> : '↓ Demote'}
                            </button>
                          ) : (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: '0.8rem', padding: '6px 12px' }}
                              onClick={() => handleToggleRole(user)}
                              disabled={isUpdating}
                              title="Promote to Admin"
                            >
                              {isUpdating ? <Loader2 size={14} className="animate-spin" /> : '↑ Promote'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
