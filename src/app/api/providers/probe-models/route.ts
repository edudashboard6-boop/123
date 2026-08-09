import { NextRequest, NextResponse } from 'next/server';
import { fetchModelsForProvider } from '@/lib/provider-fetch';
import { isValidProviderType, isAllowedProviderUrl } from '@/lib/url-validator';
import { probeModelsSchema } from '@/lib/validation';

/**
 * POST /api/providers/probe-models
 * Fetches available models from a provider's API using inline connection details.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = probeModelsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'type (string) and baseUrl (string) are required' },
        { status: 400 }
      );
    }

    const { type, baseUrl, apiKey } = parsed.data;

    if (!isValidProviderType(type)) {
      return NextResponse.json({ error: `Unsupported provider type: ${type}` }, { status: 400 });
    }

    if (!isAllowedProviderUrl(baseUrl)) {
      return NextResponse.json({ error: 'Invalid or blocked URL' }, { status: 400 });
    }

    const models = await fetchModelsForProvider(type, baseUrl, apiKey ?? '');

    return NextResponse.json({ models });
  } catch (error) {
    console.error('[POST /api/providers/probe-models]', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: `Failed to fetch models: ${message}` }, { status: 500 });
  }
}
