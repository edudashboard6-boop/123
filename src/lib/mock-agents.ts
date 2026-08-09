// =============================================================================
// Built-in simulation fallback for the multi-agent pipeline.
// Used when no LLM provider is configured for an agent, or when a provider
// call fails — the UI keeps working smoothly without external dependencies.
// =============================================================================

const CODE_FENCE = '\x60\x60\x60';

export interface MockAgentMessage {
  role: string;
  agentName: string;
  content: string;
  modelUsed: string;
  tokens: number;
  cost: number;
  toolCalls: Array<{ name: string; args: Record<string, unknown> }>;
  debateData: Record<string, unknown>;
}

export function extractKeywords(message: string): string[] {
  const stopWords = new Set([
    'i', 'me', 'my', 'we', 'our', 'you', 'your', 'it', 'its', 'the', 'a', 'an',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do',
    'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall',
    'can', 'need', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as',
    'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between',
    'out', 'off', 'over', 'under', 'again', 'then', 'once', 'here', 'there',
    'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'not', 'only', 'own', 'same', 'so', 'than',
    'too', 'very', 'just', 'because', 'but', 'and', 'or', 'if', 'while', 'that',
    'this', 'these', 'those', 'what', 'which', 'who', 'whom', 'about', 'up',
    'make', 'please', 'help', 'want', 'create', 'build', 'write', 'get', 'give',
    'tell', 'show', 'explain', 'how',
  ]);
  return message
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w))
    .slice(0, 10);
}

export function detectTopic(keywords: string[]): string {
  const map: Record<string, string[]> = {
    'API/Backend': ['api', 'backend', 'server', 'endpoint', 'rest', 'graphql', 'database', 'sql', 'prisma', 'auth', 'jwt'],
    'Frontend/UI': ['frontend', 'ui', 'component', 'react', 'next', 'css', 'tailwind', 'button', 'page', 'layout'],
    'DevOps/Infra': ['docker', 'deploy', 'ci', 'cd', 'kubernetes', 'aws', 'cloud', 'terraform'],
    'Data/ML': ['model', 'training', 'data', 'ml', 'ai', 'neural', 'tensor', 'embedding', 'vector'],
    'Security': ['security', 'vulnerability', 'encrypt', 'hash', 'permission', 'xss', 'csrf'],
    'General Engineering': ['code', 'function', 'class', 'module', 'package', 'test', 'debug', 'refactor', 'optimize'],
  };
  for (const [topic, kws] of Object.entries(map)) {
    if (keywords.some((k) => kws.includes(k))) return topic;
  }
  return 'General Software Engineering';
}

