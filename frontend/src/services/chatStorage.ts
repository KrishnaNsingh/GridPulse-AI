export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  used_groq?: boolean;
  toolType?: 'image' | 'web_search' | 'analytics' | 'dispatch' | 'file';
  toolData?: any;
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMessage[];
  model: string;
}

const STORAGE_KEY = 'axora_chat_sessions_v1';
const ACTIVE_SESSION_KEY = 'axora_active_session_id';

const SEED_SESSIONS: ChatSession[] = [
  {
    id: 'seed-1',
    title: "What's one lesson life has taught you r...",
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    model: 'AI Assistant',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: "What's one lesson life has taught you recently about patience and decision making?",
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: "That the most enduring progress happens during the quiet intervals between decisions. Whether managing energy arbitrage cycles or long-term growth, waiting for optimal market conditions yields far greater dividends than reactive impulses.",
        timestamp: Date.now() - 1000 * 60 * 60 * 2 + 1000,
        model: 'Axora 4.5',
      },
    ],
  },
  {
    id: 'seed-2',
    title: "What's one mistake that taught you a val...",
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
    updatedAt: Date.now() - 1000 * 60 * 60 * 18,
    model: 'AI Assistant',
    messages: [
      {
        id: 'm3',
        role: 'user',
        content: "What's one mistake that taught you a valuable operational lesson?",
        timestamp: Date.now() - 1000 * 60 * 60 * 18,
      },
      {
        id: 'm4',
        role: 'assistant',
        content: "Underestimating degradation penalties during price spikes. In battery storage, aggressive dispatch without degradation awareness deteriorates lifetime NPV faster than gross arbitrage revenues can compensate.",
        timestamp: Date.now() - 1000 * 60 * 60 * 18 + 1000,
        model: 'GridPulse MILP',
      },
    ],
  },
  {
    id: 'seed-3',
    title: "What's one goal that excites you the mos...",
    createdAt: Date.now() - 1000 * 60 * 60 * 22,
    updatedAt: Date.now() - 1000 * 60 * 60 * 22,
    model: 'AI Assistant',
    messages: [
      {
        id: 'm5',
        role: 'user',
        content: "What's one goal that excites you the most in grid intelligence?",
        timestamp: Date.now() - 1000 * 60 * 60 * 22,
      },
      {
        id: 'm6',
        role: 'assistant',
        content: "Achieving autonomous zero-violation microgrid stabilization with sub-second closed-loop dispatch and 100% renewable integration.",
        timestamp: Date.now() - 1000 * 60 * 60 * 22 + 1000,
        model: 'Axora 4.5',
      },
    ],
  },
  {
    id: 'seed-4',
    title: "If animals could talk, which one would be...",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 10,
    model: 'AI Assistant',
    messages: [
      {
        id: 'm7',
        role: 'user',
        content: "If animals could talk, which one would be the wisest?",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 10,
      },
      {
        id: 'm8',
        role: 'assistant',
        content: "The blue whale. Navigating thousands of miles across oceanic soundscapes, witnessing centuries of planetary tides with infrasonic song.",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 10 + 1000,
        model: 'Axora 4.5',
      },
    ],
  },
  {
    id: 'seed-5',
    title: "What's one word to describe your day?",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10 - 3600,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 10 - 3600,
    model: 'AI Assistant',
    messages: [
      {
        id: 'm9',
        role: 'user',
        content: "What's one word to describe your day?",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 10 - 3600,
      },
      {
        id: 'm10',
        role: 'assistant',
        content: "Harmonious.",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 10 - 3500,
        model: 'Axora 4.5',
      },
    ],
  },
  {
    id: 'seed-6',
    title: "What's one habit you want to break?",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 10 - 7200,
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 10 - 7200,
    model: 'AI Assistant',
    messages: [
      {
        id: 'm11',
        role: 'user',
        content: "What's one habit you want to break?",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 10 - 7200,
      },
      {
        id: 'm12',
        role: 'assistant',
        content: "Constant multitasking. True creative and analytical breakthroughs emerge from sustained deep focus.",
        timestamp: Date.now() - 1000 * 60 * 60 * 24 * 10 - 7100,
        model: 'Axora 4.5',
      },
    ],
  },
];

export function getStoredSessions(): ChatSession[] {
  if (typeof window === 'undefined') return SEED_SESSIONS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_SESSIONS));
      return SEED_SESSIONS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : SEED_SESSIONS;
  } catch {
    return SEED_SESSIONS;
  }
}

export function saveStoredSessions(sessions: ChatSession[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

export function getActiveSessionId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(ACTIVE_SESSION_KEY) || null;
}

export function setActiveSessionId(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) {
    localStorage.setItem(ACTIVE_SESSION_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  }
}

export function createNewSession(firstMessage?: string, model: string = 'AI Assistant'): ChatSession {
  const newSession: ChatSession = {
    id: 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    title: firstMessage ? (firstMessage.length > 32 ? firstMessage.substring(0, 32) + '...' : firstMessage) : 'New conversation',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model,
    messages: [],
  };

  const sessions = getStoredSessions();
  const updated = [newSession, ...sessions];
  saveStoredSessions(updated);
  setActiveSessionId(newSession.id);
  return newSession;
}

export function deleteStoredSession(id: string): ChatSession[] {
  const sessions = getStoredSessions().filter(s => s.id !== id);
  saveStoredSessions(sessions);
  const active = getActiveSessionId();
  if (active === id) {
    setActiveSessionId(sessions[0]?.id || null);
  }
  return sessions;
}

export function groupSessionsByDate(sessions: ChatSession[]) {
  const now = Date.now();
  const ONE_DAY = 24 * 60 * 60 * 1000;

  const groups: { [key: string]: ChatSession[] } = {
    Today: [],
    Yesterday: [],
    'Previous 7 Days': [],
    '10 days ago': [],
    Older: [],
  };

  sessions.forEach(session => {
    const diff = now - session.updatedAt;
    if (diff < ONE_DAY) {
      groups.Today.push(session);
    } else if (diff < ONE_DAY * 2) {
      groups.Yesterday.push(session);
    } else if (diff < ONE_DAY * 7) {
      groups['Previous 7 Days'].push(session);
    } else if (diff < ONE_DAY * 14) {
      groups['10 days ago'].push(session);
    } else {
      groups.Older.push(session);
    }
  });

  return groups;
}
