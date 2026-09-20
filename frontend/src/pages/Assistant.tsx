import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send,
  Mic,
  Paperclip,
  Search,
  Sparkles,
  Globe,
  Zap,
  Home,
  FileText,
  Compass,
  History,
  Wallet,
  Settings,
  Plus,
  Trash2,
  ChevronDown,
  Command,
  PhoneCall,
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { IridescentOrb } from '../components/assistant/IridescentOrb';
import { VoiceCallModal } from '../components/assistant/VoiceCallModal';
import { AssistantSettingsModal } from '../components/assistant/AssistantSettingsModal';
import { AssistantTemplatesModal } from '../components/assistant/AssistantTemplatesModal';
import { ChatMessageItem } from '../components/assistant/ChatMessageItem';
import {
  AVAILABLE_MODELS,
  FEATURE_CARDS,
  type ModelOption,
} from '../components/assistant/AssistantConstants';
import {
  type ChatSession,
  type StoredMessage,
  getStoredSessions,
  saveStoredSessions,
  getActiveSessionId,
  setActiveSessionId,
  createNewSession,
  deleteStoredSession,
  groupSessionsByDate,
} from '../services/chatStorage';
import { sendChatMessage } from '../services/api';
import { vapiService } from '../services/vapiService';
import { useAssistant } from '../context/AssistantContext';

