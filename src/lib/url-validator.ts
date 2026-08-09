/**
 * Validation helpers for server-side outbound requests.
 */

/**
 * Strict URL safety check: rejects non-http(s) schemes and private/internal
 * networks. Used for arbitrary outbound fetches where SSRF is a concern.
 */
export function isSafeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);

    // Only allow http and https schemes
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    // Block common private/internal hostnames
    const hostname = parsed.hostname.toLowerCase();
    const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
    if (blockedHosts.includes(hostname)) return false;

    // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x, 169.254.x.x)
    if (/^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.)/.test(hostname)) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function isLoopbackOrPrivate(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1', '::ffff:127.0.0.1'].includes(host)) {
    return true;
  }
  return /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|127\.)/.test(host);
}

/**
 * URL check for LLM provider endpoints.
 *
 * NEXUS is a local-first orchestration harness: connecting to Ollama,
 * LM Studio, vLLM, etc. on the same machine (or LAN) is the core feature,
 * so loopback/private addresses are allowed unless explicitly disabled.
 *
 * Set NEXUS_ALLOW_LOCAL_PROVIDERS=false to enforce the strict policy
 * (public endpoints only) in shared or multi-tenant deployments.
 */
export function isAllowedProviderUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return false;

    const allowLocal = process.env.NEXUS_ALLOW_LOCAL_PROVIDERS !== 'false';
    if (isLoopbackOrPrivate(parsed.hostname)) return allowLocal;

    return true;
  } catch {
    return false;
  }
}

/**
 * Validate a provider type against the allowed list.
 */
const ALLOWED_PROVIDER_TYPES = [
  'openai',
  'anthropic',
  'google',
  'mistral',
  'groq',
  'together',
  'ollama',
  'lmstudio',
  'vllm',
  'llamacpp',
  'koboldcpp',
  'custom',
] as const;

export function isValidProviderType(type: string): boolean {
  return (ALLOWED_PROVIDER_TYPES as readonly string[]).includes(type);
}