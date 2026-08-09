import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidProviderType, isAllowedProviderUrl } from '@/lib/url-validator';

// GET /api/providers/[id] — Get single provider
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const provider = await db.llmProvider.findUnique({
      where: { id },
      include: { agents: true },
    });

    if (!provider) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ...provider,
      models: JSON.parse(provider.models || '[]'),
    });
  } catch (error) {
    console.error('[GET /api/providers/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to fetch provider' },
      { status: 500 }
    );
  }
}

// PATCH /api/providers/[id] — Update provider
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, type, baseUrl, apiKey, isLocal, isActive, models } = body;

    // Check provider exists
    const existing = await db.llmProvider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name === '') {
      return NextResponse.json({ error: 'Provider name cannot be empty' }, { status: 400 });
    }
    if (baseUrl !== undefined) {
      if (baseUrl && !isAllowedProviderUrl(String(baseUrl))) {
        return NextResponse.json({ error: 'Invalid or blocked URL' }, { status: 400 });
      }
      data.baseUrl = baseUrl;
    }
    if (type !== undefined && !isValidProviderType(String(type))) {
      return NextResponse.json({ error: `Unsupported provider type: ${type}` }, { status: 400 });
    }
    if (name !== undefined) data.name = name;
    if (type !== undefined) data.type = type;
    if (apiKey !== undefined) data.apiKey = apiKey;
    if (isLocal !== undefined) data.isLocal = isLocal;
    if (isActive !== undefined) data.isActive = isActive;
    if (models !== undefined) data.models = JSON.stringify(models);

    const provider = await db.llmProvider.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...provider,
      models: JSON.parse(provider.models || '[]'),
    });
  } catch (error) {
    console.error('[PATCH /api/providers/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to update provider' },
      { status: 500 }
    );
  }
}

// DELETE /api/providers/[id] — Delete provider
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check provider exists
    const existing = await db.llmProvider.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'Provider not found' },
        { status: 404 }
      );
    }

    // Check if any agents reference this provider
    const agentCount = await db.agentConfig.count({
      where: { providerId: id },
    });
    if (agentCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete provider: ${agentCount} agent(s) are still using this provider`,
        },
        { status: 409 }
      );
    }

    await db.llmProvider.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/providers/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to delete provider' },
      { status: 500 }
    );
  }
}