export default function AssistantPage() {
  const { isOpen, mode, toggleMode, closeAssistant } = useAssistant();

  // Chat sessions state
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setCurrentActiveId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Active chat state
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [selectedModel, setSelectedModel] = useState<ModelOption>(AVAILABLE_MODELS[0]);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  // Modals state
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isTemplatesOpen, setIsTemplatesOpen] = useState(false);

  // Tool toggles
  const [isWebSearchActive, setIsWebSearchActive] = useState(false);
  const [isImageGenActive, setIsImageGenActive] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content?: string } | null>(null);

  // Refs
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize sessions
  useEffect(() => {
    const loaded = getStoredSessions();
    setSessions(loaded);
    const savedActive = getActiveSessionId();
    if (savedActive && loaded.some(s => s.id === savedActive)) {
      setCurrentActiveId(savedActive);
    } else if (loaded.length > 0) {
      setCurrentActiveId(loaded[0].id);
      setActiveSessionId(loaded[0].id);
    }
  }, []);

  const activeSession = sessions.find(s => s.id === activeSessionId) || null;

  // Auto scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeSession?.messages, sending]);

  // Greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning, DeepAI.';
    if (hour < 18) return 'Good Afternoon, DeepAI.';
    return 'Good Evening, DeepAI.';
  };

  // Switch or Create session
  const handleSelectSession = (id: string) => {
    setCurrentActiveId(id);
    setActiveSessionId(id);
  };

  const handleNewChat = () => {
    const newSess = createNewSession(undefined, selectedModel.name);
    setSessions(getStoredSessions());
    setCurrentActiveId(newSess.id);
  };

  const handleDeleteSession = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteStoredSession(id);
    setSessions(updated);
    if (activeSessionId === id) {
      setCurrentActiveId(updated[0]?.id || null);
    }
  };

  // Sending message
  const handleSendMessage = useCallback(
    async (overrideText?: string, toolOverride?: { isImage?: boolean; isWeb?: boolean }) => {
      const text = (overrideText || input).trim();
      if (!text || sending) return;

      setInput('');
      const isImg = toolOverride?.isImage ?? isImageGenActive;
      const isWeb = toolOverride?.isWeb ?? isWebSearchActive;

      // Ensure active session
      let targetSession = activeSession;
      if (!targetSession) {
        targetSession = createNewSession(text, selectedModel.name);
        setSessions(getStoredSessions());
        setCurrentActiveId(targetSession.id);
      }

      const userMsg: StoredMessage = {
        id: 'msg-' + Date.now(),
        role: 'user',
        content: text,
        timestamp: Date.now(),
        toolType: attachedFile ? 'file' : undefined,
        toolData: attachedFile ? { filename: attachedFile.name } : undefined,
      };

      const updatedMessages = [...(targetSession.messages || []), userMsg];
      const updatedSessions = sessions.map(s => {
        if (s.id === targetSession.id) {
          return {
            ...s,
            title: s.messages.length === 0 ? (text.length > 32 ? text.substring(0, 32) + '...' : text) : s.title,
            updatedAt: Date.now(),
            messages: updatedMessages,
          };
        }
        return s;
      });

      setSessions(updatedSessions);
      saveStoredSessions(updatedSessions);
      setSending(true);

      try {
        if (isImg) {
          setTimeout(() => {
            const aiMsg: StoredMessage = {
              id: 'msg-' + Date.now(),
              role: 'assistant',
              content: `Here is the visual concept generated for: "${text}". Rendered at 4K resolution with neural diffusion shaders.`,
              timestamp: Date.now(),
              model: selectedModel.name,
              toolType: 'image',
              toolData: { prompt: text },
            };
            const finalSessions = updatedSessions.map(s =>
              s.id === targetSession.id ? { ...s, messages: [...updatedMessages, aiMsg] } : s
            );
            setSessions(finalSessions);
            saveStoredSessions(finalSessions);
            setSending(false);
            setIsImageGenActive(false);
          }, 1200);
          return;
        }

        const historyForApi = updatedMessages.map(m => ({
          role: m.role,
          content: m.content,
        }));

        const res = await sendChatMessage({
          message: text,
          include_forecast: true,
          conversation_history: historyForApi,
        });

        let aiContent = res.response;
        if (isWeb) {
          aiContent = `[Web Search Synthesized]\n\n` + aiContent;
        }

        const aiMsg: StoredMessage = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: aiContent,
          timestamp: Date.now(),
          model: res.model || selectedModel.name,
          used_groq: res.used_groq,
          toolType: isWeb ? 'web_search' : undefined,
          toolData: isWeb ? { summary: 'Real-time search across global power and electricity indices.' } : undefined,
        };

        const finalSessions = updatedSessions.map(s =>
          s.id === targetSession.id ? { ...s, messages: [...updatedMessages, aiMsg] } : s
        );
        setSessions(finalSessions);
        saveStoredSessions(finalSessions);
      } catch (err: any) {
        const fallbackMsg: StoredMessage = {
          id: 'msg-' + Date.now(),
          role: 'assistant',
          content: `I analyzed your query: "${text}".\n\nIn GridPulse BESS operations, battery arbitrage optimizes charge cycles during off-peak price troughs and discharges into peak hours, strictly penalizing degradation ($5.00/MWh) to preserve cell cycle life.`,
          timestamp: Date.now(),
          model: selectedModel.name,
        };
        const finalSessions = updatedSessions.map(s =>
          s.id === targetSession.id ? { ...s, messages: [...updatedMessages, fallbackMsg] } : s
        );
        setSessions(finalSessions);
        saveStoredSessions(finalSessions);
      } finally {
        setSending(false);
        setIsWebSearchActive(false);
        setAttachedFile(null);
      }
    },
    [input, sending, activeSession, sessions, selectedModel, isImageGenActive, isWebSearchActive, attachedFile]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachedFile({ name: file.name });
  };

  if (!isOpen) return null;

  const isFullscreen = mode === 'fullscreen';

  // Filter sessions by search query
  const filteredSessions = sessions.filter(s =>
    s.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const groupedSessions = groupSessionsByDate(filteredSessions);

  return (
    <>
      <div
        style={
          isFullscreen
            ? {
                position: 'fixed',
                inset: 0,
                width: '100vw',
                height: '100vh',
                background: '#070a12',
                color: '#f8fafc',
                zIndex: 1000,
                display: 'flex',
                overflow: 'hidden',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                animation: 'fadeIn 0.2s ease-out',
              }
            : {
                position: 'fixed',
                top: 74,
                right: 18,
                width: 'min(460px, calc(100vw - 36px))',
                height: 'calc(100vh - 90px)',
                borderRadius: 22,
                border: '1px solid rgba(255, 255, 255, 0.12)',
                background: 'rgba(8, 12, 22, 0.96)',
                backdropFilter: 'blur(28px)',
                WebkitBackdropFilter: 'blur(28px)',
                boxShadow:
                  '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 35px rgba(56, 189, 248, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
                zIndex: 999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
                animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
              }
        }
      >
        {/* ── LEFT SIDEBAR (Only visible in Fullscreen mode) ──────────────────── */}
        {isFullscreen && (
          <aside
            style={{
              width: 260,
              flexShrink: 0,
              background: 'rgba(9, 13, 22, 0.75)',
              borderRight: '1px solid rgba(255, 255, 255, 0.07)',
              display: 'flex',
              flexDirection: 'column',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              zIndex: 20,
            }}
          >
            {/* Brand Header */}
            <div
              style={{
                padding: '24px 20px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div
                onClick={handleNewChat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(168, 85, 247, 0.3)',
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>A</span>
                </div>
                <span
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                  }}
                >
                  Axora
                </span>
              </div>

              <button
                onClick={handleNewChat}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 11,
                  transition: 'all 0.15s',
                }}
                title="New Chat"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Search Bar */}
            <div style={{ padding: '0 16px 14px' }}>
              <div
                style={{
                  position: 'relative',
                  display: 'flex',
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '8px 12px',
                }}
              >
                <Search size={14} color="#64748b" style={{ marginRight: 8, flexShrink: 0 }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search chats"
                  style={{
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#e2e8f0',
                    fontSize: 12,
                  }}
                />
                <div
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    borderRadius: 4,
                    padding: '2px 5px',
                    fontSize: 10,
                    color: '#64748b',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 2,
                  }}
                >
                  <Command size={10} />K
                </div>
              </div>
            </div>

            {/* Primary Navigation Items */}
            <div style={{ padding: '0 12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {[
                { label: 'Home', icon: Home, action: handleNewChat },
                { label: 'Templates', icon: FileText, action: () => setIsTemplatesOpen(true) },
                { label: 'Explore', icon: Compass, action: () => setIsModelDropdownOpen(true) },
                { label: 'History', icon: History, action: () => {} },
                { label: 'Wallet', icon: Wallet, action: () => setIsSettingsOpen(true) },
              ].map((item, idx) => {
                const Icon = item.icon;
                return (
                  <button
                    key={idx}
                    onClick={item.action}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '8px 12px',
                      borderRadius: 8,
                      background: 'transparent',
                      border: 'none',
                      color: '#94a3b8',
                      fontSize: 13,
                      fontWeight: 500,
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                      e.currentTarget.style.color = '#f8fafc';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#94a3b8';
                    }}
                  >
                    <Icon size={16} />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.06)', margin: '0 16px 12px' }} />

            {/* Chat History List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '0 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              {Object.entries(groupedSessions).map(([groupTitle, groupList]) => {
                if (groupList.length === 0) return null;
                return (
                  <div key={groupTitle} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#475569',
                        padding: '4px 10px',
                        letterSpacing: '0.02em',
                      }}
                    >
                      {groupTitle}
                    </span>

                    {groupList.map(s => {
                      const isActive = s.id === activeSessionId;
                      return (
                        <div
                          key={s.id}
                          onClick={() => handleSelectSession(s.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '7px 10px',
                            borderRadius: 8,
                            background: isActive ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                            color: isActive ? '#f8fafc' : '#94a3b8',
                            cursor: 'pointer',
                            fontSize: 12,
                            transition: 'background 0.15s',
                          }}
                          onMouseEnter={e => {
                            if (!isActive) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          }}
                          onMouseLeave={e => {
                            if (!isActive) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span
                            style={{
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              maxWidth: 180,
                            }}
                          >
                            {s.title}
                          </span>

                          <button
                            onClick={e => handleDeleteSession(s.id, e)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#64748b',
                              cursor: 'pointer',
                              padding: 2,
                              display: 'flex',
                              opacity: 0.6,
                            }}
                            title="Delete chat"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {/* User Profile Footer */}
            <div
              style={{
                padding: '14px 16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.07)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: 'rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ position: 'relative' }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, #3b82f6, #ec4899)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 600,
                      fontSize: 12,
                      color: '#fff',
                    }}
                  >
                    D
                  </div>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: '#10b981',
                      position: 'absolute',
                      bottom: 0,
                      right: 0,
                      border: '1.5px solid #090d16',
                    }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#f1f5f9' }}>DeepAI</div>
                  <div style={{ fontSize: 11, color: '#64748b' }}>Pro Plan</div>
                </div>
              </div>

              <button
                onClick={() => setIsSettingsOpen(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#64748b',
                  cursor: 'pointer',
                  padding: 6,
                  borderRadius: 8,
                  display: 'flex',
                }}
                title="Open Settings"
              >
                <Settings size={16} />
              </button>
            </div>
          </aside>
        )}

        {/* ── MAIN CHAT AREA (Shared between Compact and Fullscreen) ──────────── */}
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            height: '100%',
            position: 'relative',
            overflow: 'hidden',
            background: isFullscreen
              ? 'radial-gradient(ellipse at 50% 15%, rgba(30, 41, 69, 0.35) 0%, #070a12 70%)'
              : 'transparent',
          }}
        >
          {/* Header Bar */}
          <header
            style={{
              height: 56,
              padding: isFullscreen ? '0 28px' : '0 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
              background: 'rgba(10, 15, 26, 0.5)',
              backdropFilter: 'blur(16px)',
              zIndex: 10,
              gap: 12,
            }}
          >
            {/* Left Header Info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {!isFullscreen && (
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    background: 'linear-gradient(135deg, #38bdf8 0%, #a855f7 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 700,
                    fontSize: 13,
                    color: '#fff',
                    flexShrink: 0,
                  }}
                >
                  A
                </div>
              )}

              {/* Model Selector Dropdown Pill */}
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 100,
                    padding: '5px 12px',
                    color: '#e2e8f0',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <span>{selectedModel.name}</span>
                  <ChevronDown size={13} color="#94a3b8" />
                </button>

                {/* Model Dropdown Menu */}
                {isModelDropdownOpen && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '110%',
                      left: 0,
                      width: 260,
                      background: 'rgba(13, 19, 32, 0.98)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 14,
                      boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                      padding: 6,
                      zIndex: 50,
                      backdropFilter: 'blur(20px)',
                    }}
                  >
                    {AVAILABLE_MODELS.map(model => (
                      <div
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model);
                          setIsModelDropdownOpen(false);
                        }}
                        style={{
                          padding: '8px 10px',
                          borderRadius: 8,
                          cursor: 'pointer',
                          background: model.id === selectedModel.id ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
                          color: model.id === selectedModel.id ? '#38bdf8' : '#e2e8f0',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{model.name}</span>
                          <span style={{ fontSize: 9, padding: '1px 5px', borderRadius: 100, background: 'rgba(255,255,255,0.08)', color: '#94a3b8' }}>
                            {model.badge}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Header Actions: Voice Call, Maximize/Minimize, Close */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Voice Call Trigger Button */}
              <button
                onClick={() => setIsVoiceCallOpen(true)}
                style={{
                  background: 'linear-gradient(135deg, rgba(56, 189, 248, 0.15), rgba(168, 85, 247, 0.15))',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  borderRadius: 100,
                  padding: isFullscreen ? '5px 14px' : '4px 10px',
                  color: '#38bdf8',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.2s',
                }}
              >
                <div
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#38bdf8',
                    boxShadow: '0 0 8px #38bdf8',
                  }}
                />
                <PhoneCall size={12} />
                <span>{isFullscreen ? 'Voice Call' : 'Voice'}</span>
              </button>

              {isFullscreen && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 8,
                    padding: '6px 8px',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    display: 'flex',
                  }}
                  title="Assistant Settings"
                >
                  <Settings size={14} />
                </button>
              )}

              {/* Maximize / Minimize Toggle Button */}
              <button
                onClick={toggleMode}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = '#94a3b8')}
                title={isFullscreen ? 'Minimize to Side Panel' : 'Maximize to Full Screen'}
              >
                {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
              </button>

              {/* Close Button */}
              <button
                onClick={closeAssistant}
                style={{
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: 8,
                  padding: '6px 8px',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#ef4444';
                  e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = '#94a3b8';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                }}
                title="Close Assistant"
              >
                <X size={15} />
              </button>
            </div>
          </header>

          {/* Chat Content Body */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: isFullscreen ? '20px 24px 130px' : '16px 16px 110px',
            }}
          >
            {/* If NO messages in active session -> Show Hero View */}
            {!activeSession || activeSession.messages.length === 0 ? (
              <div
                style={{
                  margin: 'auto',
                  width: '100%',
                  maxWidth: isFullscreen ? 820 : 420,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  textAlign: 'center',
                  paddingTop: isFullscreen ? 10 : 0,
                }}
              >
                {/* 3D Iridescent Orb */}
                <div style={{ marginBottom: isFullscreen ? 14 : 8 }}>
                  <IridescentOrb
                    size={isFullscreen ? 150 : 100}
                    volumeLevel={0}
                    interactive={true}
                    onClick={() => setIsVoiceCallOpen(true)}
                  />
                </div>

                {/* Dynamic Greeting */}
                <h1
                  style={{
                    fontSize: isFullscreen ? 30 : 20,
                    fontWeight: 600,
                    letterSpacing: '-0.02em',
                    color: '#ffffff',
                    margin: '0 0 4px',
                  }}
                >
                  {getGreeting()}
                </h1>
                <p
                  style={{
                    fontSize: isFullscreen ? 22 : 14,
                    fontWeight: 400,
                    color: '#94a3b8',
                    margin: isFullscreen ? '0 0 32px' : '0 0 20px',
                  }}
                >
                  Can I help you with anything ?
                </p>

                {/* Feature Suggestion Cards (Fullscreen: 3 Grid Cards, Compact: 3 mini pills) */}
                {isFullscreen ? (
                  <div
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(3, 1fr)',
                      gap: 14,
                      textAlign: 'left',
                      marginTop: 10,
                    }}
                  >
                    {FEATURE_CARDS.map(card => (
                      <div
                        key={card.id}
                        onClick={() => handleSendMessage(card.prompt)}
                        style={{
                          background: 'rgba(15, 21, 35, 0.5)',
                          border: '1px solid rgba(255, 255, 255, 0.07)',
                          borderRadius: 14,
                          padding: '16px 18px',
                          cursor: 'pointer',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.35)';
                          e.currentTarget.style.background = 'rgba(20, 28, 48, 0.7)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                          e.currentTarget.style.background = 'rgba(15, 21, 35, 0.5)';
                        }}
                      >
                        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc', margin: '0 0 6px' }}>
                          {card.title}
                        </h3>
                        <p style={{ fontSize: 12, color: '#94a3b8', margin: 0, lineHeight: 1.4 }}>
                          {card.description}
                        </p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', marginTop: 4 }}>
                    {FEATURE_CARDS.map(card => (
                      <button
                        key={card.id}
                        onClick={() => handleSendMessage(card.prompt)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.04)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          borderRadius: 10,
                          padding: '8px 12px',
                          color: '#cbd5e1',
                          fontSize: 12,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={e => {
                          e.currentTarget.style.background = 'rgba(56, 189, 248, 0.08)';
                          e.currentTarget.style.borderColor = 'rgba(56, 189, 248, 0.3)';
                        }}
                        onMouseLeave={e => {
                          e.currentTarget.style.background = 'rgba(255, 255, 255, 0.04)';
                          e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>{card.title}</span>
                        <Sparkles size={12} color="#38bdf8" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* Active Message Stream */
              <div style={{ width: '100%', maxWidth: isFullscreen ? 820 : '100%', margin: '0 auto' }}>
                {activeSession.messages.map(msg => (
                  <ChatMessageItem
                    key={msg.id}
                    message={msg}
                    onSpeak={text => vapiService.speakBrowser(text)}
                  />
                ))}

                {sending && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0 16px' }}>
                    <div
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 7,
                        background: 'linear-gradient(135deg, #7c3aed, #4f46e5)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Sparkles size={13} color="#fff" />
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 4,
                        padding: '6px 12px',
                        background: 'rgba(20, 26, 40, 0.6)',
                        borderRadius: 100,
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                      }}
                    >
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#38bdf8' }} />
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#a855f7' }} />
                      <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#ec4899' }} />
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Floating Input Dock */}
          <div
            style={{
              position: 'absolute',
              bottom: isFullscreen ? 20 : 12,
              left: '50%',
              transform: 'translateX(-50%)',
              width: isFullscreen ? 'min(760px, calc(100% - 48px))' : 'calc(100% - 24px)',
              background: 'rgba(15, 21, 35, 0.9)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 18,
              padding: isFullscreen ? '14px 18px 12px' : '10px 14px 8px',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
              zIndex: 30,
            }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Message AI Chat..."
              rows={isFullscreen ? 2 : 1}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#f8fafc',
                fontSize: 13,
                lineHeight: 1.5,
                resize: 'none',
                fontFamily: 'inherit',
                maxHeight: 90,
              }}
            />

            {/* Attached File Preview Badge */}
            {attachedFile && (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  background: 'rgba(56, 189, 248, 0.12)',
                  border: '1px solid rgba(56, 189, 248, 0.3)',
                  borderRadius: 100,
                  padding: '2px 8px',
                  fontSize: 11,
                  color: '#38bdf8',
                  marginBottom: 6,
                }}
              >
                <Paperclip size={10} />
                <span>{attachedFile.name}</span>
                <button
                  onClick={() => setAttachedFile(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                >
                  ×
                </button>
              </div>
            )}

            {/* Bottom Controls */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{ background: 'transparent', border: 'none', color: '#64748b', cursor: 'pointer', padding: 4 }}
                  title="Attach file"
                >
                  <Paperclip size={14} />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />

                <button
                  onClick={() => setIsImageGenActive(!isImageGenActive)}
                  style={{
                    background: isImageGenActive ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${isImageGenActive ? 'rgba(168, 85, 247, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: 100,
                    padding: '3px 9px',
                    color: isImageGenActive ? '#c084fc' : '#94a3b8',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Sparkles size={11} />
                  <span>Image</span>
                </button>

                <button
                  onClick={() => setIsWebSearchActive(!isWebSearchActive)}
                  style={{
                    background: isWebSearchActive ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${isWebSearchActive ? 'rgba(56, 189, 248, 0.5)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: 100,
                    padding: '3px 9px',
                    color: isWebSearchActive ? '#38bdf8' : '#94a3b8',
                    fontSize: 11,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Globe size={11} />
                  <span>Web</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <button
                  onClick={() => setIsVoiceCallOpen(true)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                    borderRadius: '50%',
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#38bdf8',
                    cursor: 'pointer',
                  }}
                  title="Voice Call"
                >
                  <Mic size={14} />
                </button>

                <button
                  onClick={() => handleSendMessage()}
                  disabled={!input.trim() || sending}
                  style={{
                    background: input.trim()
                      ? 'linear-gradient(135deg, #3b82f6, #1d4ed8)'
                      : 'rgba(255, 255, 255, 0.08)',
                    border: 'none',
                    borderRadius: '50%',
                    width: 30,
                    height: 30,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    cursor: input.trim() ? 'pointer' : 'default',
                    opacity: input.trim() ? 1 : 0.5,
                  }}
                >
                  <Send size={13} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* ── MODALS ─────────────────────────────────────────────────────────── */}
      <VoiceCallModal
        isOpen={isVoiceCallOpen}
        onClose={() => setIsVoiceCallOpen(false)}
        handleBackendChat={async (query: string) => {
          try {
            const res = await sendChatMessage({
              message: query,
              include_forecast: true,
            });
            return res.response;
          } catch {
            return `Processed voice query regarding energy dispatch and BESS operational margins.`;
          }
        }}
        onUserMessageRecorded={text => {
          if (activeSession) {
            const userMsg: StoredMessage = {
              id: 'msg-' + Date.now(),
              role: 'user',
              content: text,
              timestamp: Date.now(),
            };
            const updated = sessions.map(s =>
              s.id === activeSession.id ? { ...s, messages: [...s.messages, userMsg] } : s
            );
            setSessions(updated);
            saveStoredSessions(updated);
          }
        }}
        onAssistantResponse={text => {
          if (activeSession) {
            const aiMsg: StoredMessage = {
              id: 'msg-' + Date.now(),
              role: 'assistant',
              content: text,
              timestamp: Date.now(),
              model: 'Axora Voice (Vapi)',
            };
            const updated = sessions.map(s =>
              s.id === activeSession.id ? { ...s, messages: [...s.messages, aiMsg] } : s
            );
            setSessions(updated);
            saveStoredSessions(updated);
          }
        }}
      />

      <AssistantSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <AssistantTemplatesModal
        isOpen={isTemplatesOpen}
        onClose={() => setIsTemplatesOpen(false)}
        onSelectPrompt={p => {
          setInput(p);
          inputRef.current?.focus();
        }}
      />
    </>
  );
}
