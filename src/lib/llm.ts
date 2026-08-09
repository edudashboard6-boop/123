import { isAllowedProviderUrl } from './url-validator';

// =============================================================================
// NEXUS LLM Gateway — provider-agnostic LLM client
//
// Supports OpenAI-compatible endpoints (OpenAI, Mistral, Groq, Together,
// LM Studio, vLLM, llama.cpp, custom), Ollama, Anthropic Messages API,
// Google (Gemini) generateContent API, and KoboldCpp.
// =============================================================================

export interface LLMRequestOptions {
  provider: {
    id: string;
    type: string;
    baseUrl: string;
    apiKey: string;
  };
  model: string;
  systemPrompt: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResult {
  content: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  model: string;
  tool: Array<{ name: string; args: Record<string, unknown> }>;
}

export class LLMError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'LLMError';
  }
}

// 30s is generous for cloud APIs; hangs on unreachable local endpoints
// degrade to the mock fallback quickly instead of stalling the debate.
const LLM_TIMEOUT_MS = 30_000;

function normalizeBaseUrl(baseUrl: string): string {
  // The standalone server can hang on a bare 'localhost' lookup in some
  // runtime sandboxes; prefer the unambiguous loopback form for local use.
  return baseUrl.replace(/\/+$/, '').replace(/^http:\/\/localhost(?=:|\/|$)/, 'http://127.0.0.1');
}

/** Resolve the chat endpoint for a provider. */
function resolveEndpoint(provider: LLMRequestOptions['provider']): string {
  const base = normalizeBaseUrl(provider.baseUrl);
  switch (provider.type) {
    case 'ollama':
      return `${base}/api/chat`;
    case 'anthropic':
      return `${base}/messages`;
    case 'koboldcpp':
      return `${base}/api/v1/chat/completions`;
    case 'google':
      return `${base}/models:generateContent`;
    default:
      // OpenAI-compatible: avoid appending /v1 when the base URL already ends with it
      return /\/v\d+$/.test(base) ? `${base}/chat/completions` : `${base}/v1/chat/completions`;
  }
}

