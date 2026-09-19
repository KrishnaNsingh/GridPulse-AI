import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, User, RefreshCw, Zap, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendChatMessage, getAnalyticsSummary } from '../services/api';
import type { ChatMessage } from '../types';

const SUGGESTED = [
  "Why is the battery charging right now?",
  "Explain the degradation cost in this dispatch",
  "Why is the battery idle at this timestep?",
  "What's the net profit breakdown?",
  "Are there any constraint violations?",
  "Should I discharge during the price peak at hour 18?",
];

function MessageBubble({ msg, isLatest }: { msg: ChatMessage; isLatest: boolean }) {
  const isUser = msg.role === 'user';
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        gap: 10,
        flexDirection: isUser ? 'row-reverse' : 'row',
        marginBottom: 16,
      }}
    >
      {/* Avatar */}
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isUser
          ? 'linear-gradient(135deg, #2563eb, #1d4ed8)'
          : 'linear-gradient(135deg, #065f46, #064e3b)',
      }}>
        {isUser ? <User size={14} color="white" /> : <Bot size={14} color="#34d399" />}
      </div>

      {/* Bubble */}
      <div style={{
        maxWidth: '72%',
        background: isUser ? 'rgba(37,99,235,0.15)' : 'var(--surface-2)',
        border: `1px solid ${isUser ? 'rgba(37,99,235,0.3)' : 'var(--border)'}`,
        borderRadius: isUser ? '12px 4px 12px 12px' : '4px 12px 12px 12px',
        padding: '10px 14px',
      }}>
        <div style={{ fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {msg.content}
        </div>
        {!isUser && msg.model && (
          <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 8 }}>
            <span style={{ color: msg.used_groq ? '#10b981' : '#f59e0b' }}>
              {msg.used_groq ? '⚡ Groq LLM' : '◎ Rule-based'}
            </span>
            <span>{msg.model}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function TypingIndicator() {
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #065f46, #064e3b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Bot size={14} color="#34d399" />
      </div>
      <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '4px 12px 12px 12px', padding: '12px 16px', display: 'flex', gap: 5, alignItems: 'center' }}>
        {[0, 1, 2].map(i => (
          <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#3b82f6' }}
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ repeat: Infinity, duration: 1.2, delay: i * 0.2 }} />
        ))}
      </div>
    </div>
  );
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Welcome to GridPilot AI Assistant. I can explain optimization decisions, degradation analysis, price spreads, and constraint violations.

I have access to your latest optimization run context — ask me anything about why the battery charges, discharges, or holds at specific hours. I never make dispatch decisions; that's the MILP solver's job.`,
      model: 'system',
      used_groq: false,
    }
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ configured: boolean } | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(d => setGroqStatus({ configured: d.groq_configured })).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = useCallback(async (text?: string) => {
    const msg = (text || input).trim();
    if (!msg || sending) return;
    setInput('');

    const userMsg: ChatMessage = { role: 'user', content: msg };
    setMessages(prev => [...prev, userMsg]);
    setSending(true);

    try {
      const history = messages.filter(m => m.role !== 'system').map(m => ({ role: m.role, content: m.content }));
      const res = await sendChatMessage({
        message: msg,
        include_forecast: true,
        conversation_history: history,
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.response,
        model: res.model,
        used_groq: res.used_groq,
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Sorry, I encountered an error: ${e?.message || 'Unknown error'}`,
        model: 'error',
        used_groq: false,
      }]);
    } finally {
      setSending(false);
    }
  }, [input, messages, sending]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div style={{ padding: '80px 24px 24px', maxWidth: 1000, margin: '0 auto', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="page-header animate-fade-in" style={{ marginBottom: 16, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h1 className="page-title">AI Assistant</h1>
            <p className="page-subtitle">Groq-powered explanation engine · Reads real optimization context · Never overrides the solver</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {groqStatus !== null && (
              <div className={`badge ${groqStatus.configured ? 'badge-optimal' : 'badge-warning'}`}>
                {groqStatus.configured ? '⚡ Groq Connected' : '◎ Fallback Mode'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Groq warning */}
      {groqStatus?.configured === false && (
        <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
          <AlertCircle size={15} color="#f59e0b" style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12, color: '#f59e0b' }}>
            GROQ_API_KEY not configured. Running in rule-based fallback mode.
            Set <code style={{ background: 'rgba(0,0,0,0.3)', padding: '1px 4px', borderRadius: 3 }}>GROQ_API_KEY</code> in backend/.env to enable full LLM responses.
          </div>
        </div>
      )}

      {/* Suggested Prompts */}
      {messages.length <= 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, flexShrink: 0 }}>
          {SUGGESTED.map((s, i) => (
            <button
              key={i}
              onClick={() => send(s)}
              className="btn-ghost"
              style={{ fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 100 }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Chat Window */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '12px 12px 0 0',
        padding: '20px 20px 0',
      }}>
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} isLatest={i === messages.length - 1} />
        ))}
        {sending && <TypingIndicator />}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
        borderTop: 'none',
        borderRadius: '0 0 12px 12px',
        padding: 12,
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
        flexShrink: 0,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about optimization decisions, degradation, pricing, or constraints… (Enter to send)"
          id="assistant-input"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 13,
            resize: 'none',
            minHeight: 40,
            maxHeight: 120,
            lineHeight: 1.5,
            fontFamily: 'inherit',
          }}
          rows={1}
        />
        <button
          className="btn-primary"
          onClick={() => send()}
          disabled={!input.trim() || sending}
          id="send-message-btn"
          style={{ flexShrink: 0, padding: '9px 14px' }}
        >
          {sending ? <RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={14} />}
        </button>
      </div>
    </div>
  );
}
