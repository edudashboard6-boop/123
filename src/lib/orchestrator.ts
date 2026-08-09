import { db } from './db';
import { DEFAULT_AGENTS } from './constants';
import { callLLM, LLMError } from './llm';
import { generateMockAgentResponses, type MockAgentMessage } from './mock-agents';
import { ensureDefaultAgents } from './seed-agents';
import type { AgentId, DebateMode } from './types';

// =============================================================================
// Multi-agent debate orchestrator.
//
// Executes the agent pipeline defined by the session's debate mode against
// real LLM providers. Every step falls back to the built-in simulation when
// the agent has no configured/active provider or the provider call fails,
// so chat always completes smoothly.
// =============================================================================

export interface OrchestratedAgentMessage {
  role: AgentId;
  agentName: string;
  content: string;
  modelUsed: string;
  tokens: number;
  cost: number;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  debateData: Record<string, unknown>;
}

export interface OrchestrationResult {
  messages: OrchestratedAgentMessage[];
  /** True when at least one step used the built-in simulation. */
  usedFallback: boolean;
  /** Human-readable reasons for each fallback, surfaced as system notices. */
  fallbackReasons: string[];
}

interface AgentRuntime {
  agentId: AgentId;
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  isActive: boolean;
  modelId: string;
  provider: {
    id: string;
    type: string;
    baseUrl: string;
    apiKey: string;
    isActive: boolean;
  } | null;
}

interface PipelineStep {
  role: AgentId;
  name: string;
  phase: string;
  extraDirective?: string;
  isArbiter?: boolean;
}

const SIMULATED_MODEL = 'nexus-sim-1';
const MAX_HISTORY_MESSAGES = 12;
const MAX_PROMPT_CHARS = 32_000;

function pipelineForMode(mode: DebateMode): PipelineStep[] {
  switch (mode) {
    case 'fast':
      return [{ role: 'architect', name: 'ARCHITECT', phase: 'draft' }];
    case 'redteam':
      return [
        { role: 'architect', name: 'ARCHITECT', phase: 'draft' },
        { role: 'forge', name: 'FORGE', phase: 'draft' },
        {
          role: 'sentinel',
          name: 'SENTINEL',
          phase: 'critique',
          extraDirective:
            'You are operating in RED TEAM mode. Be extremely aggressive and adversarial: hunt for every possible critical vulnerability, race condition, and reliability gap. Treat the implementation as guilty until proven innocent.',
        },
        { role: 'architect', name: 'ARCHITECT', phase: 'arbitrate', isArbiter: true },
      ];
    case 'council':
      return [
        { role: 'architect', name: 'ARCHITECT', phase: 'draft' },
        { role: 'forge', name: 'FORGE', phase: 'draft' },
        {
          role: 'sentinel',
          name: 'SENTINEL',
          phase: 'critique',
          extraDirective:
            'Conduct a thorough, constructive review. Structure findings by severity (critical, major, minor, suggestion) and end with a clear verdict.',
        },
        { role: 'architect', name: 'ARCHITECT', phase: 'arbitrate', isArbiter: true },
      ];
    default:
      throw new Error(`Unknown debate mode: ${mode}`);
  }
}

async function loadRuntimeAgents(): Promise<AgentRuntime[]> {
  await ensureDefaultAgents();
  const rows = await db.agentConfig.findMany({ include: { provider: true } });

  const runtimes = new Map<AgentId, AgentRuntime>();
  for (const row of rows) {
    const agentId = row.agentId as AgentId;
    const providerRow = row.provider;
    runtimes.set(agentId, {
      agentId,
      name: row.name,
      systemPrompt: row.systemPrompt,
      temperature: row.temperature,
      maxTokens: row.maxTokens,
      isActive: row.is_active,
      modelId: row.modelId,
      provider: providerRow
        ? {
          id: providerRow.id,
          type: providerRow.type,
          baseUrl: providerRow.baseUrl,
          apiKey: providerRow.apiKey,
          isActive: providerRow.isActive,
        }
        : null,
    });
  }

  // Merge defaults so every agent has a definition even on a fresh
  // database where the UI reset hook has not run yet.
  for (const def of DEFAULT_AGENTS) {
    if (!runtimes.has(def.agentId)) {
      runtimes.set(def.agentId, {
        agentId: def.agentId,
        name: def.name.toUpperCase(),
        systemPrompt: def.systemPrompt,
        temperature: def.defaultTemperature,
        maxTokens: def.defaultMaxTokens,
        isActive: true,
        modelId: '',
        provider: null,
      });
    }
  }

  return Array.from(runtimes.values());
}

