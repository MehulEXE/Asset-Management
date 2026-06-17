import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, Plus, Send, CheckCircle, ChevronDown, ChevronRight, Clock, Loader2, RefreshCw, X, Users, Lock, AtSign } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../services/apiConfig';

interface Thread {
  id: string;
  title: string;
  description: string;
  created_by_email: string;
  created_by_name: string;
  status: 'open' | 'solved';
  created_at: string;
  solved_at?: string;
  auto_solved?: boolean;
  comment_count?: number;
  mentioned_emails?: string;
  comments?: Comment[];
}

interface Comment {
  id: string;
  thread_id: string;
  user_email: string;
  user_name: string;
  content: string;
  created_at: string;
}

interface AppUser {
  name: string;
  email: string;
}

const AUTHOR_COLORS = [
  '#3b9eff', '#11ff99', '#ff801f', '#ffc53d', '#ff2047',
  '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa',
  '#fb923c', '#e879f9', '#2dd4bf', '#facc15', '#818cf8',
];

function hashColor(email: string): string {
  let hash = 0;
  for (let i = 0; i < email.length; i++) {
    hash = email.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AUTHOR_COLORS[Math.abs(hash) % AUTHOR_COLORS.length];
}

export function QueryAssist() {
  const { currentUser, token } = useAuth();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [threadDetails, setThreadDetails] = useState<Record<string, Thread>>({});
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [commentText, setCommentText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [solvingId, setSolvingId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<AppUser[]>([]);
  const [selectedMentions, setSelectedMentions] = useState<AppUser[]>([]);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStart, setMentionStart] = useState(0);

  useEffect(() => {
    if (!token) return;
    fetch(apiUrl('/api/query-assist/users'), {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok && r.json()).then(d => { if (d) setAllUsers(d); }).catch(() => {});
  }, [token]);

  const fetchThreads = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(apiUrl('/api/query-assist/threads'), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setThreads(await res.json());
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchThreads();
    const interval = setInterval(fetchThreads, 5000);
    return () => clearInterval(interval);
  }, [fetchThreads]);

  const loadThreadDetail = async (threadId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/query-assist/threads/${threadId}`), {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setThreadDetails(prev => ({ ...prev, [threadId]: data }));
      }
    } catch {
      // silent
    }
  };

  const toggleExpand = async (threadId: string) => {
    if (expandedId === threadId) {
      setExpandedId(null);
    } else {
      setExpandedId(threadId);
      await loadThreadDetail(threadId);
    }
  };

  const handleDescriptionChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    const pos = e.target.selectionStart ?? 0;
    setNewDescription(value);
    const beforeCursor = value.slice(0, pos);
    const atIndex = beforeCursor.lastIndexOf('@');
    if (atIndex !== -1) {
      const afterAt = value.slice(atIndex + 1, pos);
      if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
        setMentionQuery(afterAt);
        setMentionOpen(true);
        setMentionStart(atIndex);
        return;
      }
    }
    setMentionOpen(false);
  };

  const selectMention = (user: AppUser) => {
    const before = newDescription.slice(0, mentionStart);
    const after = newDescription.slice(mentionStart + 1 + mentionQuery.length);
    const tag = `@${user.name} `;
    setNewDescription(before + tag + after);
    setSelectedMentions(prev => prev.some(u => u.email === user.email) ? prev : [...prev, user]);
    setMentionOpen(false);
  };

  const removeMention = (email: string) => {
    setSelectedMentions(prev => prev.filter(u => u.email !== email));
  };

  const handleCreateThread = async () => {
    if (!token || !newTitle.trim() || !newDescription.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/query-assist/threads'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newDescription.trim(),
          mentioned_emails: selectedMentions.map(u => u.email),
        }),
      });
      if (res.ok) {
        setNewTitle('');
        setNewDescription('');
        setSelectedMentions([]);
        setShowNewThread(false);
        await fetchThreads();
      }
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddComment = async (threadId: string) => {
    if (!token || !commentText.trim()) return;
    const text = commentText.trim();
    setCommentText('');
    try {
      const res = await fetch(apiUrl(`/api/query-assist/threads/${threadId}/comments`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        await loadThreadDetail(threadId);
      }
    } catch {
      // silent
    }
  };

  const handleMarkSolved = async (threadId: string) => {
    if (!token) return;
    setSolvingId(threadId);
    try {
      const res = await fetch(apiUrl(`/api/query-assist/threads/${threadId}/solved`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchThreads();
        setThreadDetails(prev => {
          const next = { ...prev };
          if (next[threadId]) {
            next[threadId] = { ...next[threadId], status: 'solved', auto_solved: false };
          }
          return next;
        });
      }
    } catch {
      // silent
    } finally {
      setSolvingId(null);
    }
  };

  const refreshDetail = async () => {
    if (expandedId) {
      await loadThreadDetail(expandedId);
    }
  };

  const statusStyle = (thread: Thread) => {
    if (thread.status === 'open') {
      return {
        borderLeft: '3px solid var(--accent-red)',
        background: 'rgba(255, 32, 71, 0.04)',
      };
    }
    if (thread.auto_solved) {
      return {
        borderLeft: '3px solid var(--mute)',
        opacity: 0.7,
      };
    }
    return {
      borderLeft: '3px solid var(--accent-green)',
      background: 'rgba(17, 255, 153, 0.04)',
    };
  };

  const statusBadge = (thread: Thread) => {
    if (thread.status === 'open') {
      return <span className="badge badge-danger"><Clock size={12} /> Open</span>;
    }
    if (thread.auto_solved) {
      return <span className="badge" style={{ background: 'var(--surface-elevated)', color: 'var(--mute)', border: '1px solid var(--hairline-strong)' }}>Solved</span>;
    }
    return <span className="badge badge-success"><CheckCircle size={12} /> Solved</span>;
  };

  const expandedThread = expandedId ? threadDetails[expandedId] : null;

  return (
    <div className="animated-fade">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ margin: 0 }}>Query Assist</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-secondary" onClick={fetchThreads} disabled={isLoading}>
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
          <button className="btn btn-primary" onClick={() => setShowNewThread(true)}>
            <Plus size={18} /> New Query
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid-kpi" style={{ marginBottom: '20px' }}>
        <div className="card-kpi" style={{ borderLeft: '3px solid var(--accent-red)' }}>
          <div className="kpi-icon" style={{ background: 'var(--danger-light)', color: 'var(--danger)' }}>
            <Clock size={24} />
          </div>
          <div className="kpi-info">
            <h3>Open</h3>
            <p>{threads.filter(t => t.status === 'open').length}</p>
          </div>
        </div>
        <div className="card-kpi" style={{ borderLeft: '3px solid var(--accent-green)' }}>
          <div className="kpi-icon" style={{ background: 'var(--success-light)', color: 'var(--success)' }}>
            <CheckCircle size={24} />
          </div>
          <div className="kpi-info">
            <h3>Solved</h3>
            <p>{threads.filter(t => t.status === 'solved' && !t.auto_solved).length}</p>
          </div>
        </div>
        <div className="card-kpi" style={{ borderLeft: '3px solid var(--mute)' }}>
          <div className="kpi-icon" style={{ background: 'var(--surface-elevated)', color: 'var(--mute)' }}>
            <MessageSquare size={24} />
          </div>
          <div className="kpi-info">
            <h3>Auto-Closed</h3>
            <p>{threads.filter(t => t.auto_solved).length}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
          <Loader2 size={28} className="animate-spin" />
        </div>
      ) : threads.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-tertiary)' }}>
          <MessageSquare size={40} style={{ margin: '0 auto 12px', opacity: 0.3 }} />
          <p>No queries yet. Raise your first issue or question.</p>
          <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => setShowNewThread(true)}>
            <Plus size={18} /> New Query
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {threads.map(thread => (
            <div key={thread.id} className="card" style={{ padding: '16px 20px', cursor: 'pointer', ...statusStyle(thread) }}>
              <div onClick={() => toggleExpand(thread.id)} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                <div style={{ marginTop: '2px', color: 'var(--charcoal)', flexShrink: 0 }}>
                  {expandedId === thread.id ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
                    <span style={{ fontWeight: 500, fontSize: '15px', color: 'var(--ink)' }}>{thread.title}</span>
                    {thread.mentioned_emails && thread.mentioned_emails !== '[]' && (
                      <span title="Private thread" style={{ color: 'var(--charcoal)', display: 'inline-flex', alignItems: 'center' }}>
                        <Lock size={12} />
                      </span>
                    )}
                    {statusBadge(thread)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--charcoal)' }}>
                    <span>by <strong style={{ color: hashColor(thread.created_by_email) }}>{thread.created_by_name}</strong></span>
                    <span>{new Date(thread.created_at).toLocaleString()}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MessageSquare size={12} /> {thread.comment_count ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              {expandedId === thread.id && expandedThread && (
                <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--hairline)', cursor: 'default' }}>
                  {/* Description */}
                  <div style={{ padding: '12px 16px', background: 'var(--surface-elevated)', borderRadius: 'var(--border-radius-md)', marginBottom: '16px', fontSize: '14px', color: 'var(--body)', lineHeight: '1.6' }}>
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                      a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)', textDecoration: 'underline' }}>{children}</a>,
                      code: ({ className, children, ...props }) => {
                        const isInline = !className;
                        if (isInline) {
                          return <code style={{ background: 'var(--surface-deep)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{children}</code>;
                        }
                        return <pre style={{ background: 'var(--surface-deep)', padding: '12px 16px', borderRadius: 'var(--border-radius-md)', overflow: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono)', border: '1px solid var(--hairline)' }}><code className={className} {...props}>{children}</code></pre>;
                      },
                      ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>{children}</ul>,
                      ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>{children}</ol>,
                      blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid var(--hairline-strong)', paddingLeft: '12px', margin: '8px 0', color: 'var(--charcoal)' }}>{children}</blockquote>,
                    }}>
                      {expandedThread.description}
                    </ReactMarkdown>
                  </div>

                  {/* Solved button for raiser */}
                  {thread.status === 'open' && currentUser?.email === thread.created_by_email && (
                    <div style={{ marginBottom: '16px' }}>
                      <button
                        className="btn btn-primary"
                        style={{ background: 'var(--accent-green)', borderColor: 'var(--accent-green)', color: '#000' }}
                        onClick={() => handleMarkSolved(thread.id)}
                        disabled={solvingId === thread.id}
                      >
                        {solvingId === thread.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                        Mark as Solved
                      </button>
                      <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--mute)' }}>
                        This will auto-solve after 24h if not clicked
                      </span>
                    </div>
                  )}

                  {/* Comments */}
                  <div style={{ marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--charcoal)' }}>
                        Comments ({expandedThread.comments?.length || 0})
                      </span>
                      <button className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '12px', height: 'auto' }} onClick={refreshDetail}>
                        <RefreshCw size={12} /> Refresh
                      </button>
                    </div>
                    {(!expandedThread.comments || expandedThread.comments.length === 0) ? (
                      <div style={{ padding: '16px', textAlign: 'center', color: 'var(--mute)', fontSize: '13px', border: '1px dashed var(--hairline-strong)', borderRadius: 'var(--border-radius-md)' }}>
                        No comments yet. Be the first to help!
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {expandedThread.comments.map((comment) => (
                          <div key={comment.id} style={{
                            padding: '12px 16px',
                            background: 'var(--surface-elevated)',
                            borderRadius: 'var(--border-radius-md)',
                            border: '1px solid var(--hairline)',
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px', color: hashColor(comment.user_email) }}>
                                {comment.user_name}
                                {comment.user_email === thread.created_by_email && (
                                  <span style={{ fontSize: '11px', color: 'var(--mute)', marginLeft: '6px', fontWeight: 400 }}>(author)</span>
                                )}
                              </span>
                              <span style={{ fontSize: '11px', color: 'var(--mute)' }}>
                                {new Date(comment.created_at).toLocaleString()}
                              </span>
                            </div>
                            <div style={{ fontSize: '14px', color: 'var(--body)', lineHeight: '1.6' }}>
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                                a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--link)', textDecoration: 'underline' }}>{children}</a>,
                                code: ({ className, children, ...props }) => {
                                  const isInline = !className;
                                  if (isInline) {
                                    return <code style={{ background: 'var(--surface-deep)', padding: '2px 6px', borderRadius: '4px', fontSize: '13px', fontFamily: 'var(--font-mono)' }}>{children}</code>;
                                  }
                                  return <pre style={{ background: 'var(--surface-deep)', padding: '12px 16px', borderRadius: 'var(--border-radius-md)', overflow: 'auto', fontSize: '13px', fontFamily: 'var(--font-mono)', border: '1px solid var(--hairline)' }}><code className={className} {...props}>{children}</code></pre>;
                                },
                                ul: ({ children }) => <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>{children}</ul>,
                                ol: ({ children }) => <ol style={{ paddingLeft: '20px', margin: '4px 0' }}>{children}</ol>,
                                blockquote: ({ children }) => <blockquote style={{ borderLeft: '3px solid var(--hairline-strong)', paddingLeft: '12px', margin: '8px 0', color: 'var(--charcoal)' }}>{children}</blockquote>,
                              }}>
                                {comment.content}
                              </ReactMarkdown>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Comment input */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
                    <textarea
                      className="form-control"
                      placeholder="Write a comment..."
                      value={commentText}
                      onChange={e => setCommentText(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddComment(thread.id);
                        }
                      }}
                      style={{ minHeight: '40px', resize: 'vertical', flex: 1 }}
                    />
                    <button
                      className="btn btn-primary"
                      onClick={() => handleAddComment(thread.id)}
                      disabled={!commentText.trim()}
                      style={{ height: '40px', flexShrink: 0 }}
                    >
                      <Send size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New thread modal */}
      {showNewThread && (
        <div className="modal-overlay" onClick={() => setShowNewThread(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Query</h2>
              <button className="btn-icon" onClick={() => setShowNewThread(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Title</label>
                <input
                  className="form-control"
                  placeholder="Brief summary of your issue"
                  value={newTitle}
                  onChange={e => setNewTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Description <span style={{ fontSize: '12px', color: 'var(--mute)', fontWeight: 400 }}>— Use @ to mention users for private visibility</span></label>
                <textarea
                  className="form-control"
                  placeholder="Describe your query in detail..."
                  value={newDescription}
                  onChange={handleDescriptionChange}
                  style={{ minHeight: '120px' }}
                />
                {selectedMentions.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    <Users size={14} style={{ color: 'var(--charcoal)', marginRight: '4px' }} />
                    {selectedMentions.map(u => (
                      <span key={u.email} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: 'var(--surface-elevated)', borderRadius: '12px', fontSize: '12px', border: '1px solid var(--hairline-strong)' }}>
                        <Lock size={10} />
                        {u.name}
                        <span style={{ cursor: 'pointer', color: 'var(--mute)', marginLeft: '2px' }} onClick={() => removeMention(u.email)}><X size={12} /></span>
                      </span>
                    ))}
                  </div>
                )}
                {mentionOpen && (
                  <div style={{ position: 'relative', marginTop: '4px' }}>
                    <div style={{ position: 'absolute', zIndex: 100, top: 0, left: 0, right: 0, background: 'var(--surface)', borderRadius: 'var(--border-radius-md)', border: '1px solid var(--hairline-strong)', boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: '200px', overflowY: 'auto' }}>
                      {allUsers
                        .filter(u => u.email !== currentUser?.email && (u.name.toLowerCase().includes(mentionQuery.toLowerCase()) || u.email.toLowerCase().includes(mentionQuery.toLowerCase())))
                        .slice(0, 10)
                        .map(u => (
                          <div key={u.email} onClick={() => selectMention(u)} style={{ padding: '8px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', borderBottom: '1px solid var(--hairline)' }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-elevated)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            <AtSign size={13} style={{ color: 'var(--charcoal)' }} />
                            <span style={{ fontWeight: 500 }}>{u.name}</span>
                            <span style={{ color: 'var(--mute)', fontSize: '12px' }}>{u.email}</span>
                          </div>
                        ))}
                      {allUsers.filter(u => u.email !== currentUser?.email && (u.name.toLowerCase().includes(mentionQuery.toLowerCase()) || u.email.toLowerCase().includes(mentionQuery.toLowerCase()))).length === 0 && (
                        <div style={{ padding: '12px', color: 'var(--charcoal)', fontSize: '13px', textAlign: 'center' }}>No users found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowNewThread(false)}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={handleCreateThread}
                disabled={!newTitle.trim() || !newDescription.trim() || submitting}
              >
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                Submit Query
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
