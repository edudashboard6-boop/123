import { create } from 'zustand';
import type { AgentConfig } from '@/lib/types';

// =============================================================================
// Agent Store — CRUD operations against /api/agents
// =============================================================================

interface AgentStore {
  agents: AgentConfig[];
  loading: boolean;
  error: string | null;

  /** Fetch all agent configurations from the server */
  fetchAgents: () => Promise<void>;

  /** Partially update a single agent configuration */
  updateAgent: (agentId: string, data: Partial<AgentConfig>) => Promise<void>;

  /** Reset every agent to its built-in default values */
  resetAgentsToDefaults: () => Promise<void>;
}

export const useAgentStore = create<AgentStore>((set) => ({
  agents: [],
  loading: false,
  error: null,

  fetchAgents: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/agents');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch agents (${res.status})`);
      }
      const data: AgentConfig[] = await res.json();

      // Auto-seed default agents if the table is empty (first run)
      if (data.length === 0) {
        try {
          const resetRes = await fetch('/api/agents/reset', { method: 'POST' });
          if (resetRes.ok) {
            const seeded: AgentConfig[] = await resetRes.json();
            set({ agents: seeded, loading: false });
            return;
          } else {
            // Log the failure so the issue is visible in the console
            const errBody = await resetRes.json().catch(() => ({}));
            console.warn('[AgentStore] Auto-seed failed:', resetRes.status, errBody);
          }
        } catch (seedErr) {
          console.warn('[AgentStore] Auto-seed threw:', seedErr);
        }
      }

      set({ agents: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  updateAgent: async (agentId, data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, ...data }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to update agent (${res.status})`);
      }
      const updated: AgentConfig = await res.json();
      set((s) => ({
        agents: s.agents.map((a) => (a.agentId === agentId ? updated : a)),
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  resetAgentsToDefaults: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/agents/reset', { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to reset agents (${res.status})`);
      }
      const data: AgentConfig[] = await res.json();
      set({ agents: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },
}));
