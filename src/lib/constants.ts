import type {
  ProviderType,
  AgentId,
  DebatePhase,
} from '@/lib/types';

// =============================================================================
// Provider Definitions
// =============================================================================

export interface ProviderDefinition {
  value: ProviderType;
  label: string;
  isLocal: boolean;
  defaultBaseUrl: string;
  icon: string;
  models: string[];
}

export const PROVIDER_TYPES: ProviderDefinition[] = [
  {
    value: 'openai',
    label: 'OpenAI',
    isLocal: false,
    defaultBaseUrl: 'https://api.openai.com/v1',
    icon: 'OpenAI',
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o3', 'gpt-4-turbo'],
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    isLocal: false,
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    icon: 'Anthropic',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229'],
  },
  {
    value: 'google',
    label: 'Google AI',
    isLocal: false,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    icon: 'Google',
    models: ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-2.0-flash'],
  },
  {
    value: 'mistral',
    label: 'Mistral',
    isLocal: false,
    defaultBaseUrl: 'https://api.mistral.ai/v1',
    icon: 'Mistral',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'codestral-latest', 'pixtral-large-latest'],
  },
  {
    value: 'groq',
    label: 'Groq',
    isLocal: false,
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    icon: 'Groq',
    models: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
  },
  {
    value: 'together',
    label: 'Together AI',
    isLocal: false,
    defaultBaseUrl: 'https://api.together.xyz/v1',
    icon: 'Together',
    models: ['meta-llama/Llama-3.1-70B-Instruct-Turbo', 'Qwen/Qwen2.5-72B-Instruct-Turbo'],
  },
  {
    value: 'ollama',
    label: 'Ollama',
    isLocal: true,
    defaultBaseUrl: 'http://localhost:11434',
    icon: 'Ollama',
    models: ['llama3.1:70b', 'llama3.1:8b', 'mistral:7b', 'codellama:13b'],
  },
  {
    value: 'lmstudio',
    label: 'LM Studio',
    isLocal: true,
    defaultBaseUrl: 'http://localhost:1234/v1',
    icon: 'LMStudio',
    models: ['lm-studio-model'],
  },
  {
    value: 'vllm',
    label: 'vLLM',
    isLocal: true,
    defaultBaseUrl: 'http://localhost:8000/v1',
    icon: 'VLLM',
    models: ['vllm-served-model'],
  },
  {
    value: 'llamacpp',
    label: 'llama.cpp',
    isLocal: true,
    defaultBaseUrl: 'http://localhost:8080',
    icon: 'LlamaCpp',
    models: ['llamacpp-model'],
  },
  {
    value: 'koboldcpp',
    label: 'KoboldCpp',
    isLocal: true,
    defaultBaseUrl: 'http://localhost:5001',
    icon: 'KoboldCpp',
    models: ['koboldcpp-model'],
  },
  {
    value: 'custom',
    label: 'Custom / OpenAI-Compatible',
    isLocal: false,
    defaultBaseUrl: '',
    icon: 'Custom',
    models: [],
  },
];

// =============================================================================
// Default Agent Definitions
// =============================================================================

export interface AgentDefinition {
  agentId: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  icon: string;
  color: string;
  tools: string[];
}