function buildSystemPrompt(agent: AgentRuntime, step: PipelineStep): string {
  let prompt = agent.systemPrompt || `You are the ${step.name} agent in the NEXUS system.`;

  if (step.isArbiter) {
    prompt += `\n\nYou are concluding this debate as the arbitrator. Review everything that has been proposed so far, weigh trade-offs against the original request, and issue a final verdict with clear action items.`;
  }
  if (step.extraDirective) {
    prompt += `\n\n${step.extraDirective}`;
  }
  if (step.role === 'forge') {
    prompt += `\n\nWhenever you write code, output each file as a fenced code block whose header is the relative file path, e.g. \`\`\`src/main.ts\`\`\`. One block per file. You may also name the path as the first comment line inside the block ("// src/main.ts"). Do not list file contents in prose.`;
  }

  return prompt;
}

function truncateTranscript(
  transcripts: Array<{ role: 'user' | 'assistant'; content: string }>,
): Array<{ role: 'user' | 'assistant'; content: string }> {
  let total = 0;
  const trimmed: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  for (const entry of transcripts) {
    const content = entry.content.length > 8000 ? entry.content.slice(0, 8000) + '…' : entry.content;
    total += content.length;
    if (total > MAX_PROMPT_CHARS) break;
    trimmed.push({ role: entry.role, content });
  }
  return trimmed;
}

/**
 * Orchestrate a full debate turn for a user message in a session.
 */
export async function orchestrateSession(
  sessionId: string,
  content: string,
  mode: DebateMode,
): Promise<OrchestrationResult> {
  const agents = await loadRuntimeAgents();
  const steps = pipelineForMode(mode);

  // Conversation history (excluding system notices) for context.
  const history = await db.chatMessage.findMany({
    where: { sessionId, role: { not: 'system' } },
    orderBy: { createdAt: 'asc' },
    take: MAX_HISTORY_MESSAGES,
  });

  const transcripts: Array<{ role: 'user' | 'assistant'; content: string }> = history.map((m) => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  const result: OrchestrationResult = { messages: [], usedFallback: false, fallbackReasons: [] };

  for (const step of steps) {
    const agent = agents.find((a) => a.agentId === step.role) ?? null;

    // Agent explicitly disabled — skip the step entirely.
    if (agent && !agent.isActive) continue;

    // Decide whether this step can run against a real provider.
    const canUseReal = Boolean(
      agent &&
      agent.modelId &&
      agent.provider &&
      agent.provider.isActive &&
      agent.provider.baseUrl,
    );

    let contentOut = '';
    let modelUsed = '';
    let tokens = 0;
    let cost = 0;
    let toolCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

    if (canUseReal && agent) {
      try {
        const llmResult = await callLLM({
          provider: agent.provider!,
          model: agent.modelId,
          systemPrompt: buildSystemPrompt(agent, step),
          messages: truncateTranscript(transcripts),
          temperature: agent.temperature,
          maxTokens: agent.maxTokens,
        });
        contentOut = llmResult.content;
        modelUsed = llmResult.model;
        tokens = llmResult.totalTokens;
        cost = llmResult.cost;
        toolCalls = llmResult.tool;
      } catch (error) {
        result.usedFallback = true;
        result.fallbackReasons.push(
          `${step.name}'s provider (${agent.provider?.type ?? 'unknown'}) failed: ${
            error instanceof LLMError ? error.message : 'unknown error'
          } — response simulated locally.`,
        );
      }
    } else if (!agent || !agent.provider || !agent.provider.isActive || !agent.modelId) {
      const reason = !agent
        ? `${step.name} has no agent configuration — response simulated locally.`
        : `${step.name} has no active provider or model configured — response simulated locally.`;
      result.usedFallback = true;
      result.fallbackReasons.push(reason);
    }

    // Fallback to the built-in simulation if nothing real was produced.
    if (!contentOut) {
      const mockMsgs = generateMockAgentResponses(content, mode);
      const mock = mockMsgs.find((m) => m.role === step.role && m.debateData.phase === step.phase)
        ?? mockMsgs.find((m) => m.role === step.role);
      if (mock) {
        contentOut = mock.content;
        modelUsed = SIMULATED_MODEL;
        tokens = mock.tokens;
        cost = 0;
        toolCalls = mock.toolCalls;
      }
    }

    if (!contentOut) continue;

    const debateData: Record<string, unknown> =
      step.role === 'sentinel'
        ? { phase: step.phase, verdict: 'approved', confidence: 0.9 }
        : step.isArbiter
          ? { phase: step.phase, verdict: 'approved', confidence: 0.9 }
          : { phase: step.phase, confidence: 0.9 };

    result.messages.push({
      role: step.role,
      agentName: step.name,
      content: contentOut,
      modelUsed,
      tokens,
      cost,
      toolCalls,
      debateData,
    });

    // Feed this step's output back into the debate transcript.
    transcripts.push({ role: 'assistant', content: contentOut });
  }

  return result;
}
