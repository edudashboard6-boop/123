import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { extractModels } from '@/lib/provider-fetch';
import { isAllowedProviderUrl, isValidProviderType } from '@/lib/url-validator';

// GET /api/providers — Return all providers, or test a connection if action=test
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    // Handle test action
    if (action === 'test') {
      const baseUrl = searchParams.get('baseUrl');
      const type = searchParams.get('type');
      const apiKey = searchParams.get('apiKey') || '';

      if (!baseUrl) {
        return NextResponse.json(
          { success: false, message: 'baseUrl is required for testing' },
          { status: 400 }
        );
      }

      if (!isAllowedProviderUrl(baseUrl)) {
        return NextResponse.json({ success: false, message: 'Invalid or blocked URL' });
      }

      if (type && !isValidProviderType(type)) {
        return NextResponse.json({ success: false, message: `Unsupported provider type: ${type}` });
      }

      return testProviderConnection(baseUrl, type || 'openai', apiKey);
    }

    const providers = await db.llmProvider.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const parsed = providers.map((p) => ({
      ...p,
      models: JSON.parse(p.models || '[]'),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[GET /api/providers]', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}

// POST /api/providers — Create a new provider
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, type, baseUrl, apiKey, isLocal, isActive, models } = body;

    if (!name || !type) {
      return NextResponse.json(
        { error: 'name and type are required' },
        { status: 400 }
      );
    }

    if (!isValidProviderType(type)) {
      return NextResponse.json(
        { error: `Unsupported provider type: ${type}` },
        { status: 400 }
      );
    }

    if (baseUrl && !isAllowedProviderUrl(baseUrl)) {
      return NextResponse.json(
        { error: 'Invalid or blocked URL' },
        { status: 400 }
      );
    }

    const provider = await db.llmProvider.create({
      data: {
        id: crypto.randomUUID(),
        name,
        type,
        baseUrl: baseUrl || '',
        apiKey: apiKey || '',
        isLocal: isLocal ?? false,
        isActive: isActive ?? true,
        models: JSON.stringify(models || []),
      },
    });

    return NextResponse.json(
      { ...provider, models: JSON.parse(provider.models || '[]') },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/providers]', error);
    return NextResponse.json(
      { error: 'Failed to create provider' },
      { status: 500 }
    );
  }
}

/**
 * Test connectivity to a provider endpoint.
 */
async function testProviderConnection(
  baseUrl: string,
  type: string,
  apiKey: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  let modelsEndpoint = `${normalizedUrl}/v1/models`;
  if (type === 'google') {
    modelsEndpoint = `${normalizedUrl}/v1beta/models`;
  } else if (type === 'ollama') {
    modelsEndpoint = `${normalizedUrl}/api/tags`;
  }

  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const response = await fetch(modelsEndpoint, {
      method: 'GET',
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (response.ok) {
      const data = await response.json();
      const modelList = extractModels(data, type);
      return NextResponse.json({
        success: true,
        message: `Connected successfully. Found ${modelList.length} model(s).`,
        models: modelList,
      });
    } else {
      const text = await response.text().catch(() => 'Unknown error');
      return NextResponse.json({
        success: false,
        message: `HTTP ${response.status}: ${text.substring(0, 200)}`,
      });
    }
  } catch (error: unknown) {
    clearTimeout(timeout);
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        message: `Connection timed out after 5s`,
      });
    }
    return NextResponse.json({
      success: false,
      message: `Connection failed: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
}
