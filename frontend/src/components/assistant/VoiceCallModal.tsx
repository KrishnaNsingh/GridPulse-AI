import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, PhoneOff, Settings, Volume2, Sparkles, AlertCircle } from 'lucide-react';
import { IridescentOrb } from './IridescentOrb';
import { vapiService, type VoiceCallStatus, type VoiceMessageEvent } from '../../services/vapiService';
import { AssistantSettingsModal } from './AssistantSettingsModal';

interface VoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserMessageRecorded?: (text: string) => void;
  onAssistantResponse?: (text: string) => void;
  handleBackendChat?: (msg: string) => Promise<string>;
}

export function VoiceCallModal({
  isOpen,
  onClose,
  onUserMessageRecorded,
  onAssistantResponse,
  handleBackendChat,
}: VoiceCallModalProps) {
  const [status, setStatus] = useState<VoiceCallStatus>('idle');
  const [volume, setVolume] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [transcriptHistory, setTranscriptHistory] = useState<VoiceMessageEvent[]>([]);
  const [activeSpeech, setActiveSpeech] = useState<string>('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isVapiConfigured, setIsVapiConfigured] = useState(false);
  const transcriptBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const config = vapiService.getSavedConfig();
    setIsVapiConfigured(Boolean(config.publicKey && config.publicKey.length > 5));

    const unsubStatus = vapiService.onStatus(newStatus => {
      setStatus(newStatus);
      if (newStatus === 'ended' && isOpen) {
        // Delay closing so user sees ended state
      }
    });

    const unsubVolume = vapiService.onVolume(vol => {
      setVolume(vol);
    });

    const unsubMessage = vapiService.onMessage(msg => {
      if (msg.isPartial) {
        setActiveSpeech(`${msg.role === 'user' ? 'You' : 'Axora'}: ${msg.content}`);
      } else {
        setActiveSpeech('');
        setTranscriptHistory(prev => [...prev.slice(-8), msg]);
        if (msg.role === 'user') {
          onUserMessageRecorded?.(msg.content);
        } else {
          onAssistantResponse?.(msg.content);
        }
      }
    });

    return () => {
      unsubStatus();
      unsubVolume();
      unsubMessage();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && status === 'idle') {
      vapiService.startCall({
        onUserSpeech: async (text: string) => {
          if (handleBackendChat) {
            return await handleBackendChat(text);
          }
          return `I received your voice prompt: "${text}". GridPulse BESS optimization is running optimally with 0 constraint violations.`;
        },
      });
    }
  }, [isOpen, status, handleBackendChat]);

  useEffect(() => {
    transcriptBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcriptHistory, activeSpeech]);

  if (!isOpen) return null;

  const handleEndCall = () => {
    vapiService.stopCall();
    onClose();
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    vapiService.setMute(next);
  };

  return (
    <>
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 9998,
          background: 'rgba(5, 8, 15, 0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px 20px 32px',
          animation: 'fadeIn 0.25s ease-out',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            width: '100%',
            maxWidth: 680,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: status === 'connected' ? '#10b981' : '#f59e0b',
                boxShadow: status === 'connected' ? '0 0 12px #10b981' : 'none',
              }}
            />
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#f8fafc' }}>
                  Axora Real-time Voice
                </span>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 8px',
                    borderRadius: 100,
                    background: isVapiConfigured ? 'rgba(56, 189, 248, 0.15)' : 'rgba(168, 85, 247, 0.15)',
                    color: isVapiConfigured ? '#38bdf8' : '#c084fc',
                    border: `1px solid ${isVapiConfigured ? 'rgba(56, 189, 248, 0.3)' : 'rgba(168, 85, 247, 0.3)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Sparkles size={10} />
                  {isVapiConfigured ? 'Vapi WebRTC' : 'Browser Web Voice'}
                </span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                {status === 'connecting' && 'Connecting audio stream…'}
                {status === 'connected' && (volume > 0.15 ? 'Listening / Speaking…' : 'Connected · Speak naturally')}
                {status === 'ended' && 'Call ended'}
              </span>
            </div>
          </div>

          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 10,
              padding: '8px 12px',
              color: '#94a3b8',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
            }}
          >
            <Settings size={14} />
            Voice Settings
          </button>
        </div>

        {/* Center Orb & Reactive Audio Visualizer */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            margin: 'auto 0',
          }}
        >
          {/* Iridescent 3D Orb */}
          <div style={{ position: 'relative' }}>
            <IridescentOrb
              size={240}
              volumeLevel={volume}
              isSpeaking={volume > 0.2}
              isListening={status === 'connected'}
              interactive={true}
            />

            {/* Dynamic circular soundwave rings */}
            <div
              style={{
                position: 'absolute',
                inset: -20,
                borderRadius: '50%',
                border: '1.5px solid rgba(168, 85, 247, 0.35)',
                transform: `scale(${1 + volume * 0.4})`,
                opacity: Math.max(0, volume * 0.8),
                transition: 'transform 0.08s ease-out, opacity 0.08s ease-out',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: -45,
                borderRadius: '50%',
                border: '1px dashed rgba(56, 189, 248, 0.25)',
                transform: `scale(${1 + volume * 0.7})`,
                opacity: Math.max(0, volume * 0.5),
                transition: 'transform 0.12s ease-out, opacity 0.12s ease-out',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Audio Equalizer Bars */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, height: 28 }}>
            {[0.4, 0.8, 1.2, 0.9, 0.6, 1.1, 0.7, 1.3, 0.5].map((factor, i) => {
              const barHeight = Math.max(4, Math.min(28, volume * 36 * factor + 4));
              return (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: barHeight,
                    borderRadius: 3,
                    background: 'linear-gradient(180deg, #38bdf8 0%, #a855f7 100%)',
                    transition: 'height 0.06s ease-out',
                  }}
                />
              );
            })}
          </div>

          {/* Transcript / Subtitle Overlay */}
          <div
            style={{
              width: '100%',
              maxWidth: 540,
              maxHeight: 140,
              overflowY: 'auto',
              background: 'rgba(13, 19, 32, 0.65)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: 16,
              padding: '12px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              textAlign: 'center',
            }}
          >
            {transcriptHistory.length === 0 && !activeSpeech && (
              <span style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                "Listening... Ask anything about energy dispatch, battery health, or general queries."
              </span>
            )}

            {transcriptHistory.slice(-3).map((item, idx) => (
              <div key={idx} style={{ fontSize: 13, lineHeight: 1.5 }}>
                <span
                  style={{
                    color: item.role === 'user' ? '#38bdf8' : '#a855f7',
                    fontWeight: 600,
                    marginRight: 6,
                  }}
                >
                  {item.role === 'user' ? 'You:' : 'Axora:'}
                </span>
                <span style={{ color: '#e2e8f0' }}>{item.content}</span>
              </div>
            ))}

            {activeSpeech && (
              <div style={{ fontSize: 13, color: '#38bdf8', fontStyle: 'italic' }}>
                {activeSpeech}…
              </div>
            )}
            <div ref={transcriptBottomRef} />
          </div>
        </div>

        {/* Bottom Call Controls */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
          }}
        >
          {/* Mute Button */}
          <button
            onClick={toggleMute}
            style={{
              width: 52,
              height: 52,
              borderRadius: '50%',
              background: isMuted ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isMuted ? 'rgba(239, 68, 68, 0.5)' : 'rgba(255, 255, 255, 0.15)'}`,
              color: isMuted ? '#ef4444' : '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          {/* End Call Button */}
          <button
            onClick={handleEndCall}
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              boxShadow: '0 8px 24px rgba(239, 68, 68, 0.45)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'transform 0.15s, box-shadow 0.15s',
            }}
            title="End Voice Call"
          >
            <PhoneOff size={24} />
          </button>
        </div>
      </div>

      <AssistantSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSaved={() => {
          const config = vapiService.getSavedConfig();
          setIsVapiConfigured(Boolean(config.publicKey && config.publicKey.length > 5));
        }}
      />
    </>
  );
}
