import { create } from 'zustand';
import type { ChatSession, ChatMessage, DebateMode } from '@/lib/types';

// =============================================================================
// Chat Store — session management and message streaming against /api/chat
// =============================================================================

interface ChatStore {
  /** All sessions list (used in sidebar) */
  sessions: ChatSession[];
  /** Currently focused session */
  activeSessionId: string | null;
  /** Messages for the currently active session */
  messages: ChatMessage[];
  /** Whether an async operation is in flight */
  loading: boolean;
  /** Human-readable error from the last failed operation */
  error: string | null;

  // -- Derived / accumulated metrics --
  totalCost: number;
  totalTokens: number;

  // -- Actions --

  /** Fetch the list of all sessions (sidebar) */
  fetchSessions: () => Promise<void>;

  /** Create a new session and return its id */
  createSession: (title?: string, mode?: DebateMode) => Promise<string>;

  /** Delete a session by id */
  deleteSession: (id: string) => Promise<void>;

  /** Set the currently active session id (local UI state) */
  setActiveSessionId: (id: string | null) => void;

  /** Send a user message to the active session and trigger agent pipeline */
  sendMessage: (content: string) => Promise<void>;

  /** Load messages for a given session into the local message buffer */
  loadSessionMessages: (sessionId: string) => Promise<void>;

  /** Clear the local message buffer (does NOT delete server data) */
  clearMessages: () => void;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  sessions: [],
  activeSessionId: null,
  messages: [],
  loading: false,
  error: null,
  totalCost: 0,
  totalTokens: 0,

  // ---------------------------------------------------------------------------
  // fetchSessions
  // ---------------------------------------------------------------------------
  fetchSessions: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/chat/sessions');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch sessions (${res.status})`);
      }
      const data: ChatSession[] = await res.json();
      set({ sessions: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  // ---------------------------------------------------------------------------
  // createSession
  // ---------------------------------------------------------------------------
  createSession: async (title, mode) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/chat/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title ?? 'New Session',
          mode: mode ?? 'fast',
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to create session (${res.status})`);
      }
      const session: ChatSession = await res.json();
      set((s) => ({
        sessions: [session, ...s.sessions],
        activeSessionId: session.id,
        messages: [],
        totalCost: 0,
        totalTokens: 0,
        loading: false,
      }));
      return session.id;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
      throw err;
    }
  },

  // ---------------------------------------------------------------------------
  // deleteSession
  // ---------------------------------------------------------------------------
  deleteSession: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/chat/sessions/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to delete session (${res.status})`);
      }
      set((s) => {
        const wasActive = s.activeSessionId === id;
        return {
          sessions: s.sessions.filter((sess) => sess.id !== id),
          activeSessionId: wasActive ? null : s.activeSessionId,
          messages: wasActive ? [] : s.messages,
          loading: false,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  // ---------------------------------------------------------------------------
  // setActiveSessionId
  // ---------------------------------------------------------------------------
  setActiveSessionId: (id: string | null) => set({ activeSessionId: id }),

  // ---------------------------------------------------------------------------
  // sendMessage
  // ---------------------------------------------------------------------------
  sendMessage: async (content) => {
    const sessionId = get().activeSessionId;
    if (!sessionId) return;

    set({ loading: true, error: null });

    // Optimistically append the user message locally
    const optimisticUserMessage: ChatMessage = {
      id: `temp-user-${Date.now()}`,
      sessionId,
      role: 'user',
      content,
      agentName: 'You',
      modelUsed: '',
      tokens: 0,
      cost: 0,
      toolCalls: [],
      createdAt: new Date().toISOString(),
    };

    set((s) => ({
      messages: [...s.messages, optimisticUserMessage],
    }));

    try {
      const res = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, content }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to send message (${res.status})`);
      }

      // The response may contain one or more agent messages (depending on debate mode)
      const agentMessages: ChatMessage[] = await res.json();

      set((s) => {
        // Remove the optimistic placeholder and replace with server-confirmed user message
        // (the server response typically includes the user message as the first entry)
        const userMsg = agentMessages.find((m) => m.role === 'user') ?? optimisticUserMessage;
        const rest = agentMessages.filter((m) => m.role !== 'user');

        const allMessages = [
          ...s.messages.filter((m) => m.id !== optimisticUserMessage.id),
          userMsg,
          ...rest,
        ];

        // Recalculate running totals
        const totalTokens = allMessages.reduce((sum, m) => sum + m.tokens, 0);
        const totalCost = allMessages.reduce((sum, m) => sum + m.cost, 0);

        return {
          messages: allMessages,
          totalTokens,
          totalCost,
          loading: false,
        };
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  // ---------------------------------------------------------------------------
  // loadSessionMessages
  // ---------------------------------------------------------------------------
  loadSessionMessages: async (sessionId) => {
    set({ loading: true, error: null, activeSessionId: sessionId });
    try {
      const res = await fetch(`/api/chat/sessions/${sessionId}/messages`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to load messages (${res.status})`);
      }
      const messages: ChatMessage[] = await res.json();
      const totalTokens = messages.reduce((sum, m) => sum + m.tokens, 0);
      const totalCost = messages.reduce((sum, m) => sum + m.cost, 0);
      set({ messages, totalTokens, totalCost, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  // ---------------------------------------------------------------------------
  // clearMessages
  // ---------------------------------------------------------------------------
  clearMessages: () => {
    set({
      messages: [],
      totalCost: 0,
      totalTokens: 0,
    });
  },
}));
