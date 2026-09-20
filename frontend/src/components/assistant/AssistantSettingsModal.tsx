import { useState, useEffect } from 'react';
import { X, Key, Mic, Zap, Shield, ExternalLink, Check, Sparkles } from 'lucide-react';
import { vapiService } from '../../services/vapiService';

interface AssistantSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function AssistantSettingsModal({ isOpen, onClose, onSaved }: AssistantSettingsModalProps) {
  const [vapiPublicKey, setVapiPublicKey] = useState('');
  const [vapiAssistantId, setVapiAssistantId] = useState('');
  const [groqKey, setGroqKey] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const config = vapiService.getSavedConfig();
      setVapiPublicKey(config.publicKey || '');
      setVapiAssistantId(config.assistantId || '');
      setGroqKey(localStorage.getItem('groq_api_key') || '');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    vapiService.saveConfig({
      publicKey: vapiPublicKey,
      assistantId: vapiAssistantId,
    });
    if (groqKey) {
      localStorage.setItem('groq_api_key', groqKey.trim());
    } else {
      localStorage.removeItem('groq_api_key');
    }

    setSavedSuccess(true);
    setTimeout(() => {
      setSavedSuccess(false);
      onSaved?.();
      onClose();
    }, 800);
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(4, 7, 13, 0.78)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'rgba(13, 19, 32, 0.95)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 20,
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.65), 0 0 40px rgba(59, 130, 246, 0.1)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Mic size={18} color="#fff" />
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontWeight: 600, color: '#fff', margin: 0 }}>
                Voice & AI Settings
              </h2>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                Configure real-time Vapi voice and Groq LLM keys
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              padding: 6,
              borderRadius: 8,
              display: 'flex',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Vapi Section */}
          <div
            style={{
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              borderRadius: 14,
              padding: 16,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Sparkles size={16} color="#38bdf8" />
                <span style={{ fontSize: 14, fontWeight: 600, color: '#f0f4ff' }}>
                  Vapi Real-time Voice (WebRTC)
                </span>
              </div>
              <a
                href="https://vapi.ai"
                target="_blank"
                rel="noreferrer"
                style={{
                  fontSize: 11,
                  color: '#38bdf8',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                Get Vapi Key <ExternalLink size={11} />
              </a>
            </div>

            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '0 0 14px', lineHeight: 1.5 }}>
              Enable ultra-low latency, bidirectional conversational voice streaming directly with Vapi.
              If no key is provided, the system seamlessly uses browser Web Speech mode.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>
                  Vapi Public Key
                </label>
                <div style={{ position: 'relative' }}>
                  <Key size={14} color="#64748b" style={{ position: 'absolute', left: 12, top: 12 }} />
                  <input
                    type="password"
                    value={vapiPublicKey}
                    onChange={e => setVapiPublicKey(e.target.value)}
                    placeholder="e.g. 8d39f72b-..."
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.35)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 10,
                      padding: '9px 12px 9px 34px',
                      color: '#fff',
                      fontSize: 13,
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#94a3b8', marginBottom: 6 }}>
                  Vapi Assistant ID (Optional)
                </label>
                <input
                  type="text"
                  value={vapiAssistantId}
                  onChange={e => setVapiAssistantId(e.target.value)}
                  placeholder="e.g. asst_998a12b4..."
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    padding: '9px 12px',
                    color: '#fff',
                    fontSize: 13,
                    outline: 'none',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Groq LLM Key */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 500, color: '#94a3b8' }}>
                Groq API Key (Optional Client Override)
              </label>
              <span style={{ fontSize: 11, color: '#10b981', display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={11} /> Backend pre-configured
              </span>
            </div>
            <input
              type="password"
              value={groqKey}
              onChange={e => setGroqKey(e.target.value)}
              placeholder="gsk_..."
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 10,
                padding: '9px 12px',
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(16, 185, 129, 0.08)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
            }}
          >
            <Shield size={14} color="#10b981" />
            <span style={{ fontSize: 11, color: '#a7f3d0' }}>
              Your API keys are stored securely in your local browser and never exposed.
            </span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            background: 'rgba(0, 0, 0, 0.25)',
            borderTop: '1px solid rgba(255, 255, 255, 0.06)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 12,
          }}
        >
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: 10,
              padding: '8px 16px',
              color: '#94a3b8',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            style={{
              background: savedSuccess
                ? '#10b981'
                : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
              border: 'none',
              borderRadius: 10,
              padding: '8px 20px',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              transition: 'all 0.2s',
            }}
          >
            {savedSuccess ? (
              <>
                <Check size={15} /> Saved!
              </>
            ) : (
              'Save & Apply'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