async function parseJson(res: Response): Promise<Record<string, unknown> | null> {
  try {
    const data = (await res.json()) as unknown;
    return data !== null && typeof data === 'object' ? (data as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function extractOpenAIContent(json: Record<string, unknown> | null): string {
  const choices = json?.choices as Array<{ message?: { content?: string } }> | undefined;
  const content = choices?.[0]?.message?.content ?? '';
  return typeof content === 'string' ? content.trim() : '';
}

function extractOpenAIUsage(json: Record<string, unknown> | null) {
  const usage = json?.usage as Record<string, number> | undefined;
  return {
    promptTokens: usage?.prompt_tokens ?? 0,
    completionTokens: usage?.completion_tokens ?? 0,
  };
}

/**
 * Estimate the USD cost of a call using a small per-model price table.
 * Local models (Ollama, LM Studio, vLLM, llama.cpp, KoboldCpp) are free.
 */
export function estimateCost(
  providerType: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  if (['ollama', 'lmstudio', 'vllm', 'llamacpp', 'koboldcpp'].includes(providerType)) {
    return 0;
  }

  const m = model.toLowerCase();
  let per1K: [number, number] = [0.001, 0.002]; // generic default

  if (m.includes('gpt-4o-mini')) per1K = [0.00015, 0.0006];
  else if (m.includes('gpt-4o')) per1K = [0.0025, 0.01];
  else if (m.includes('gpt-4-turbo')) per1K = [0.01, 0.03];
  else if (m.includes('gpt-3.5')) per1K = [0.0005, 0.0015];
  else if (m.includes('o3')) per1K = [0.0011, 0.0044];
  else if (m.includes('o1')) per1K = [0.015, 0.06];
  else if (m.includes('claude-sonnet')) per1K = [0.003, 0.015];
  else if (m.includes('claude-haiku')) per1K = [0.0008, 0.004];
  else if (m.includes('claude-opus')) per1K = [0.015, 0.075];
  else if (m.includes('gemini-1.5-pro')) per1K = [0.00125, 0.005];
  else if (m.includes('gemini-2.0-flash') || m.includes('gemini-1.5-flash')) per1K = [0.0001, 0.0004];
  else if (m.includes('llama-3.1-70b')) per1K = [0.00059, 0.00079];
  else if (m.includes('mixtral')) per1K = [0.00024, 0.00024];
  else if (m.includes('mistral-large')) per1K = [0.002, 0.006];
  else if (m.includes('codestral')) per1K = [0.0003, 0.0009];

  return (promptTokens * per1K[0] + completionTokens * per1K[1]) / 1000;
}

/** Google (Gemini) generateContent API. */
async function requestGoogle(
  provider: LLMRequestOptions['provider'],
  opts: LLMRequestOptions,
  model: string,
): Promise<LLMResult> {
  const base = normalizeBaseUrl(provider.baseUrl);
  const url = `${base}/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(provider.apiKey)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    body: JSON.stringify({
      contents: opts.messages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      })),
      systemInstruction: { parts: [{ text: opts.systemPrompt }] },
      generationConfig: {
        temperature: opts.temperature ?? 0.7,
        maxOutputTokens: opts.maxTokens ?? 4096,
      },
    }),
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => '')).substring(0, 300);
    throw new LLMError(`Google API returned ${res.status}: ${text}`, res.status);
  }

  const json = await parseJson(res);
  const candidates = json?.candidates as
    | Array<{ content?: { parts?: Array<{ text?: string }> } }>
    | undefined;
  const content = (candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? '')
    .join('')
    .trim();

  const usage = json?.usageMetadata as Record<string, number> | undefined;
  const promptTokens = usage?.promptTokenCount ?? 0;
  const completionTokens = usage?.candidatesTokenCount ?? 0;

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cost: estimateCost(provider.type, model, promptTokens, completionTokens),
    model,
    tool: [],
  };
}

/** OpenAI-compatible chat completions. */
async function requestOpenAICompatible(
  provider: LLMRequestOptions['provider'],
  opts: LLMRequestOptions,
  model: string,
): Promise<LLMResult> {
  const url = resolveEndpoint(provider);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider.apiKey) headers['Authorization'] = `Bearer ${provider.apiKey}`;

  const res = await fetch(url, {
    method: 'POST',
    headers,
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: opts.systemPrompt }, ...opts.messages],
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
      stream: false,
    }),
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => '')).substring(0, 300);
    throw new LLMError(`API returned ${res.status}: ${text}`, res.status);
  }

  const json = await parseJson(res);
  const content = extractOpenAIContent(json);
  const usage = extractOpenAIUsage(json);
  const toolChoices = (json?.choices as Array<{ message?: { tool_calls?: Array<{ function?: { name?: string; arguments?: string } }> } }> | undefined) ?? [];
  const toolCalls = toolChoices[0]?.message?.tool_calls ?? [];
  const tool: Array<{ name: string; args: Record<string, unknown> }> = [];
  for (const tc of toolCalls) {
    if (!tc?.function?.name) continue;
    let args: Record<string, unknown> = {};
    try {
      args = JSON.parse(tc.function.arguments ?? '{}') as Record<string, unknown>;
    } catch {
      args = {};
    }
    tool.push({ name: tc.function.name, args });
  }

  return {
    content,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.promptTokens + usage.completionTokens,
    cost: estimateCost(provider.type, model, usage.promptTokens, usage.completionTokens),
    model,
    tool,
  };
}

/** Ollama chat API. */
async function requestOllama(
  provider: LLMRequestOptions['provider'],
  opts: LLMRequestOptions,
  model: string,
): Promise<LLMResult> {
  const url = `${normalizeBaseUrl(provider.baseUrl)}/api/chat`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      messages: [{ role: 'system', content: opts.systemPrompt }, ...opts.messages],
      stream: false,
      options: {
        temperature: opts.temperature ?? 0.7,
        num_predict: opts.maxTokens ?? 4096,
      },
    }),
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => '')).substring(0, 300);
    throw new LLMError(`Ollama returned ${res.status}: ${text}`, res.status);
  }

  const json = await parseJson(res);
  const content = ((json?.message as Record<string, unknown> | undefined)?.content as string | undefined) ?? '';
  const promptTokens = (json?.prompt_eval_count as number | undefined) ?? 0;
  const completionTokens = (json?.eval_count as number | undefined) ?? 0;

  return {
    content: content.trim(),
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cost: 0,
    model,
    tool: [],
  };
}

/** Anthropic Messages API. */
async function requestAnthropic(
  provider: LLMRequestOptions['provider'],
  opts: LLMRequestOptions,
  model: string,
): Promise<LLMResult> {
  const url = `${normalizeBaseUrl(provider.baseUrl)}/messages`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    body: JSON.stringify({
      model,
      system: opts.systemPrompt,
      messages: opts.messages,
      temperature: opts.temperature ?? 0.7,
      max_tokens: opts.maxTokens ?? 4096,
    }),
  });

  if (!res.ok) {
    const text = (await res.text().catch(() => '')).substring(0, 300);
    throw new LLMError(`Anthropic returned ${res.status}: ${text}`, res.status);
  }

  const json = await parseJson(res);
  const content = ((json?.content as Array<{ type?: string; text?: string }> | undefined) ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text ?? '')
    .join('')
    .trim();

  const usage = json?.usage as Record<string, number> | undefined;
  const promptTokens = usage?.input_tokens ?? 0;
  const completionTokens = usage?.output_tokens ?? 0;

  return {
    content,
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    cost: estimateCost(provider.type, model, promptTokens, completionTokens),
    model,
    tool: [],
  };
}

/**
 * Make a single LLM completion call against the given provider.
 * Throws LLMError on misconfiguration, connection, or API failures.
 */
export async function callLLM(opts: LLMRequestOptions): Promise<LLMResult> {
  const { provider, model } = opts;

  if (!model) {
    throw new LLMError('No model selected for this agent');
  }
  if (!provider.baseUrl) {
    throw new LLMError('Provider has no base URL configured');
  }
  if (!isAllowedProviderUrl(provider.baseUrl)) {
    throw new LLMError('Provider URL is invalid or blocked');
  }

  switch (provider.type) {
    case 'google':
      return requestGoogle(provider, opts, model);
    case 'anthropic':
      return requestAnthropic(provider, opts, model);
    case 'ollama':
      return requestOllama(provider, opts, model);
    default:
      return requestOpenAICompatible(provider, opts, model);
  }
}