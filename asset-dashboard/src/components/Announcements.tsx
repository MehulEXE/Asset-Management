import { useState, useEffect, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  X,
  Send,
  ImageIcon,
  Loader2,
  BarChart3,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../services/apiConfig';

interface Reaction {
  id: string;
  announcement_id: string;
  user_email: string;
  emoji: string;
}

interface Announcement {
  id: string;
  content: string;
  created_by_email: string;
  created_by_name: string;
  attachments: any[];
  poll: any | null;
  created_at: string;
  reactions: Reaction[];
  is_read?: boolean;
}

const EMOJI_LIST = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🎉', '🔥'];

interface AnnouncementsProps {
  onClose: () => void;
}

export function Announcements({ onClose }: AnnouncementsProps) {
  const { currentUser, token, isAdmin } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [composeContent, setComposeContent] = useState('');
  const [composeImages, setComposeImages] = useState<string[]>([]);
  const [showPollBuilder, setShowPollBuilder] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [sending, setSending] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const fetchAnnouncements = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/announcements'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAnnouncements(data);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAnnouncements();
    const interval = setInterval(fetchAnnouncements, 5000);
    return () => clearInterval(interval);
  }, [fetchAnnouncements]);

  // Mark all as read
  useEffect(() => {
    if (!token || announcements.length === 0) return;
    const unread = announcements.filter(a => !a.is_read);
    unread.forEach(a => {
      fetch(apiUrl(`/api/announcements/${a.id}/read`), {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    });
  }, [announcements, token]);

  const handleSend = async () => {
    if (!token || !composeContent.trim()) return;
    setSending(true);
    try {
      const body: any = { content: composeContent.trim() };
      if (composeImages.length > 0) {
        body.attachments = composeImages.map(url => ({ type: 'image', url }));
      }
      if (showPollBuilder && pollQuestion.trim() && pollOptions.filter(o => o.trim()).length >= 2) {
        body.poll = {
          question: pollQuestion.trim(),
          options: pollOptions.filter(o => o.trim()).map(o => o.trim()),
        };
      }
      const res = await fetch(apiUrl('/api/announcements'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setComposeContent('');
        setComposeImages([]);
        setShowPollBuilder(false);
        setPollQuestion('');
        setPollOptions(['', '']);
        await fetchAnnouncements();
        if (listRef.current) {
          listRef.current.scrollTop = 0;
        }
      }
    } catch {
      // silent
    } finally {
      setSending(false);
    }
  };

  const handleImageUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      setComposeImages(prev => [...prev, base64]);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleReact = async (announcementId: string, emoji: string) => {
    if (!token) return;
    try {
      await fetch(apiUrl(`/api/announcements/${announcementId}/reactions`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ emoji }),
      });
      await fetchAnnouncements();
    } catch {
      // silent
    }
  };

  const handleVote = async (announcementId: string, optionIndex: number) => {
    if (!token) return;
    try {
      await fetch(apiUrl(`/api/announcements/${announcementId}/poll/vote`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ option_index: optionIndex }),
      });
      await fetchAnnouncements();
    } catch {
      // silent
    }
  };

  const userReaction = (reactions: Reaction[], emoji: string) =>
    reactions.some(r => r.emoji === emoji && r.user_email === currentUser?.email);

  const reactionCount = (reactions: Reaction[], emoji: string) =>
    reactions.filter(r => r.emoji === emoji).length;

  const addPollOption = () => setPollOptions(prev => [...prev, '']);
  const removePollOption = (idx: number) => setPollOptions(prev => prev.filter((_, i) => i !== idx));
  const updatePollOption = (idx: number, val: string) => {
    setPollOptions(prev => prev.map((o, i) => i === idx ? val : o));
  };

  const totalVotes = (poll: any) => {
    if (!poll || !poll.votes) return 0;
    return poll.votes.reduce((sum: number, v: any) => sum + (v.voters?.length || 0), 0);
  };

  const userVoteIndex = (poll: any) => {
    if (!poll || !poll.votes || !currentUser) return -1;
    for (let i = 0; i < poll.votes.length; i++) {
      if (poll.votes[i]?.voters?.includes(currentUser.email)) return i;
    }
    return -1;
  };

  return (
    <div className="modal-overlay announcements-overlay" onClick={onClose}>
      <div className="modal-content announcements-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2><Megaphone size={20} /> Announcements</h2>
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="announcements-body" ref={listRef}>
          {isAdmin && (
            <div className="announcements-compose">
              <textarea
                className="form-control announce-compose-input"
                placeholder="Write an announcement... (Markdown supported)"
                value={composeContent}
                onChange={e => setComposeContent(e.target.value)}
              />
              <div className="announce-compose-actions">
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={handleImageUpload} title="Attach image">
                    <ImageIcon size={16} />
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileChange} />
                  <button
                    className={`btn btn-secondary btn-sm${showPollBuilder ? ' active' : ''}`}
                    onClick={() => setShowPollBuilder(!showPollBuilder)}
                    title="Add poll"
                  >
                    <BarChart3 size={16} />
                  </button>
                </div>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleSend}
                  disabled={!composeContent.trim() || sending}
                >
                  {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                  Send
                </button>
              </div>

              {composeImages.length > 0 && (
                <div className="announce-compose-images">
                  {composeImages.map((img, i) => (
                    <div key={i} className="announce-compose-image-thumb">
                      <img src={img} alt="" />
                      <button className="btn-icon btn-icon-sm" onClick={() => setComposeImages(prev => prev.filter((_, j) => j !== i))}><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}

              {showPollBuilder && (
                <div className="announce-poll-builder">
                  <input
                    className="form-control"
                    placeholder="Poll question..."
                    value={pollQuestion}
                    onChange={e => setPollQuestion(e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                  {pollOptions.map((opt, i) => (
                    <div key={i} className="announce-poll-option-row">
                      <input
                        className="form-control"
                        placeholder={`Option ${i + 1}`}
                        value={opt}
                        onChange={e => updatePollOption(i, e.target.value)}
                      />
                      {pollOptions.length > 2 && (
                        <button className="btn-icon btn-icon-sm" onClick={() => removePollOption(i)}><Trash2 size={14} /></button>
                      )}
                    </div>
                  ))}
                  <button className="btn btn-secondary btn-sm" onClick={addPollOption}>
                    <Plus size={14} /> Add option
                  </button>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--mute)' }}>
              <Loader2 size={28} className="animate-spin" />
            </div>
          ) : announcements.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--mute)' }}>
              <div style={{ margin: '0 auto 12px', opacity: 0.3 }}><Megaphone size={40} /></div>
              <p>No announcements yet.</p>
            </div>
          ) : (
            <div className="announcements-list">
              {announcements.map(a => (
                <div key={a.id} className={`announcement-card${!a.is_read ? ' unread' : ''}`}>
                  <div className="announcement-header">
                    <span className="announcement-author">{a.created_by_name}</span>
                    <span className="announcement-time">{new Date(a.created_at).toLocaleString()}</span>
                  </div>

                  <div className="announcement-content markdown-body">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)', textDecoration: 'underline' }}>{children}</a>,
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) return <code style={{ background: 'var(--surface-deep)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px' }}>{children}</code>;
                        return <pre style={{ background: 'var(--surface-deep)', padding: '12px', borderRadius: 'var(--border-radius-md)', overflow: 'auto', fontSize: '13px' }}><code className={className} {...props}>{children}</code></pre>;
                      },
                    }}>
                      {a.content}
                    </ReactMarkdown>
                  </div>

                  {a.attachments && Array.isArray(a.attachments) && a.attachments.length > 0 && (
                    <div className="announcement-attachments">
                      {a.attachments.map((att: any, i: number) => (
                        att.type === 'image' ? (
                          <div key={i} className="announcement-image-wrapper">
                            <img src={att.url} alt="" className="announcement-image" />
                          </div>
                        ) : null
                      ))}
                    </div>
                  )}

                  {a.poll && (
                    <div className="announcement-poll">
                      <h4>{a.poll.question}</h4>
                      {a.poll.options.map((opt: string, i: number) => {
                        const votes = a.poll.votes?.[i]?.voters || [];
                        const count = votes.length;
                        const total = totalVotes(a.poll);
                        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                        const isUserVote = userVoteIndex(a.poll) === i;
                        return (
                          <div
                            key={i}
                            className={`announcement-poll-option${isUserVote ? ' voted' : ''}`}
                            onClick={() => handleVote(a.id, i)}
                          >
                            <div className="announcement-poll-bar" style={{ width: `${pct}%` }} />
                            <span className="announcement-poll-label">{opt}</span>
                            <span className="announcement-poll-pct">{pct}%</span>
                          </div>
                        );
                      })}
                      <div className="announcement-poll-total">{totalVotes(a.poll)} vote{totalVotes(a.poll) !== 1 ? 's' : ''}</div>
                    </div>
                  )}

                  <div className="announcement-reactions">
                    {EMOJI_LIST.map(emoji => {
                      const count = reactionCount(a.reactions, emoji);
                      const isActive = userReaction(a.reactions, emoji);
                      return (
                        <button
                          key={emoji}
                          className={`announcement-reaction${isActive ? ' active' : ''}`}
                          onClick={() => handleReact(a.id, emoji)}
                        >
                          {emoji} {count > 0 && <span>{count}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Megaphone({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      <line x1="14" y1="7" x2="21" y2="7" />
      <line x1="14" y1="11" x2="21" y2="11" />
    </svg>
  );
}
