import { isAllowedProviderUrl } from './url-validator';

/**
 * Fetch models from an OpenAI-compatible /v1/models endpoint.
 */
export async function fetchOpenAICompatibleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  if (!isAllowedProviderUrl(normalizedUrl)) throw new Error('Invalid or blocked URL');

  const url = normalizedUrl + '/models';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (apiKey) headers['Authorization'] = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`API returned ${res.status}: ${await res.text().catch(() => 'unknown error')}`);
  }

  const data = await res.json();
  const rawModels: Array<{ id: string }> = data.data ?? data.models ?? [];
  return rawModels.map((m) => m.id).sort();
}

/**
 * Fetch models from Google AI (Gemini) /v1beta/models endpoint.
 */
export async function fetchGoogleModels(baseUrl: string, apiKey: string): Promise<string[]> {
  const normalizedUrl = baseUrl.replace(/\/+$/, '');
  if (!isAllowedProviderUrl(normalizedUrl)) throw new Error('Invalid or blocked URL');

  const url = normalizedUrl + '/models?key=' + apiKey;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    throw new Error(`Google API returned ${res.status}: ${await res.text().catch(() => 'unknown error')}`);
  }

  const data = await res.json();
  const rawModels: Array<{ name: string; supportedGenerationMethods?: string[] }> = data.models ?? [];

  return rawModels
    .filter((m) => !m.supportedGenerationMethods || m.supportedGenerationMethods.includes('generateContent'))
    .map((m) => m.name.startsWith('models/') ? m.name.slice(7) : m.name)
    .sort();
}

/**
 * Fetch models for Anthropic (try OpenAI-compatible first, fallback to known list).
 */
export async function fetchAnthropicModels(baseUrl: string, apiKey: string): Promise<string[]> {
  try {
    return await fetchOpenAICompatibleModels(baseUrl, apiKey);
  } catch {
    return [
      'claude-sonnet-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ];
  }
}

/**
 * Fetch models based on provider type.
 */
export async function fetchModelsForProvider(type: string, baseUrl: string, apiKey: string): Promise<string[]> {
  switch (type) {
    case 'google':
      return fetchGoogleModels(baseUrl, apiKey);
    case 'anthropic':
      return fetchAnthropicModels(baseUrl, apiKey);
    default:
      return fetchOpenAICompatibleModels(baseUrl, apiKey);
  }
}

/**
 * Extract model IDs from various provider response formats (legacy, for /api/providers GET test action).
 */
export function extractModels(data: unknown, type: string): string[] {
  const d = data as Record<string, unknown>;

  // OpenAI-compatible: { data: [{ id: "..." }] }
  if (Array.isArray(d.data)) {
    return (d.data as Array<Record<string, unknown>>)
      .map((m) => m.id as string)
      .filter(Boolean);
  }

  // Ollama: { models: [{ name: "..." }] } — must check before Google since both use d.models
  if (type === 'ollama' && Array.isArray(d.models)) {
    return (d.models as Array<Record<string, unknown>>)
      .map((m) => m.name as string)
      .filter(Boolean);
  }

  // Google: { models: [{ name: "models/..." }] }
  if (Array.isArray(d.models)) {
    return (d.models as Array<Record<string, unknown>>)
      .map((m) => {
        const name = m.name as string;
        return name?.includes('/') ? name.split('/').pop() : name;
      })
      .filter((name): name is string => Boolean(name));
  }

  return [];
}
