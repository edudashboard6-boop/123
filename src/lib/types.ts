// =============================================================================
// NEXUS Multi-Agent LLM Orchestration — Core Type Definitions
// =============================================================================

/** Supported LLM provider backends */
export type ProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'mistral'
  | 'groq'
  | 'together'
  | 'ollama'
  | 'lmstudio'
  | 'vllm'
  | 'llamacpp'
  | 'koboldcpp'
  | 'custom';

/** Canonical identifier for each of the five NEXUS agents */
export type AgentId = 'architect' | 'forge' | 'sentinel' | 'perception' | 'scribe';

/** Debate orchestration modes */
export type DebateMode = 'fast' | 'council' | 'redteam';

/** Sequential phases within a single debate round */
export type DebatePhase = 'draft' | 'critique' | 'rebuttal' | 'arbitrate' | 'verify' | 'commit';

/** Message author roles (includes each agent and the user / system) */
export type MessageRole = 'user' | 'architect' | 'forge' | 'sentinel' | 'perception' | 'scribe' | 'system';

/** MCP server transport protocols */
export type TransportType = 'stdio' | 'sse' | 'streamable-http';

/** Primary navigation tabs in the NEXUS shell */
export type ViewTab = 'chat' | 'agents' | 'providers' | 'knowledge' | 'workspace' | 'tools' | 'settings';

// -----------------------------------------------------------------------------
// Provider
// -----------------------------------------------------------------------------

export interface LlmProvider {
  id: string;
  name: string;
  type: ProviderType;
  baseUrl: string;
  apiKey: string;
  isLocal: boolean;
  isActive: boolean;
  models: string[];
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Agent
// -----------------------------------------------------------------------------

export interface AgentConfig {
  id: string;
  agentId: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: string | null;
  modelId: string;
  temperature: number;
  maxTokens: number;
  tools: string[];
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  provider?: LlmProvider;
}

// -----------------------------------------------------------------------------
// Chat / Sessions / Messages
// -----------------------------------------------------------------------------

export interface ChatSession {
  id: string;
  title: string;
  mode: DebateMode;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  agentName: string;
  modelUsed: string;
  tokens: number;
  cost: number;
  toolCalls: ToolCall[];
  debateData?: DebateRound;
  createdAt: string;
}

// -----------------------------------------------------------------------------
// Tools & Tool Calls
// -----------------------------------------------------------------------------

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  result?: string;
  duration?: number;
  status: 'pending' | 'success' | 'error';
}

// -----------------------------------------------------------------------------
// Debate
// -----------------------------------------------------------------------------

export interface DebateRound {
  phase: DebatePhase;
  verdict?: string;
  findings?: DebateFinding[];
}

export interface DebateFinding {
  severity: 'critical' | 'major' | 'minor' | 'suggestion';
  location: string;
  description: string;
  remediation: string;
}

// -----------------------------------------------------------------------------
// MCP (Model Context Protocol)
// -----------------------------------------------------------------------------

export interface McpServer {
  id: string;
  name: string;
  description: string;
  transport: TransportType;
  command: string;
  args: string[];
  url: string;
  envVars: Record<string, string>;
  isActive: boolean;
  tools: McpTool[];
  createdAt: string;
  updatedAt: string;
}

export interface McpTool {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

// -----------------------------------------------------------------------------
// Knowledge / Documents
// -----------------------------------------------------------------------------

export interface KnowledgeDocument {
  id: string;
  filename: string;
  title: string;
  content: string;
  fileType: string;
  fileSize: number;
  embedding: number[];
  chunkCount: number;
  workspaceId: string;
  createdAt: string;
  updatedAt: string;
}

// -----------------------------------------------------------------------------
// Cost Tracking
// -----------------------------------------------------------------------------

export interface CostEntry {
  agentId: AgentId;
  agentName: string;
  tokens: number;
  cost: number;
  calls: number;
}

// -----------------------------------------------------------------------------
// Provider ↔ Model cross-reference (lightweight)
// -----------------------------------------------------------------------------

export interface ProviderModel {
  id: string;
  name: string;
  provider: string;
}
