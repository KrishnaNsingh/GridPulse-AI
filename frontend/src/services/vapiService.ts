/**
 * Vapi Real-time Voice Service
 * Supports official @vapi-ai/web SDK with WebRTC voice streaming,
 * plus a seamless browser Web Speech API fallback for immediate zero-config testing.
 */

export interface VapiConfig {
  publicKey?: string;
  assistantId?: string;
}

export type VoiceCallStatus = 'idle' | 'connecting' | 'connected' | 'ended' | 'error';

export interface VoiceMessageEvent {
  role: 'user' | 'assistant' | 'system';
  content: string;
  isPartial?: boolean;
}

type StatusCallback = (status: VoiceCallStatus) => void;
type VolumeCallback = (volume: number) => void;
type MessageCallback = (msg: VoiceMessageEvent) => void;
type ErrorCallback = (error: any) => void;

class VapiVoiceManager {
  private vapiInstance: any = null;
  private status: VoiceCallStatus = 'idle';
  private statusListeners: Set<StatusCallback> = new Set();
  private volumeListeners: Set<VolumeCallback> = new Set();
  private messageListeners: Set<MessageCallback> = new Set();
  private errorListeners: Set<ErrorCallback> = new Set();
  private isMuted: boolean = false;
  private isFallbackMode: boolean = false;