export const DEFAULT_AGENTS: AgentDefinition[] = [
  {
    agentId: 'architect',
    name: 'Architect',
    description:
      'Senior planner responsible for task decomposition, system design decisions, and serving as the debate arbiter across all agents.',
    systemPrompt: `You are the Architect, the senior planning agent in the NEXUS multi-agent orchestration system. Your primary responsibility is to receive high-level user requests and decompose them into well-structured, actionable task plans that other agents can execute efficiently.

When a user presents a request, analyze the requirements carefully and produce a detailed implementation plan that includes: (1) a breakdown of subtasks with clear dependencies, (2) technology and architecture recommendations, (3) risk assessment for each subtask, and (4) acceptance criteria for each deliverable. You must consider edge cases, performance implications, and maintainability.

During debate phases you serve as the arbiter. When Forge, Sentinel, and Perception present conflicting proposals or findings, you evaluate each position against the original requirements, weigh trade-offs objectively, and issue a final verdict that synthesizes the best elements of each perspective. Always explain the reasoning behind your arbitration decisions clearly.`,
    defaultTemperature: 0.3,
    defaultMaxTokens: 8192,
    icon: 'Architect',
    color: 'text-violet-500',
    tools: ['web_search', 'filesystem_read', 'rag_search'],
  },
  {
    agentId: 'forge',
    name: 'Forge',
    description:
      'Primary coding agent responsible for generating, refactoring, and testing production-quality code across multiple languages and frameworks.',
    systemPrompt: `You are Forge, the primary coding agent in the NEXUS multi-agent orchestration system. Your role is to translate architectural plans into clean, production-quality code. You write code that is well-typed, thoroughly documented, and follows established best practices for the relevant language and framework.

When generating code, always include: (1) proper error handling with meaningful messages, (2) input validation where appropriate, (3) performance-conscious patterns (avoid N+1 queries, unnecessary allocations, etc.), and (4) inline comments for non-obvious logic. Prefer composition over inheritance. Write tests alongside implementation code — every function should have corresponding unit tests covering happy paths and edge cases.

When receiving critique from Sentinel, respond constructively. If the critique identifies genuine issues, acknowledge them and provide corrected code. If you believe the critique is based on a misunderstanding, explain your reasoning calmly with concrete examples. Never introduce regressions when addressing review feedback.`,
    defaultTemperature: 0.2,
    defaultMaxTokens: 16384,
    icon: 'Forge',
    color: 'text-blue-500',
    tools: [
      'filesystem_read',
      'filesystem_write',
      'git_operations',
      'terminal_exec',
      'code_lint',
      'code_test',
    ],
  },
  {
    agentId: 'sentinel',
    name: 'Sentinel',
    description:
      'Adversarial review agent that rigorously analyzes proposals and code for correctness, security vulnerabilities, and logical flaws.',
    systemPrompt: `You are Sentinel, the adversarial review agent in the NEXUS multi-agent orchestration system. Your mission is to critically evaluate every plan, proposal, and code artifact produced by other agents — especially Forge. You approach each review with constructive skepticism, seeking correctness gaps, security vulnerabilities, performance pitfalls, and logical errors.

For each artifact you review, structure your findings by severity: critical (will cause failures or security breaches), major (significantly degrades quality or maintainability), minor (style, minor improvements), and suggestion (nice-to-have optimizations). Always provide a clear description of the issue, the exact location where it occurs, and a concrete remediation with corrected code when possible.

Be thorough but fair. Your goal is not to block progress but to ensure the final output is robust. When Forge responds to your critique, evaluate the response honestly — accept valid corrections and persist on genuine concerns. Track all findings through to resolution.`,
    defaultTemperature: 0.1,
    defaultMaxTokens: 8192,
    icon: 'Sentinel',
    color: 'text-red-500',
    tools: ['code_lint', 'code_test', 'web_search', 'filesystem_read'],
  },
  {
    agentId: 'perception',
    name: 'Perception',
    description:
      'Multimodal specialist that processes images, audio, and structured data, and manages external tool integrations and MCP servers.',
    systemPrompt: `You are Perception, the multimodal and tool specialist in the NEXUS multi-agent orchestration system. You handle tasks that require processing non-text inputs — images, audio files, PDFs, screenshots — and you are the primary interface for external tool integrations via the Model Context Protocol (MCP).

When processing images, provide detailed descriptions of visual content, identify UI elements in screenshots, extract text from photos via OCR, and analyze diagrams or charts. When processing audio, transcribe speech, identify speakers when possible, and summarize key points. For structured data, parse files, extract relevant fields, and present the information in a format useful to other agents.

You manage tool discovery and invocation across connected MCP servers. Before calling any external tool, verify it is available and understand its parameters. Always present tool results in a structured format and flag any anomalies or unexpected responses for Sentinel to review.`,
    defaultTemperature: 0.4,
    defaultMaxTokens: 4096,
    icon: 'Perception',
    color: 'text-amber-500',
    tools: [
      'ocr_extract',
      'vision_analyze',
      'audio_transcribe',
      'database_query',
      'filesystem_read',
    ],
  },
  {
    agentId: 'scribe',
    name: 'Scribe',
    description:
      'Documentation specialist responsible for generating READMEs, API docs, inline comments, changelogs, and technical explanations.',
    systemPrompt: `You are Scribe, the documentation specialist in the NEXUS multi-agent orchestration system. Your role is to ensure every artifact produced by the NEXUS system is accompanied by clear, comprehensive documentation that serves both developers and end-users.

When documenting code, produce: (1) README files with project overview, setup instructions, and usage examples, (2) inline JSDoc/TSDoc comments for all public APIs and complex functions, (3) architecture decision records (ADRs) for significant design choices, and (4) changelogs that accurately reflect changes between versions. Write in a concise, professional tone. Use markdown formatting effectively with proper headings, code blocks, tables, and cross-references.

You also summarize debate outcomes and agent discussions into clear decision documents. When agents reach consensus through debate, capture the final decision, the reasoning behind it, any dissenting opinions that were overridden, and the action items that follow. These summaries serve as the project's institutional memory.`,
    defaultTemperature: 0.5,
    defaultMaxTokens: 4096,
    icon: 'Scribe',
    color: 'text-green-500',
    tools: ['filesystem_read', 'filesystem_write', 'rag_search'],
  },
];

