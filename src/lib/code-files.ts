// =============================================================================
// Extraction of file artifacts from agent responses.
//
// Agents produce code inside fenced blocks. A fence becomes a workspace file
// when its header looks like a relative file path (e.g. "src/main.ts"), or
// when the first content line names a path as a comment (e.g. "// src/api.ts"
// or "# scripts/run.sh"). Plain language fences (typescript, bash, ...) are
// left in the chat transcript only.
// =============================================================================

export interface ExtractedFile {
  path: string;
  content: string;
}

const FENCE_RE = /(`{3,})([^\r\n`]*)\r?\n([\s\S]*?)\1/g;

// A relative path token: one or more segments, final segment carries a file
// extension. No leading dot segment, no absolute path, no backslashes.
const PATH_TOKEN_RE =
  /^(?!\.{1,2}(?:\/|$))[A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*\.[A-Za-z0-9][A-Za-z0-9._-]*$/;

// Language tags that are never file paths.
const NON_PATH_LANGS = new Set([
  'text',
  'plain',
  'plaintext',
  'console',
  'bash',
  'sh',
  'shell',
  'zsh',
  'markdown',
  'md',
  'diff',
  'mermaid',
  'plantuml',
]);

// First content line naming a path as a comment: `// src/main.ts`, `# run.sh`.
const PATH_COMMENT_LINE =
  /^\s*(?:\/\/|#|;|--)\s*([A-Za-z0-9][A-Za-z0-9._-]*(?:\/[A-Za-z0-9][A-Za-z0-9._-]*)*\/[A-Za-z0-9][A-Za-z0-9._-]*\.[A-Za-z0-9][A-Za-z0-9._-]*)\s*$/;

function isValidPath(path: string): boolean {
  if (!path) return false;
  if (path.length > 500) return false;
  if (path.startsWith('/') || path.includes('\\') || path.includes('\0')) return false;
  return PATH_TOKEN_RE.test(path);
}

/**
 * Extract path-labelled fenced code blocks from an agent message.
 */
export function extractCodeFiles(message: string): ExtractedFile[] {
  const files: ExtractedFile[] = [];
  const seen = new Set<string>();

  for (const block of message.matchAll(FENCE_RE)) {
    const header = block[2].trim();
    const content = block[3];
    const headerToken = header.split(/\s+/)[0] ?? '';

    let targetPath = '';
    if (isValidPath(headerToken)) {
      targetPath = headerToken;
    } else if (!NON_PATH_LANGS.has(headerToken.toLowerCase())) {
      // Fallback: the first non-empty line names the path as a comment.
      const firstLine = content.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
      const lineMatch = firstLine.match(PATH_COMMENT_LINE);
      if (lineMatch) targetPath = lineMatch[1];
    }

    if (!targetPath || seen.has(targetPath)) continue;
    seen.add(targetPath);

    // Strip the leading path-comment line when it was used as the marker.
    let body = content;
    const firstLine = body.split(/\r?\n/).find((l) => l.trim().length > 0) ?? '';
    if (firstLine.match(PATH_COMMENT_LINE)) {
      body = body.replace(firstLine, '').replace(/^\r?\n/, '');
    }

    files.push({ path: targetPath, content: body.replace(/\r?\n$/, '') });
  }

  return files;
}