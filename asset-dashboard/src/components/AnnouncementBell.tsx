import { useState, useEffect, useCallback } from 'react';
import { Megaphone } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../services/apiConfig';

interface AnnouncementBellProps {
  onClick: () => void;
}

export function AnnouncementBell({ onClick }: AnnouncementBellProps) {
  const { token } = useAuth();
  const [unseenCount, setUnseenCount] = useState(0);
  const [hasUnseen, setHasUnseen] = useState(false);

  const fetchUnseen = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/announcements/unseen-count'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUnseenCount(data.count);
        setHasUnseen(data.count > 0);
      }
    } catch {
      // silent
    }
  }, [token]);

  useEffect(() => {
    fetchUnseen();
    const interval = setInterval(fetchUnseen, 5000);
    return () => clearInterval(interval);
  }, [fetchUnseen]);

  return (
    <button className={`btn-icon announcement-bell${hasUnseen ? ' has-unseen' : ''}`} onClick={onClick} title="Announcements">
      <Megaphone size={20} />
      {unseenCount > 0 && (
        <span className="announcement-bell-badge">{unseenCount > 99 ? '99+' : unseenCount}</span>
      )}
    </button>
  );
}