function toPascalCase(str: string): string {
  return str.split(/[-_\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

/**
 * Generate the full set of simulated multi-agent responses for a message.
 * Mirrors the real debate pipeline shape so the UI contract is identical.
 */
export function generateMockAgentResponses(message: string, mode: string): MockAgentMessage[] {
  const msgs: MockAgentMessage[] = [];

  const keywords = extractKeywords(message);
  const topic = detectTopic(keywords);
  const kw = keywords.length > 0 ? keywords.slice(0, 4).join(', ') : 'the requested task';

  const archContent = '## Task Analysis\n\n'
    + "I've analyzed the request regarding **" + kw + '**. This falls under **' + topic + '**.\n\n'
    + '### Decomposition\n\n'
    + '1. **Requirements** \u2014 Identify core functional requirements around ' + kw + '\n'
    + '2. **Architecture** \u2014 Design system structure with proper separation of concerns\n'
    + '3. **Implementation** \u2014 Map out steps, prioritize critical path\n'
    + '4. **Validation** \u2014 Define testing and acceptance criteria\n\n'
    + '- **Complexity**: Medium-High\n'
    + '- **Risk Areas**: Interface contracts, data consistency, error propagation\n'
    + '- **Estimated Scope**: ' + (Math.floor(Math.random() * 5) + 3) + '-' + (Math.floor(Math.random() * 8) + 8) + ' files\n\n'
    + 'Handing off to FORGE for implementation.';

  msgs.push({
    role: 'architect',
    agentName: 'ARCHITECT',
    content: archContent,
    modelUsed: 'nexus-sim-1',
    tokens: Math.round(archContent.split(/\s+/).length * 1.3),
    cost: 0,
    toolCalls: [{ name: 'analyze_task', args: { complexity: 'medium' } }],
    debateData: { phase: 'draft', confidence: 0.85 },
  });

  if (mode === 'fast') return msgs;

  const pascalName = toPascalCase(keywords[0] || 'Task');
  const forgeFileName = 'src/' + pascalName + '.ts';
  const forgeContent = '## Implementation \u2014 ' + topic + '\n\n'
    + 'Based on the architectural plan, here is the implementation for **' + kw + '**.\n\n'
    + '### Core Code\n\n'
    + CODE_FENCE + 'typescript\n'
    + '// ' + forgeFileName + '\n'
    + 'interface ' + pascalName + 'Config {\n'
    + '  id: string;\n'
    + '  options: Record<string, unknown>;\n'
    + '  enabled: boolean;\n'
    + '}\n\n'
    + 'async function execute' + pascalName + '(\n'
    + '  config: ' + pascalName + 'Config,\n'
    + '  context: ExecutionContext\n'
    + '): Promise<Result> {\n'
    + '  if (!config.id) {\n'
    + '    throw new ValidationError("Configuration ID is required");\n'
    + '  }\n'
    + '  const pipeline = createPipeline(config.options);\n'
    + '  try {\n'
    + '    const result = await pipeline.run(context);\n'
    + '    return { success: true, data: result, timestamp: Date.now() };\n'
    + '  } catch (error) {\n'
    + '    logger.error("Pipeline execution failed", { configId: config.id, error });\n'
    + '    throw new ProcessingError("Failed to execute pipeline", { cause: error });\n'
    + '  }\n'
    + '}\n'
    + CODE_FENCE + '\n\n'
    + '### Design Decisions\n\n'
    + '- Pipeline pattern for composable processing\n'
    + '- Repository pattern for data access\n'
    + '- Retry with exponential backoff for external calls\n'
    + '- Input sanitization and output validation\n\n'
    + 'Ready for review.';

  msgs.push({
    role: 'forge',
    agentName: 'FORGE',
    content: forgeContent,
    modelUsed: 'nexus-sim-1',
    tokens: Math.round(forgeContent.split(/\s+/).length * 1.3),
    cost: 0,
    toolCalls: [{ name: 'generate_code', args: { language: 'typescript' } }],
    debateData: { phase: 'draft', confidence: 0.9 },
  });

  const isAggressive = mode === 'redteam';
  const issues = isAggressive
    ? ['Critical: Race condition in concurrent execution scenarios', 'High: Missing input validation in createPipeline', 'Medium: Retry logic documented but not implemented', 'Low: Consider rate limiting']
    : ['Minor: Error handling could be more granular', 'Suggestion: Add cancellation mechanism for long operations'];

  const sentinelContent = '## Review \u2014 ' + (isAggressive ? '\U0001f534 RED TEAM' : '\U0001F7E2 STANDARD') + '\n\n'
    + '### Issues Found (' + issues.length + ')\n\n'
    + issues.map((issue, i) => (i + 1) + '. ' + issue).join('\n') + '\n\n'
    + '### Strengths\n\n'
    + '- Clean separation of concerns\n'
    + '- Good TypeScript typing\n'
    + '- Proper error class hierarchy\n\n'
    + (isAggressive
      ? '**VERDICT: NEEDS REVISIONS** \u2014 Critical issues require attention.'
      : '**VERDICT: APPROVED WITH SUGGESTIONS** \u2014 Solid implementation.');

  msgs.push({
    role: 'sentinel',
    agentName: 'SENTINEL',
    content: sentinelContent,
    modelUsed: 'nexus-sim-1',
    tokens: Math.round(sentinelContent.split(/\s+/).length * 1.3),
    cost: 0,
    toolCalls: [{ name: 'review_output', args: { strictness: isAggressive ? 'high' : 'normal' } }],
    debateData: {
      phase: 'critique',
      verdict: isAggressive ? 'needs_revisions' : 'approved',
      findings: issues.map((desc, i) => ({
        severity: (isAggressive ? ['critical', 'major', 'minor', 'suggestion'] : ['minor', 'suggestion'])[i],
        location: 'implementation.ts',
        description: desc,
        remediation: 'Address the identified issue',
      })),
    },
  });

  const arbContent = '## Arbitration \u2014 Final Decision\n\n'
    + "I've reviewed the full debate for **" + kw + '**.\n\n'
    + (isAggressive
      ? 'FORGE must address the race condition and implement retry logic. The core architecture is sound \u2014 these are implementation fixes.\n\n'
      : 'Accepting the implementation with minor refinements.\n\n')
    + '### Action Items\n\n'
    + '1. \u2705 Architecture \u2014 Approved\n'
    + '2. ' + (isAggressive ? '\U0001F504 Implementation \u2014 Revisions required' : '\u2705 Implementation \u2014 Approved') + '\n'
    + '3. ' + (isAggressive ? '\u26A0\uFE0F ' + issues.length + ' issues must be resolved' : '\U0001F4DD Suggestions noted') + '\n\n'
    + '**Confidence: ' + (isAggressive ? '82%' : '93%') + '**\n\n'
    + '---\n*Deliberation complete.*';

  msgs.push({
    role: 'architect',
    agentName: 'ARCHITECT',
    content: arbContent,
    modelUsed: 'nexus-sim-1',
    tokens: Math.round(arbContent.split(/\s+/).length * 1.3),
    cost: 0,
    toolCalls: [{ name: 'arbitrate', args: { decision: isAggressive ? 'revise' : 'approve' } }],
    debateData: { phase: 'arbitrate', verdict: isAggressive ? 'proceed_with_revisions' : 'approved' },
  });

  return msgs;
}