// =============================================================================
// Built-in Tool Definitions
// =============================================================================

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const BUILT_IN_TOOLS: ToolDefinition[] = [
  {
    id: 'web_search',
    name: 'Web Search',
    description:
      'Search the web for current information, documentation, and reference material using real-time search APIs.',
    category: 'information',
  },
  {
    id: 'filesystem_read',
    name: 'Filesystem Read',
    description:
      'Read files and directories from the local filesystem with support for glob patterns and line-range queries.',
    category: 'filesystem',
  },
  {
    id: 'filesystem_write',
    name: 'Filesystem Write',
    description:
      'Create, update, and delete files on the local filesystem. Supports creating new files and modifying existing ones.',
    category: 'filesystem',
  },
  {
    id: 'git_operations',
    name: 'Git Operations',
    description:
      'Execute Git commands including status, diff, log, commit, branch, merge, and push to manage source code repositories.',
    category: 'devops',
  },
  {
    id: 'terminal_exec',
    name: 'Terminal Exec',
    description:
      'Execute shell commands in a sandboxed terminal environment with configurable timeout and output capture.',
    category: 'system',
  },
  {
    id: 'code_lint',
    name: 'Code Lint',
    description:
      'Run static analysis and linting tools (ESLint, Pylint, etc.) on source code to identify style and error issues.',
    category: 'quality',
  },
  {
    id: 'code_test',
    name: 'Code Test',
    description:
      'Execute test suites (Jest, Pytest, etc.) and parse test results to report pass/fail status and coverage metrics.',
    category: 'quality',
  },
  {
    id: 'ocr_extract',
    name: 'OCR Extract',
    description:
      'Extract text from images, scanned documents, and screenshots using optical character recognition.',
    category: 'perception',
  },
  {
    id: 'vision_analyze',
    name: 'Vision Analyze',
    description:
      'Analyze images and screenshots to describe visual content, identify UI elements, and detect anomalies.',
    category: 'perception',
  },
  {
    id: 'audio_transcribe',
    name: 'Audio Transcribe',
    description:
      'Transcribe audio files and recordings to text, with optional speaker diarization and language detection.',
    category: 'perception',
  },
  {
    id: 'database_query',
    name: 'Database Query',
    description:
      'Execute SQL queries against connected databases and return structured results with schema-aware formatting.',
    category: 'data',
  },
  {
    id: 'rag_search',
    name: 'RAG Search',
    description:
      'Search the knowledge base using retrieval-augmented generation to find relevant documents and context.',
    category: 'knowledge',
  },
];

// =============================================================================
// Debate Phase Definitions
// =============================================================================

export interface DebatePhaseDefinition {
  phase: DebatePhase;
  label: string;
  description: string;
}

export const DEBATE_PHASES: DebatePhaseDefinition[] = [
  {
    phase: 'draft',
    label: 'Draft',
    description:
      'The Architect drafts the initial plan or Forge produces the first code artifact for review.',
  },
  {
    phase: 'critique',
    label: 'Critique',
    description:
      'Sentinel and other reviewing agents analyze the draft for correctness, security, and quality issues.',
  },
  {
    phase: 'rebuttal',
    label: 'Rebuttal',
    description:
      'The original author responds to critique findings, accepting valid corrections or defending decisions with evidence.',
  },
  {
    phase: 'arbitrate',
    label: 'Arbitrate',
    description:
      'The Architect evaluates all positions, weighs trade-offs, and issues a final synthesis verdict.',
  },
  {
    phase: 'verify',
    label: 'Verify',
    description:
      'Forge applies the arbitrated changes and Sentinel confirms all issues have been resolved satisfactorily.',
  },
  {
    phase: 'commit',
    label: 'Commit',
    description:
      'The final, approved artifact is committed to the knowledge base or codebase as the canonical output.',
  },
];
