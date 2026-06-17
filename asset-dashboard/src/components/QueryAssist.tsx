import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MessageSquare, Plus, Send, CheckCircle, ChevronDown, ChevronRight, Clock, Loader2, RefreshCw, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiUrl } from '../services/apiConfig';
import { fetchProfile } from '../services/authService';

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

const AUTHOR_COLORS = [
  '#3b9eff', '#11ff99', '#ff801f', '#ffc53d', '#ff2047',
  '#a78bfa', '#f472b6', '#34d399', '#fbbf24', '#60a5fa',
  '#fb923c', '#e879f9', '#2dd4bf', '#facc15', '#818cf8',
];

function hashColor(email: string, userColors?: Record<string, string>): string {
  if (userColors?.[email]) return userColors[email];
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
  const [userColors, setUserColors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    fetchProfile(token).then(p => {
      if (p.chat_color) {
        setUserColors(prev => ({ ...prev, [p.email]: p.chat_color as string }));
      }
    }).catch(() => {});
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
    const interval = setInterval(() => {
      fetchThreads();
      if (expandedId) {
        loadThreadDetail(expandedId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchThreads, expandedId]);

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

  const handleCreateThread = async () => {
    if (!token || !newTitle.trim() || !newDescription.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl('/api/query-assist/threads'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle.trim(), description: newDescription.trim() }),
      });
      if (res.ok) {
        setNewTitle('');
        setNewDescription('');
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
                    {statusBadge(thread)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--charcoal)' }}>
                    <span>by <strong style={{ color: hashColor(thread.created_by_email, userColors) }}>{thread.created_by_name}</strong></span>
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
                              <span style={{ fontWeight: 600, fontSize: '13px', color: hashColor(comment.user_email, userColors) }}>
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
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  placeholder="Describe your query in detail..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  style={{ minHeight: '120px' }}
                />
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
