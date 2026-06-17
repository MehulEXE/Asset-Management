import { useState, useEffect, useRef } from 'react';
import {
  User,
  Camera,
  Trash2,
  Palette,
  AlertTriangle,
  Loader2,
  Check,
  X,
  Calendar,
  Shield,
  AtSign,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import {
  fetchProfile,
  updateProfile,
  uploadAvatar,
  deleteAvatar,
  deleteMyAccount,
  type UserProfile,
} from '../services/authService';

const AUTHOR_COLORS = [
  '#3b9eff', '#11ff99', '#ff801f', '#ffc53d', '#ff2047',
  '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa',
  '#fb923c', '#e879f9', '#2dd4bf', '#facc15', '#818cf8',
];

function ProfilePreviewCard({
  name,
  email,
  role,
  nickname,
  chatColor,
  avatarUrl,
}: {
  name: string;
  email: string;
  role: string;
  nickname: string;
  chatColor: string | null;
  avatarUrl: string | null;
}) {
  const gradient = chatColor
    ? `linear-gradient(135deg, ${chatColor}33, ${chatColor}15)`
    : 'linear-gradient(135deg, var(--surface-elevated), var(--surface-deep))';
  const accentBorder = chatColor
    ? `2px solid ${chatColor}`
    : '2px solid var(--hairline-strong)';

  const createdDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <div className="profile-preview-card">
      <div className="profile-preview-banner" style={{ background: gradient }} />
      <div className="profile-preview-body">
        <div className="profile-preview-avatar" style={{ border: accentBorder }}>
          {avatarUrl ? (
            <img src={avatarUrl} alt={name} />
          ) : (
            <User size={48} style={{ color: 'var(--mute)' }} />
          )}
        </div>

        <h2 className="profile-preview-name">
          {name}
          <span className={`badge badge-${role === 'admin' ? 'info' : 'success'}`} style={{ marginLeft: '10px', verticalAlign: 'middle' }}>
            {role === 'admin' ? 'Admin' : 'User'}
          </span>
        </h2>

        {nickname && (
          <div className="profile-preview-nickname" style={{ color: chatColor || 'var(--charcoal)' }}>
            <AtSign size={14} />
            {nickname}
          </div>
        )}

        <div className="profile-preview-detail">
          <User size={14} />
          {email}
        </div>

        <div className="profile-preview-detail">
          <Calendar size={14} />
          Member since {createdDate}
        </div>

        <div className="profile-preview-section-label">In Query Assist</div>

        <div className="preview-chat-bubble">
          <div className="preview-chat-author" style={{ color: chatColor || 'var(--ink)' }}>
            {nickname || name}
            <span className="preview-chat-badge">you</span>
          </div>
          <div className="preview-chat-time">Today at {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div className="preview-chat-content">
            This is how your messages will appear to others in Query Assist.
          </div>
        </div>
      </div>
    </div>
  );
}

export function UserProfile() {
  const { token, logout } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nickname, setNickname] = useState('');
  const [chatColor, setChatColor] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchProfile(token)
      .then((data) => {
        setProfile(data);
        setNickname(data.nickname);
        setChatColor(data.chat_color);
        setAvatarUrl(data.avatar_url);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [token]);

  const handleSave = async () => {
    if (!token) return;
    setSaving(true);
    try {
      await updateProfile(token, { nickname, chat_color: chatColor });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target?.result as string;
      try {
        await uploadAvatar(token, base64);
        setAvatarUrl(base64);
      } catch {
        // silent
      }
    };
    reader.readAsDataURL(file);
  };

  const handleDeleteAvatar = async () => {
    if (!token) return;
    try {
      await deleteAvatar(token);
      setAvatarUrl(null);
    } catch {
      // silent
    }
  };

  const handleDeleteAccount = async () => {
    if (!token || deleteEmail !== profile?.email) return;
    setDeleting(true);
    try {
      await deleteMyAccount(token);
      await logout();
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="animated-fade" style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--mute)' }}>
        <Loader2 size={28} className="animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="animated-fade" style={{ padding: '48px', textAlign: 'center', color: 'var(--mute)' }}>
        Failed to load profile
      </div>
    );
  }

  return (
    <div className="animated-fade user-profile-page">
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ margin: 0 }}>User Profile</h1>
        <p style={{ color: 'var(--mute)', fontSize: '14px', marginTop: '4px' }}>Manage your account settings and preferences</p>
      </div>

      <div className="user-profile-layout">
        <div className="user-profile-settings" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Account Info */}
          <div className="card">
            <div className="card-header">
              <h2><Shield size={18} /> Account Information</h2>
            </div>
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label className="form-label" style={{ fontSize: '12px', color: 'var(--mute)', marginBottom: '2px' }}>Email</label>
                <div style={{ fontSize: '14px', color: 'var(--ink)', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                  {profile.email}
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', color: 'var(--mute)', marginBottom: '2px' }}>Name</label>
                <div style={{ fontSize: '14px', color: 'var(--ink)', padding: '8px 0', borderBottom: '1px solid var(--hairline)' }}>
                  {profile.name}
                </div>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '12px', color: 'var(--mute)', marginBottom: '2px' }}>Role</label>
                <div style={{ fontSize: '14px', color: 'var(--ink)', padding: '8px 0' }}>
                  <span className={`badge badge-${profile.role === 'admin' ? 'info' : 'success'}`}>
                    {profile.role === 'admin' ? 'Admin' : 'Support Engineer'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Avatar */}
          <div className="card">
            <div className="card-header">
              <h2><Camera size={18} /> Profile Photo</h2>
            </div>
            <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div className="user-profile-avatar">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Avatar" />
                ) : (
                  <User size={40} style={{ color: 'var(--mute)' }} />
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                  <Camera size={14} /> Upload Photo
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                {avatarUrl && (
                  <button className="btn btn-danger" onClick={handleDeleteAvatar} style={{ fontSize: '12px', padding: '6px 12px' }}>
                    <Trash2 size={14} /> Delete
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Nickname */}
          <div className="card">
            <div className="card-header">
              <h2><AtSign size={18} /> Chat Nickname</h2>
            </div>
            <div style={{ padding: '20px' }}>
              <div className="form-group">
                <label className="form-label">
                  Nickname <span style={{ color: 'var(--mute)', fontWeight: 400 }}>(displayed in Query Assist)</span>
                </label>
                <input
                  className="form-control"
                  placeholder="Enter a nickname..."
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  style={{ maxWidth: '400px' }}
                />
              </div>
            </div>
          </div>

          {/* Chat Color */}
          <div className="card">
            <div className="card-header">
              <h2><Palette size={18} /> Chat Name Color</h2>
            </div>
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', marginBottom: '16px' }}>
                <button
                  className={`color-swatch${chatColor === null ? ' selected' : ''}`}
                  onClick={() => setChatColor(null)}
                  title="Random color"
                  style={{
                    background: 'linear-gradient(135deg, #3b9eff, #11ff99, #ff801f, #ffc53d, #ff2047)',
                    width: '32px',
                    height: '32px',
                    borderRadius: '50%',
                    border: chatColor === null ? '3px solid var(--ink)' : '3px solid transparent',
                    cursor: 'pointer',
                  }}
                />
                {AUTHOR_COLORS.map((c) => (
                  <button
                    key={c}
                    className={`color-swatch${chatColor === c ? ' selected' : ''}`}
                    onClick={() => setChatColor(c)}
                    title={c}
                    style={{
                      backgroundColor: c,
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      border: chatColor === c ? '3px solid var(--ink)' : '3px solid transparent',
                      cursor: 'pointer',
                      outline: chatColor === c ? '2px solid var(--ink)' : 'none',
                      outlineOffset: '2px',
                    }}
                  />
                ))}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--charcoal)' }}>
                {chatColor === null
                  ? <span>Random color will be assigned automatically</span>
                  : <span>Selected: <span style={{ color: chatColor, fontWeight: 600 }}>&#9679; {chatColor}</span></span>
                }
              </div>
            </div>
          </div>

          {/* Save */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Save Changes
            </button>
            {saved && <span style={{ color: 'var(--accent-green)', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '4px' }}><Check size={14} /> Saved</span>}
          </div>

          {/* Danger Zone */}
          <div className="danger-zone">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <AlertTriangle size={18} style={{ color: 'var(--accent-red)' }} />
              <h3 style={{ margin: 0, color: 'var(--accent-red)', fontSize: '16px' }}>Danger Zone</h3>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--charcoal)', marginBottom: '16px' }}>
              Once you delete your account, there is no going back. Please be certain.
            </p>
            <button className="btn btn-danger" onClick={() => setShowDeleteConfirm(true)}>
              <Trash2 size={14} /> Delete My Account
            </button>
          </div>
        </div>

        <div className="user-profile-preview">
          <ProfilePreviewCard
            name={profile.name}
            email={profile.email}
            role={profile.role}
            nickname={nickname}
            chatColor={chatColor}
            avatarUrl={avatarUrl}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="modal-overlay" onClick={() => { if (!deleting) setShowDeleteConfirm(false); }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ color: 'var(--accent-red)' }}>Delete Account</h2>
              <button className="btn-icon" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--danger-light)', borderRadius: 'var(--border-radius-md)', marginBottom: '16px', border: '1px solid var(--accent-red)' }}>
                <AlertTriangle size={20} style={{ color: 'var(--accent-red)', flexShrink: 0 }} />
                <p style={{ fontSize: '13px', color: 'var(--body)', margin: 0 }}>
                  This will permanently delete your account and all associated data. <strong>This action cannot be undone.</strong>
                </p>
              </div>
              <p style={{ fontSize: '14px', color: 'var(--body)', marginBottom: '12px' }}>
                Type <strong style={{ color: 'var(--accent-red)' }}>{profile.email}</strong> to confirm:
              </p>
              <input
                className="form-control"
                placeholder={profile.email}
                value={deleteEmail}
                onChange={(e) => setDeleteEmail(e.target.value)}
                style={{ borderColor: deleteEmail === profile.email ? 'var(--accent-red)' : 'var(--hairline-strong)' }}
              />
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowDeleteConfirm(false)} disabled={deleting}>Cancel</button>
              <button
                className="btn btn-danger"
                onClick={handleDeleteAccount}
                disabled={deleteEmail !== profile.email || deleting}
              >
                {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
