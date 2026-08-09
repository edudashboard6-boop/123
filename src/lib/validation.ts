import { z } from 'zod';

// =============================================================================
// Request validation schemas shared by the API routes.
// =============================================================================

export const chatMessageSchema = z.object({
  sessionId: z.string().trim().min(1).max(128),
  content: z.string().trim().min(1).max(50_000),
});

export const createSessionSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(['fast', 'council', 'redteam']).optional(),
});

export const providerCreateSchema = z.object({
  name: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(30),
  baseUrl: z.string().trim().max(500).optional(),
  apiKey: z.string().max(1000).optional(),
  isLocal: z.boolean().optional(),
  isActive: z.boolean().optional(),
  models: z.array(z.string().max(200)).max(500).optional(),
});

export const probeModelsSchema = z.object({
  type: z.string().trim().min(1).max(30),
  baseUrl: z.string().trim().min(1).max(500),
  apiKey: z.string().max(1000).optional(),
});

export const mcpServerSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().max(500).optional(),
  transport: z.enum(['stdio', 'sse', 'streamable-http']).optional(),
  command: z.string().max(500).optional(),
  args: z.array(z.string().max(200)).max(100).optional(),
  url: z.string().max(500).optional(),
  envVars: z
    .record(z.string().max(100), z.string().max(1000))
    .refine((v) => Object.keys(v).length <= 50, 'Too many environment variables'),
  isActive: z.boolean().optional(),
  tools: z.array(z.unknown()).max(200).optional(),
});

export const agentPatchSchema = z.object({
  agentId: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1).max(100).optional(),
  description: z.string().max(2000).optional(),
  systemPrompt: z.string().max(50_000).optional(),
  providerId: z.string().max(128).nullable().optional(),
  modelId: z.string().max(200).optional(),
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().int().min(1).max(100_000).optional(),
  tools: z.array(z.string().max(100)).max(100).optional(),
  is_active: z.boolean().optional(),
});

export const settingsPatchSchema = z.object({
  key: z.string().trim().min(1).max(50),
  value: z.string().max(4000),
});

export const webSearchSchema = z.object({
  query: z.string().trim().min(1).max(200),
});