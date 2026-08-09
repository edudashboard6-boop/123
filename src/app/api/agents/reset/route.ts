import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { DEFAULT_AGENTS } from '@/lib/constants';

/**
 * POST /api/agents/reset
 * Reset all agents to their built-in default configurations.
 */
export async function POST() {
  try {
    // Use a transaction to ensure atomicity
    await db.$transaction(async (tx) => {
      await tx.agentConfig.deleteMany({});
      for (const def of DEFAULT_AGENTS) {
        await tx.agentConfig.create({
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
    });

    // Fetch all created agents to return
    const agents = await db.agentConfig.findMany({
      orderBy: { agentId: 'asc' },
      include: { provider: true },
    });
    const results = agents.map((a) => ({
      ...a,
      tools: JSON.parse(a.tools || '[]'),
      provider: a.provider
        ? {
            ...a.provider,
            models: JSON.parse(a.provider.models || '[]'),
          }
        : null,
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('[POST /api/agents/reset]', error);
    return NextResponse.json({ error: 'Failed to reset agents' }, { status: 500 });
  }
}
