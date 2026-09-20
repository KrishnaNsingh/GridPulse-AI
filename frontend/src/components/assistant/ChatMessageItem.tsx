import { useState } from 'react';
import { Copy, Check, Volume2, ThumbsUp, ThumbsDown, Sparkles, Globe, Zap, FileText } from 'lucide-react';
import type { StoredMessage } from '../../services/chatStorage';

interface ChatMessageItemProps {
  message: StoredMessage;
  onSpeak?: (text: string) => void;
}

export function ChatMessageItem({ message, onSpeak }: ChatMessageItemProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const isUser = message.role === 'user';

  const handleCopy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      style={{
        display: 'flex',
        gap: 14,
        flexDirection: isUser ? 'row-reverse' : 'row',
        marginBottom: 20,
        maxWidth: 820,
        width: '100%',
        margin: isUser ? '0 0 20px auto' : '0 auto 20px 0',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: isUser
            ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
            : 'linear-gradient(135deg, #7c3aed, #4f46e5)',
          boxShadow: isUser
            ? '0 4px 12px rgba(59, 130, 246, 0.25)'
            : '0 4px 12px rgba(124, 58, 237, 0.25)',
          fontSize: 13,
          fontWeight: 600,
          color: '#fff',
        }}
      >
        {isUser ? 'U' : <Sparkles size={16} />}
      </div>

      {/* Bubble Container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isUser ? 'flex-end' : 'flex-start',
          maxWidth: '82%',
        }}
      >
        {/* Name / Model Tag */}
        <div style={{ fontSize: 11, color: '#64748b', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>{isUser ? 'You' : (message.model || 'Axora AI')}</span>
          {!isUser && message.used_groq && (
            <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: 3 }}>
              <Zap size={10} /> Groq Llama-3
            </span>
          )}
        </div>

        {/* Message Content */}
        <div
          style={{
            background: isUser ? 'rgba(59, 130, 246, 0.12)' : 'rgba(20, 26, 40, 0.85)',
            border: `1px solid ${isUser ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
            borderRadius: isUser ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
            padding: '12px 18px',
            color: '#f1f5f9',
            fontSize: 14,
            lineHeight: 1.65,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          }}
        >
          {message.content}

          {/* Special Tool Visualizations */}
          {message.toolType === 'image' && message.toolData && (
            <div
              style={{
                marginTop: 14,
                borderRadius: 12,
                overflow: 'hidden',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: '#090d16',
              }}
            >
              <div
                style={{
                  height: 220,
                  width: '100%',
                  background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 50%, #0f172a 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}
              >
                {/* Visual holographic effect */}
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(168,85,247,0.3) 0%, transparent 60%)',
                  }}
                />
                <div style={{ textAlign: 'center', zIndex: 1, padding: 16 }}>
                  <Sparkles size={32} color="#c084fc" style={{ margin: '0 auto 10px' }} />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f8fafc' }}>
                    {message.toolData.prompt || 'Generated Concept Art'}
                  </div>
                  <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 4 }}>
                    4K High Dynamic Range · Photorealistic Neural Render
                  </div>
                </div>
              </div>
            </div>
          )}

          {message.toolType === 'web_search' && message.toolData && (
            <div
              style={{
                marginTop: 12,
                padding: '10px 14px',
                borderRadius: 10,
                background: 'rgba(56, 189, 248, 0.08)',
                border: '1px solid rgba(56, 189, 248, 0.2)',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 600, color: '#38bdf8' }}>
                <Globe size={14} /> Live Web Sources Cited
              </div>
              <div style={{ fontSize: 12, color: '#cbd5e1' }}>
                {message.toolData.summary || 'Queried current global energy markets & real-time pricing indices.'}
              </div>
            </div>
          )}

          {message.toolType === 'file' && message.toolData && (
            <div
              style={{
                marginTop: 10,
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: 12,
                color: '#94a3b8',
              }}
            >
              <FileText size={14} color="#38bdf8" />
              <span>Attached: {message.toolData.filename}</span>
            </div>
          )}
        </div>

        {/* Message Actions (for Assistant) */}
        {!isUser && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, paddingLeft: 4 }}>
            <button
              onClick={handleCopy}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
              }}
              title="Copy message"
            >
              {copied ? <Check size={13} color="#10b981" /> : <Copy size={13} />}
              {copied && <span style={{ color: '#10b981' }}>Copied</span>}
            </button>

            {onSpeak && (
              <button
                onClick={() => onSpeak(message.content)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 4,
                  borderRadius: 6,
                  display: 'flex',
                }}
                title="Read aloud"
              >
                <Volume2 size={13} />
              </button>
            )}

            <button
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
              style={{
                background: 'transparent',
                border: 'none',
                color: feedback === 'up' ? '#38bdf8' : '#64748b',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
              }}
              title="Helpful"
            >
              <ThumbsUp size={13} />
            </button>

            <button
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
              style={{
                background: 'transparent',
                border: 'none',
                color: feedback === 'down' ? '#ef4444' : '#64748b',
                cursor: 'pointer',
                padding: 4,
                borderRadius: 6,
                display: 'flex',
              }}
              title="Not helpful"
            >
              <ThumbsDown size={13} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
