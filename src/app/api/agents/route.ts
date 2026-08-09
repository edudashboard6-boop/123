import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { agentPatchSchema } from '@/lib/validation';
import { ensureDefaultAgents } from '@/lib/seed-agents';

const VALID_AGENT_IDS = ['architect', 'forge', 'sentinel', 'perception', 'scribe'];

// GET /api/agents — Return all agent configs ordered by agentId
export async function GET() {
  try {
    await ensureDefaultAgents();

    const agents = await db.agentConfig.findMany({
      orderBy: { agentId: 'asc' },
      include: { provider: true },
    });

    const parsed = agents.map((a) => ({
      ...a,
      tools: JSON.parse(a.tools || '[]'),
      provider: a.provider
        ? {
            ...a.provider,
            models: JSON.parse(a.provider.models || '[]'),
          }
        : null,
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[GET /api/agents]', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

// POST /api/agents — Create agent configs (bulk, used for reset to defaults)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Support both single agent and array of agents
    const configs = Array.isArray(body) ? body : [body];

    if (configs.length === 0) {
      return NextResponse.json(
        { error: 'No agent configs provided' },
        { status: 400 }
      );
    }

    const created = [];

    for (const config of configs) {
      const { agentId, name, description, systemPrompt, providerId, modelId, temperature, maxTokens, tools } = config;

      if (!agentId || !name || !VALID_AGENT_IDS.includes(agentId)) {
        return NextResponse.json(
          { error: `agentId must be one of: ${VALID_AGENT_IDS.join(', ')}; name is required` },
          { status: 400 }
        );
      }

      // Upsert by agentId
      const agentData = {
        agentId,
        name,
        description: description || '',
        systemPrompt: systemPrompt || '',
        providerId: providerId || null,
        modelId: modelId || '',
        temperature: temperature ?? 0.7,
        maxTokens: maxTokens ?? 4096,
        tools: JSON.stringify(tools || []),
        is_active: config.is_active ?? true,
      };
      const agent = await db.agentConfig.upsert({
        where: { agentId },
        update: agentData,
        create: {
          id: crypto.randomUUID(),
          ...agentData,
        },
      });

      created.push({
        ...agent,
        tools: JSON.parse(agent.tools || '[]'),
      });
    }

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('[POST /api/agents]', error);
    return NextResponse.json(
      { error: 'Failed to create agents' },
      { status: 500 }
    );
  }
}

// PATCH /api/agents — Update a single agent by agentId
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = agentPatchSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: `Invalid request: ${first ? `${first.path.join('.')} ${first.message}` : 'malformed payload'}`,
        },
        { status: 400 }
      );
    }

    const { agentId, providerId, modelId, temperature, maxTokens, tools, systemPrompt, name, description, is_active } = parsed.data;

    // Find by agentId
    const existing = await db.agentConfig.findFirst({
      where: { agentId },
    });

    if (!existing) {
      return NextResponse.json(
        { error: `Agent with agentId "${agentId}" not found` },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (systemPrompt !== undefined) data.systemPrompt = systemPrompt;
    if (providerId !== undefined) data.providerId = providerId;
    if (modelId !== undefined) data.modelId = modelId;
    if (temperature !== undefined) data.temperature = temperature;
    if (maxTokens !== undefined) data.maxTokens = maxTokens;
    if (tools !== undefined) data.tools = JSON.stringify(tools);
    if (is_active !== undefined) data.is_active = is_active;

    const updated = await db.agentConfig.update({
      where: { id: existing.id },
      data,
      include: { provider: true },
    });

    return NextResponse.json({
      ...updated,
      tools: JSON.parse(updated.tools || '[]'),
      provider: updated.provider
        ? {
            ...updated.provider,
            models: JSON.parse(updated.provider.models || '[]'),
          }
        : null,
    });
  } catch (error) {
    console.error('[PATCH /api/agents]', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}
