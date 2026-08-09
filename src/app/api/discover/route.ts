import { NextResponse } from 'next/server';

/**
 * GET /api/discover — Probe common local LLM ports.
 *
 * For each port that responds within 2 seconds, attempt to fetch /v1/models.
 * Returns an array of discovered providers.
 */
export async function GET() {
  try {
    const portsToProbe = [
      { port: 11434, name: 'Ollama', modelsPath: '/api/tags', type: 'ollama' },
      { port: 1234, name: 'LM Studio', modelsPath: '/v1/models', type: 'lmstudio' },
      { port: 8000, name: 'vLLM', modelsPath: '/v1/models', type: 'vllm' },
      { port: 8080, name: 'Local Server', modelsPath: '/v1/models', type: 'custom' },
      { port: 5001, name: 'KoboldCpp', modelsPath: '/v1/models', type: 'koboldcpp' },
    ];

    const results = await Promise.allSettled(
      portsToProbe.map((p) => probePort(p))
    );

    const discovered: Array<{
      port: number;
      baseUrl: string;
      models: string[];
      type: string;
      name: string;
    }> = [];

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === 'fulfilled' && result.value) {
        discovered.push({
          ...result.value,
          name: portsToProbe[i].name,
        });
      }
    }

    return NextResponse.json(discovered);
  } catch (error) {
    console.error('[GET /api/discover]', error);
    return NextResponse.json(
      { error: 'Discovery failed' },
      { status: 500 }
    );
  }
}

/**
 * Probe a single port with a 2-second timeout.
 * Returns provider info if the port is reachable, or null otherwise.
 */
async function probePort(config: {
  port: number;
  modelsPath: string;
  type: string;
}): Promise<{
  port: number;
  baseUrl: string;
  models: string[];
  type: string;
} | null> {
  const baseUrl = `http://localhost:${config.port}`;
  const modelsUrl = `${baseUrl}${config.modelsPath}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const models = extractModelNames(data);

    return {
      port: config.port,
      baseUrl,
      models,
      type: config.type,
    };
  } catch {
    clearTimeout(timeout);
    return null;
  }
}

/**
 * Extract model names from various provider response formats.
 */
function extractModelNames(data: unknown): string[] {
  const d = data as Record<string, unknown>;

  // OpenAI-compatible: { data: [{ id: "..." }] }
  if (Array.isArray(d.data)) {
    return (d.data as Array<Record<string, unknown>>)
      .map((m) => m.id as string)
      .filter(Boolean);
  }

  // Ollama: { models: [{ name: "..." }] }
  if (Array.isArray(d.models)) {
    return (d.models as Array<Record<string, unknown>>)
      .map((m) => m.name as string)
      .filter(Boolean);
  }

  return [];
}
