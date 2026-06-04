import React, { useState } from 'react';
import { Bot, Send, Sparkles, Terminal, FileSpreadsheet, ShieldAlert, Database } from 'lucide-react';

import API_BASE from '../services/apiConfig';

interface QueryResult {
  results: Record<string, unknown>[];
  sql: string;
  summary: string;
  count: number;
}

interface Message {
  sender: 'user' | 'assistant';
  text: string;
  sql?: string;
  data?: Record<string, unknown>[];
}

export const AIAssistant: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    { sender: 'assistant', text: "Hello! I am your ITAM AI Assistant. Ask me about warranties, software, hardware specs, purchases, or anything in your asset inventory. I'll query the database and show you live results." }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);

  const sendQuery = async (queryText: string) => {
    setMessages(prev => [...prev, { sender: 'user', text: queryText }]);
    setInputValue('');
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/v1/ai/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryText }),
      });
      const result: QueryResult = await res.json();

      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: result.summary,
        sql: result.sql,
        data: result.results,
      }]);
    } catch {
      setMessages(prev => [...prev, {
        sender: 'assistant',
        text: "Error: Could not reach the API server. Make sure the backend is running on port 8000.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || loading) return;
    sendQuery(inputValue);
  };

  return (
    <div className="animated-fade" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
      
      {/* Left Side: Dynamic Chat Workspace */}
      <div className="card" style={{ height: '70vh', display: 'flex', flexDirection: 'column' }}>
        <div className="card-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '6px', borderRadius: '8px' }}>
              <Bot size={20} />
            </div>
            <h2>ITAM AI Assistant</h2>
          </div>
        </div>

        {/* Chat Feed */}
        <div style={{ flexGrow: 1, padding: '20px 0', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '15px' }}>
          {messages.map((m, idx) => (
            <div key={idx} style={{ 
              display: 'flex', 
              justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start',
              padding: '0 10px'
            }}>
              <div style={{ 
                maxWidth: '92%',
                backgroundColor: m.sender === 'user' ? 'var(--primary)' : 'var(--bg-tertiary)',
                color: m.sender === 'user' ? 'white' : 'var(--text-primary)',
                padding: '12px 18px',
                borderRadius: m.sender === 'user' ? '18px 18px 0 18px' : '18px 18px 18px 0',
                boxShadow: 'var(--shadow-sm)'
              }}>
                <p style={{ fontSize: '0.92rem', whiteSpace: 'pre-wrap' }}>{m.text}</p>
                
                {/* SQL Query Block */}
                {m.sql && (
                  <div style={{ 
                    marginTop: '12px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)',
                    overflow: 'hidden'
                  }}>
                    <div style={{ 
                      backgroundColor: 'var(--bg-primary)', 
                      padding: '6px 12px', 
                      fontSize: '0.75rem', 
                      fontFamily: 'var(--font-sans)', 
                      fontWeight: 'bold', 
                      color: 'var(--text-secondary)',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      borderBottom: '1px solid var(--border-color)'
                    }}>
                      <Terminal size={12} /> SQL QUERY EXECUTED
                    </div>
                    <pre style={{ 
                      padding: '12px', 
                      fontFamily: 'Consolas', 
                      fontSize: '0.8rem', 
                      color: 'var(--primary)', 
                      overflowX: 'auto',
                      margin: 0
                    }}>
                      {m.sql}
                    </pre>
                  </div>
                )}

                {/* Data Results Table */}
                {m.data && m.data.length > 0 && (
                  <div style={{ 
                    marginTop: '12px', 
                    backgroundColor: 'var(--bg-secondary)', 
                    borderRadius: '8px', 
                    border: '1px solid var(--border-color)',
                    overflow: 'auto',
                    maxHeight: '300px'
                  }}>
                    <div style={{ 
                      backgroundColor: 'var(--bg-primary)', 
                      padding: '6px 12px', 
                      fontSize: '0.75rem', 
                      fontWeight: 'bold', 
                      color: 'var(--text-secondary)',
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '6px',
                      borderBottom: '1px solid var(--border-color)',
                      position: 'sticky',
                      top: 0
                    }}>
                      <Database size={12} /> RESULTS ({m.data.length} rows)
                    </div>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                            {Object.keys(m.data[0]).slice(0, 8).map(col => (
                              <th key={col} style={{ padding: '6px 8px', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border-color)', fontWeight: 600 }}>{col}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {m.data.slice(0, 20).map((row, ri) => (
                            <tr key={ri} style={{ borderBottom: '1px solid var(--border-color)' }}>
                              {Object.keys(m.data![0]).slice(0, 8).map(col => {
                                let val = row[col];
                                if (typeof val === 'object' && val !== null) val = JSON.stringify(val).slice(0, 60);
                                if (val === null || val === undefined) val = '—';
                                return <td key={col} style={{ padding: '4px 8px', whiteSpace: 'nowrap', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{String(val)}</td>;
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {m.data.length > 20 && (
                        <div style={{ padding: '8px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Showing 20 of {m.data.length} rows
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', gap: '8px', padding: '10px', color: 'var(--text-secondary)', alignItems: 'center' }}>
              <Sparkles size={16} className="anim-pulse" />
              <span style={{ fontSize: '0.85rem' }}>Querying database...</span>
            </div>
          )}
        </div>

        {/* Input Text Form */}
        <form onSubmit={handleSend} style={{ display: 'flex', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '15px' }}>
          <input 
            type="text" 
            className="form-control" 
            placeholder="Ask: 'Show warranties' or 'List software' or 'CPU usage'..." 
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            disabled={loading}
          />
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }} disabled={loading}>
            <Send size={18} />
          </button>
        </form>
      </div>

      {/* Right Side: Fast Report Generation Controls */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="card">
          <div className="card-header">
            <h2>Fast ITAM Reports</h2>
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '15px' }}>
            Click to instantly query live data from the database.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => sendQuery("Show all installed software across devices")}>
              <FileSpreadsheet size={16} style={{ marginRight: '8px', color: 'var(--success)' }} /> Software Saturation
            </button>

            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => sendQuery("Show warranty expiration schedule")}>
              <Sparkles size={16} style={{ marginRight: '8px', color: 'var(--warning)' }} /> Warranty Replacements
            </button>

            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => sendQuery("Show telemetry CPU and RAM usage")}>
              <ShieldAlert size={16} style={{ marginRight: '8px', color: 'var(--danger)' }} /> Resource Leaks
            </button>

            <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'flex-start' }} onClick={() => sendQuery("Show all assets")}>
              <Database size={16} style={{ marginRight: '8px', color: 'var(--primary)' }} /> All Assets
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};