  // Browser Fallback audio & speech recognition
  private recognition: any = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private micStream: MediaStream | null = null;
  private animFrameId: number | null = null;
  private synth: SpeechSynthesis | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.synth = window.speechSynthesis || null;
    }
  }

  public getSavedConfig(): VapiConfig {
    if (typeof window === 'undefined') return {};
    return {
      publicKey: localStorage.getItem('vapi_public_key') || (import.meta.env.VITE_VAPI_PUBLIC_KEY as string) || '',
      assistantId: localStorage.getItem('vapi_assistant_id') || (import.meta.env.VITE_VAPI_ASSISTANT_ID as string) || '',
    };
  }

  public async syncBackendConfig(): Promise<VapiConfig> {
    try {
      const apiBase = (import.meta.env.VITE_API_URL as string)?.replace(/\/$/, '') || '';
      const res = await fetch(`${apiBase}/api/assistant/config`);
      if (res.ok) {
        const data = await res.json();
        if (data.vapi_public_key && !localStorage.getItem('vapi_public_key')) {
          localStorage.setItem('vapi_public_key', data.vapi_public_key);
        }
        if (data.vapi_assistant_id && !localStorage.getItem('vapi_assistant_id')) {
          localStorage.setItem('vapi_assistant_id', data.vapi_assistant_id);
        }
      }
    } catch {
      // ignore
    }
    return this.getSavedConfig();
  }

  public saveConfig(config: VapiConfig) {
    if (typeof window === 'undefined') return;
    if (config.publicKey !== undefined) {
      localStorage.setItem('vapi_public_key', config.publicKey.trim());
    }
    if (config.assistantId !== undefined) {
      localStorage.setItem('vapi_assistant_id', config.assistantId.trim());
    }
  }

  public onStatus(cb: StatusCallback) {
    this.statusListeners.add(cb);
    cb(this.status);
    return () => this.statusListeners.delete(cb);
  }

  public onVolume(cb: VolumeCallback) {
    this.volumeListeners.add(cb);
    return () => this.volumeListeners.delete(cb);
  }

  public onMessage(cb: MessageCallback) {
    this.messageListeners.add(cb);
    return () => this.messageListeners.delete(cb);
  }

  public onError(cb: ErrorCallback) {
    this.errorListeners.add(cb);
    return () => this.errorListeners.delete(cb);
  }

  private setStatus(status: VoiceCallStatus) {
    this.status = status;
    this.statusListeners.forEach(cb => cb(status));
  }

  private emitVolume(vol: number) {
    this.volumeListeners.forEach(cb => cb(vol));
  }

  private emitMessage(msg: VoiceMessageEvent) {
    this.messageListeners.forEach(cb => cb(msg));
  }

  private emitError(err: any) {
    this.errorListeners.forEach(cb => cb(err));
  }

  /**
   * Start a voice session.
   * If Vapi public key is present, uses official @vapi-ai/web SDK.
   * Otherwise launches high-fidelity interactive browser Web Speech audio session.
   */
  public async startCall(options?: {
    apiKey?: string;
    assistantId?: string;
    systemPrompt?: string;
    firstMessage?: string;
    onUserSpeech?: (text: string) => Promise<string>;
  }) {
    let saved = this.getSavedConfig();
    let apiKey = options?.apiKey || saved.publicKey;
    let assistantId = options?.assistantId || saved.assistantId;

    if (!apiKey) {
      saved = await this.syncBackendConfig();
      apiKey = options?.apiKey || saved.publicKey;
      assistantId = options?.assistantId || saved.assistantId;
    }

    this.setStatus('connecting');

    if (apiKey && apiKey.length > 5) {
      try {
        // Pre-request and warm up microphone permissions with optimal constraints
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          try {
            const preStream = await navigator.mediaDevices.getUserMedia({
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
            preStream.getAudioTracks().forEach(track => {
              track.enabled = true;
            });
          } catch (micErr) {
            console.warn('[Vapi] Microphone check warning:', micErr);
          }
        }

        const vapiModule: any = await import('@vapi-ai/web');
        const Vapi = typeof vapiModule.default === 'function'
          ? vapiModule.default
          : (typeof vapiModule.default?.default === 'function' ? vapiModule.default.default : vapiModule);

        // Initialize Vapi with explicit Daily configuration to guarantee mic input is enabled
        this.vapiInstance = new Vapi(
          apiKey,
          undefined,
          { alwaysIncludeMicInPermissionPrompt: true },
          { audioSource: true, startAudioOff: false }
        );

        this.vapiInstance.on('call-start', () => {
          this.isFallbackMode = false;
          this.setStatus('connected');
          // Ensure Daily local audio track is explicitly active
          try {
            const dailyCall = this.vapiInstance.getDailyCallObject?.();
            if (dailyCall) {
              dailyCall.setLocalAudio(true);
            }
          } catch {}
        });

        this.vapiInstance.on('call-end', () => {
          this.setStatus('ended');
          this.cleanup();
        });

        this.vapiInstance.on('speech-start', () => {
          // Assistant started speaking
        });

        this.vapiInstance.on('speech-end', () => {
          // Assistant finished speaking
        });

        // Assistant speaking volume
        this.vapiInstance.on('volume-level', (vol: number) => {
          this.emitVolume(vol);
        });

        // User microphone volume level (drives orb pulsation and equalizer bars while user speaks)
        this.vapiInstance.on('local-volume-level', (vol: number) => {
          if (vol > 0.01) {
            this.emitVolume(Math.min(1, vol * 4.5));
          }
        });

        this.vapiInstance.on('message', (message: any) => {
          if (!message) return;
          const msgType = String(message.type || '');

          if (msgType === 'transcript' || msgType.startsWith('transcript')) {
            const role = message.role === 'user' ? 'user' : 'assistant';
            const text = message.transcript || message.text || '';
            if (text && text.trim()) {
              this.emitMessage({
                role,
                content: text.trim(),
                isPartial: message.transcriptType === 'partial',
              });
            }
          } else if (msgType === 'conversation-update' && Array.isArray(message.conversation)) {
            // Only emit the latest conversation item to prevent re-emitting the entire history
            const last = message.conversation[message.conversation.length - 1];
            if (last && last.content && (last.role === 'user' || last.role === 'assistant')) {
              this.emitMessage({
                role: last.role,
                content: last.content.trim(),
                isPartial: false,
              });
            }
          }
        });

        this.vapiInstance.on('error', (err: any) => {
          console.error('[Vapi Error]', err);
          this.emitError(err);
          // Only fallback if not already connected
          if (this.status !== 'connected') {
            this.startBrowserFallback(options);
          }
        });

        const shortGreeting = options?.firstMessage || "Hello! I am Axora, your GridPulse voice copilot, How can I assist you ?";

        if (assistantId && assistantId.length > 5) {
          const overrides: any = {
            firstMessage: shortGreeting,
          };
          if (options?.systemPrompt) {
            overrides.model = {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: options.systemPrompt,
                },
              ],
            };
          }
          await this.vapiInstance.start(assistantId, overrides);
        } else {
          // Start with assistant configuration object containing full BESS system prompt
          await this.vapiInstance.start({
            firstMessage: shortGreeting,
            transcriber: {
              provider: 'deepgram',
              model: 'nova-2',
              language: 'en-US',
              smartFormat: true,
              endpointing: 255,
              keywords: [
                'Axora:3',
                'GridPulse:3',
                'BESS:3',
                'MWh:2',
                'MW:2',
                'SoC:2',
                'DoD:2',
                'arbitrage:2',
                'HiGHS:2',
                'degradation:2',
              ],
            },
            model: {
              provider: 'openai',
              model: 'gpt-4o-mini',
              messages: [
                {
                  role: 'system',
                  content: options?.systemPrompt ||
                    "You are Axora, the official GridPulse AI voice copilot. Keep answers concise, natural, and conversational in 2-3 sentences.",
                },
              ],
            },
            voice: {
              provider: 'cartesia',
              voiceId: 'a0e99841-438c-4a64-b679-ae501e7d6091',
            },
            name: 'Axora Voice Assistant',
          });
        }
        return;
      } catch (err) {
        console.warn('Vapi SDK initialization failed, falling back to Browser Voice:', err);
        // Fallback to browser voice session
      }
    }

    // Start browser fallback mode
    await this.startBrowserFallback(options);
  }

  /**
   * High-fidelity Browser Web Speech + Audio Analyzer Fallback
   */
  private async startBrowserFallback(options?: {
    onUserSpeech?: (text: string) => Promise<string>;
    firstMessage?: string;
  }) {
    this.isFallbackMode = true;
    try {
      // Setup audio analyzer for microphone volume levels
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.micStream = stream;
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);

        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const tickVolume = () => {
          if (!this.analyser) return;
          this.analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const avg = sum / dataArray.length;
          const normalized = Math.min(1, avg / 128);
          this.emitVolume(normalized);
          this.animFrameId = requestAnimationFrame(tickVolume);
        };
        this.animFrameId = requestAnimationFrame(tickVolume);
      }

      // Setup Speech Recognition
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US';

        this.recognition.onresult = async (event: any) => {
          let interimTranscript = '';
          let finalTranscript = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalTranscript += transcript;
            } else {
              interimTranscript += transcript;
            }
          }

          if (interimTranscript) {
            this.emitMessage({
              role: 'user',
              content: interimTranscript,
              isPartial: true,
            });
          }

          if (finalTranscript.trim()) {
            this.emitMessage({
              role: 'user',
              content: finalTranscript.trim(),
              isPartial: false,
            });

            // Get response from handler
            if (options?.onUserSpeech) {
              try {
                const aiReply = await options.onUserSpeech(finalTranscript.trim());
                this.emitMessage({
                  role: 'assistant',
                  content: aiReply,
                  isPartial: false,
                });
                this.speakBrowser(aiReply);
              } catch (e: any) {
                const errMsg = "I understood your question, but could not retrieve the backend data.";
                this.emitMessage({ role: 'assistant', content: errMsg });
                this.speakBrowser(errMsg);
              }
            } else {
              // Default greeting response
              const reply = `I heard: "${finalTranscript.trim()}". Voice mode is active! Configure your Vapi API key in Settings for full ultra-low latency conversational voice streaming.`;
              this.emitMessage({ role: 'assistant', content: reply });
              this.speakBrowser(reply);
            }
          }
        };

        this.recognition.onerror = (event: any) => {
          console.warn('[SpeechRecognition Error]', event.error);
        };

        this.recognition.onend = () => {
          if (this.status === 'connected') {
            try {
              this.recognition?.start();
            } catch {}
          }
        };

        this.recognition.start();
      }

      this.setStatus('connected');
      const greeting = options?.firstMessage || "Hello! I am Axora, your GridPulse voice copilot, How can I assist you ?";
      this.speakBrowser(greeting);
      this.emitMessage({
        role: 'assistant',
        content: greeting,
      });
    } catch (err: any) {
      console.error('Browser voice session failed:', err);
      this.emitError(err);
      this.setStatus('error');
    }
  }

  public speakBrowser(text: string) {
    if (!this.synth) return;
    this.synth.cancel();
    const cleanText = text.replace(/[*#`_~]/g, '').slice(0, 300);
    const utter = new SpeechSynthesisUtterance(cleanText);
    utter.rate = 1.05;
    utter.pitch = 1.0;
    
    // Simulate speaking volume oscillation
    let step = 0;
    const interval = setInterval(() => {
      if (!this.synth?.speaking) {
        clearInterval(interval);
        this.emitVolume(0.05);
        return;
      }
      step += 0.25;
      const vol = 0.35 + Math.sin(step) * 0.3 + Math.random() * 0.15;
      this.emitVolume(Math.max(0.1, Math.min(0.9, vol)));
    }, 80);

    utter.onend = () => {
      clearInterval(interval);
      this.emitVolume(0);
    };

    this.synth.speak(utter);
  }

  public setMute(muted: boolean) {
    this.isMuted = muted;
    if (this.vapiInstance?.setMuted) {
      this.vapiInstance.setMuted(muted);
    }
    if (this.micStream) {
      this.micStream.getAudioTracks().forEach(track => {
        track.enabled = !muted;
      });
    }
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsFallback(): boolean {
    return this.isFallbackMode;
  }

  public stopCall() {
    if (this.vapiInstance) {
      try {
        this.vapiInstance.stop();
      } catch {}
      this.vapiInstance = null;
    }
    this.cleanup();
    this.setStatus('ended');
    setTimeout(() => {
      this.setStatus('idle');
    }, 500);
  }

  private cleanup() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.recognition) {
      try {
        this.recognition.stop();
      } catch {}
      this.recognition = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
    this.emitVolume(0);
  }
}

export const vapiService = new VapiVoiceManager();
