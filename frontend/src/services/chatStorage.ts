export interface StoredMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  model?: string;
  used_groq?: boolean;
  toolType?: 'telemetry' | 'analytics' | 'dispatch' | 'file' | 'image' | 'web_search';
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

const STORAGE_KEY = 'gridpulse_chat_sessions_v2';
const ACTIVE_SESSION_KEY = 'gridpulse_active_session_id';

const SEED_SESSIONS: ChatSession[] = [
  {
    id: 'seed-1',
    title: 'Peak discharge hour 19 rationale',
    createdAt: Date.now() - 1000 * 60 * 60 * 2,
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
    model: 'GridPulse Copilot',
    messages: [
      {
        id: 'm1',
        role: 'user',
        content: 'Why did the optimizer schedule discharge at hour 19 instead of holding charge for hour 21?',
        timestamp: Date.now() - 1000 * 60 * 60 * 2,
      },
      {
        id: 'm2',
        role: 'assistant',
        content: 'At hour 19, forecasted locational marginal pricing reaches $88.50/MWh with high confidence (P90: $94.20). While hour 21 is also elevated, holding state-of-charge across both hours would constrain the terminal 50% SoC boundary without yielding higher net margin once the 4× depth-of-discharge degradation penalty tier is factored in.',
        timestamp: Date.now() - 1000 * 60 * 60 * 2 + 1000,
        model: 'GridPulse Copilot',
      },
    ],
  },
  {
    id: 'seed-2',
    title: 'Degradation penalty tradeoff',
    createdAt: Date.now() - 1000 * 60 * 60 * 18,
    updatedAt: Date.now() - 1000 * 60 * 60 * 18,
    model: 'GridPulse Copilot',
    messages: [
      {
        id: 'm3',
        role: 'user',
        content: 'What is the net economic benefit of cycling the battery twice in 24 hours versus a single cycle?',
        timestamp: Date.now() - 1000 * 60 * 60 * 18,
      },
      {
        id: 'm4',
        role: 'assistant',
        content: 'The dual-cycle dispatch captures an additional $142.30 in gross price spreads during the morning and evening peaks. After subtracting piecewise degradation costs ($38.50) and round-trip efficiency losses (90.25% RTE), net operating profit improves by $89.60 while keeping maximum cycle depth strictly below the 80% DoD penalty cliff.',
        timestamp: Date.now() - 1000 * 60 * 60 * 18 + 1000,
        model: 'GridPulse Copilot',
      },
    ],
  },
  {
    id: 'seed-3',
    title: 'Constraint audit & ramp limits',
    createdAt: Date.now() - 1000 * 60 * 60 * 22,
    updatedAt: Date.now() - 1000 * 60 * 60 * 22,
    model: 'GridPulse Copilot',
    messages: [
      {
        id: 'm5',
        role: 'user',
        content: 'Verify that all inverter power limits and SoC safety buffers were respected in the 48-hour run.',
        timestamp: Date.now() - 1000 * 60 * 60 * 22,
      },
      {
        id: 'm6',
        role: 'assistant',
        content: 'All 48 timesteps satisfy physical constraints: maximum charge and discharge rates remained at or below 2.50 MW, anti-simultaneity binaries ensured zero overlapping power flows, and state-of-charge remained bounded within 10% min and 90% max safety buffers.',
        timestamp: Date.now() - 1000 * 60 * 60 * 22 + 1000,
        model: 'GridPulse Copilot',
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

export function createNewSession(firstMessage?: string, model: string = 'GridPulse Copilot'): ChatSession {
  const newSession: ChatSession = {
    id: 'session-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    title: firstMessage ? (firstMessage.length > 32 ? firstMessage.substring(0, 32) + '...' : firstMessage) : 'New dispatch analysis',
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
    } else {
      groups.Older.push(session);
    }
  });

  return groups;
}
