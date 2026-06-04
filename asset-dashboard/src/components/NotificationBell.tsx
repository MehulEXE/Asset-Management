import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, Check } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../services/apiConfig';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
}

export function NotificationBell() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/notifications'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unread_count || 0);
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 8000);
    return () => clearInterval(interval);
  }, [fetchNotifs]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleMarkRead = async (id: string) => {
    if (!token) return;
    await fetch(apiUrl(`/api/notifications/${id}/read`), {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}` },
    });
    setNotifications(notifications.map(n => n.id === id ? { ...n, is_read: true } : n));
    setUnreadCount(Math.max(0, unreadCount - 1));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn btn-secondary" style={{ position: 'relative', padding: '6px' }} onClick={() => setOpen(!open)} title="Notifications">
        <Bell size={18} />
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            background: 'var(--danger)', color: '#fff',
            fontSize: '0.65rem', fontWeight: 'bold',
            width: 16, height: 16, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, marginTop: 8,
          width: 340, maxHeight: 400, overflowY: 'auto',
          background: 'var(--bg-secondary)', border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius)', boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
          zIndex: 1000,
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: 'bold', fontSize: '0.9rem' }}>
            Notifications
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.85rem' }}>
              No notifications yet.
            </div>
          ) : (
            notifications.map(n => (
              <div key={n.id} onClick={() => !n.is_read && handleMarkRead(n.id)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--border-color)',
                  cursor: n.is_read ? 'default' : 'pointer',
                  background: n.is_read ? 'transparent' : 'var(--hover-bg)',
                  transition: 'background 0.2s',
                }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ fontWeight: n.is_read ? 'normal' : '600', fontSize: '0.85rem', marginBottom: 2 }}>
                    {n.title}
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>
                      {timeAgo(n.created_at)}
                    </span>
                    {!n.is_read && (
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--primary)', display: 'inline-block' }} />
                    )}
                  </div>
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  {n.message}
                </div>
                {!n.is_read && (
                  <div style={{ marginTop: 6, display: 'flex', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 3 }}>
                      <Check size={12} /> Mark read
                    </span>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
