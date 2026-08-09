import { db } from './db';
import { DEFAULT_AGENTS } from './constants';

/**
 * Idempotently seed the default five NEXUS agents when the database is
 * empty. Keeps the API usable out of the box (the UI also triggers this
 * through /api/agents/reset, but API-first usage should not depend on it).
 */
export async function ensureDefaultAgents(): Promise<void> {
  try {
    const existing = await db.agentConfig.count();
    if (existing > 0) return;

    for (const def of DEFAULT_AGENTS) {
      await db.agentConfig.create({
        data: {
          id: crypto.randomUUID(),
          agentId: def.agentId,
          name: def.name,
          description: def.description,
          systemPrompt: def.systemPrompt,
          providerId: null,
          modelId: '',
          temperature: def.defaultTemperature,
          maxTokens: def.defaultMaxTokens,
          tools: JSON.stringify(def.tools || []),
          is_active: true,
        },
      });
    }

    console.log('[seed] Default NEXUS agents created');
  } catch (error) {
    console.error('[seed] Failed to ensure default agents:', error);
  }
}