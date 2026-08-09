import { create } from 'zustand';
import type { LlmProvider } from '@/lib/types';

// =============================================================================
// Provider Store — CRUD operations against /api/providers
// =============================================================================

interface ProviderStore {
  providers: LlmProvider[];
  loading: boolean;
  error: string | null;

  /** Fetch all providers from the server */
  fetchProviders: () => Promise<void>;

  /** Create a new provider */
  addProvider: (
    provider: Omit<LlmProvider, 'id' | 'createdAt' | 'updatedAt'>,
  ) => Promise<void>;

  /** Update an existing provider by id */
  updateProvider: (id: string, data: Partial<LlmProvider>) => Promise<void>;

  /** Delete a provider by id */
  deleteProvider: (id: string) => Promise<void>;

  /** Test connectivity to a provider and return true on success */
  testProvider: (id: string) => Promise<boolean>;
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  loading: false,
  error: null,

  fetchProviders: async () => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/providers');
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to fetch providers (${res.status})`);
      }
      const data: LlmProvider[] = await res.json();
      set({ providers: data, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  addProvider: async (provider) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch('/api/providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(provider),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to add provider (${res.status})`);
      }
      const created: LlmProvider = await res.json();
      set((s) => ({
        providers: [...s.providers, created],
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  updateProvider: async (id, data) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/providers/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to update provider (${res.status})`);
      }
      const updated: LlmProvider = await res.json();
      set((s) => ({
        providers: s.providers.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  deleteProvider: async (id) => {
    set({ loading: true, error: null });
    try {
      const res = await fetch(`/api/providers/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Failed to delete provider (${res.status})`);
      }
      set((s) => ({
        providers: s.providers.filter((p) => p.id !== id),
        loading: false,
      }));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  testProvider: async (id) => {
    const provider = get().providers.find((p) => p.id === id);
    if (!provider) return false;
    try {
      const params = new URLSearchParams({
        action: 'test',
        baseUrl: provider.baseUrl,
        type: provider.type,
        apiKey: provider.apiKey,
      });
      const res = await fetch(`/api/providers?${params}`);
      if (!res.ok) return false;
      const data = await res.json();
      return data.success === true;
    } catch {
      return false;
    }
  },
}));
