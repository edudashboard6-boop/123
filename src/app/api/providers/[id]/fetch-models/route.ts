import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { fetchModelsForProvider } from '@/lib/provider-fetch';
import { isAllowedProviderUrl } from '@/lib/url-validator';

/**
 * POST /api/providers/[id]/fetch-models
 * Queries the provider's API to discover available models.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const provider = await db.llmProvider.findUnique({ where: { id } });

    if (!provider) {
      return NextResponse.json({ error: 'Provider not found' }, { status: 404 });
    }

    if (!provider.baseUrl) {
      return NextResponse.json({ error: 'Provider has no base URL configured' }, { status: 400 });
    }

    if (!isAllowedProviderUrl(provider.baseUrl)) {
      return NextResponse.json({ error: 'Provider URL is invalid or blocked' }, { status: 400 });
    }

    const models = await fetchModelsForProvider(provider.type, provider.baseUrl, provider.apiKey);

    return NextResponse.json({ models });
  } catch (error) {
    console.error('[POST /api/providers/[id]/fetch-models]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch models: ${message}` }, { status: 500 });
  }
}
