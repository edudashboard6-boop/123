import { access, mkdir, readFile, readdir, rm, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, relative, resolve, sep } from 'path';

/**
 * Session-scoped workspaces.
 *
 * Layout on disk (inside the project root):
 *   workspace/                      global workspace (no session attached)
 *   workspace/sessions/<id>/        one directory per chat session
 *   workspace/.snapshots/<id>/<messageId>.json   file snapshots per assistant turn
 *
 * The .snapshots folder lives outside sessions/ so directory listings never
 * expose it; the snapshot walker also skips dot-entries and node_modules.
 */

export const WORKSPACE_ROOT = join(/*turbopackIgnore: true*/ process.cwd(), 'workspace');

export const MAX_INCLUDE_FILE = 1024 * 1024; // 1MB per file
export const MAX_SNAPSHOT_TOTAL = 20 * 1024 * 1024; // 20MB per snapshot

const SESSION_ID_RE = /^[A-Za-z0-9-]{8,64}$/;

export function isValidSessionId(id: string): boolean {
  return SESSION_ID_RE.test(id);
}

export function sessionWorkspaceDir(sessionId: string): string {
  return join(WORKSPACE_ROOT, 'sessions', sessionId);
}

export function sessionSnapshotDir(sessionId: string): string {
  return join(WORKSPACE_ROOT, '.snapshots', sessionId);
}

export function sessionSnapshotFile(sessionId: string, messageId: string): string {
  return join(sessionSnapshotDir(sessionId), `${messageId}.json`);
}

export async function ensureSessionWorkspace(sessionId: string): Promise<string> {
  const dir = sessionWorkspaceDir(sessionId);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

/**
 * Resolve a user-supplied relative path below an allowed root and reject
 * anything escaping it. Input is already URL-decoded by URLSearchParams /
 * form-data, so '+' is never rewritten.
 */
export function resolveWorkspacePath(
  root: string,
  relativePath: string,
): { ok: true; path: string } | { ok: false; reason: string } {
  const candidate = join(root, relativePath);
  const resolved = resolve(candidate);

  if (resolved !== root && !resolved.startsWith(root + sep)) {
    return { ok: false, reason: 'Access denied: path traversal detected' };
  }

  return { ok: true, path: resolved };
}

export interface SnapshotFileEntry {
  path: string;
  size: number;
  content: string;
}

export interface WorkspaceSnapshot {
  sessionId: string;
  messageId: string;
  timestamp: string;
  files: SnapshotFileEntry[];
  skipped: Array<{ path: string; size: string; reason: string }>;
}

async function walkForSnapshot(root: string, skipped: WorkspaceSnapshot['skipped']) {
  const files: SnapshotFileEntry[] = [];
  let total = 0;

  const walk = async (base: string, rel: string): Promise<void> => {
    const entries = await readdir(base, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;

      const full = join(base, entry.name);
      const childRel = rel ? `${rel}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(full, childRel);
        continue;
      }
      if (!entry.isFile()) continue;

      const buf = await readFile(full).catch(() => null);
      if (!buf) continue;

      if (buf.length > MAX_INCLUDE_FILE) {
        skipped.push({ path: childRel, size: String(buf.length), reason: 'exceeds 1MB file cap' });
        continue;
      }
      if (total + buf.length > MAX_SNAPSHOT_TOTAL) {
        skipped.push({ path: childRel, size: String(buf.length), reason: 'exceeds snapshot cap' });
        continue;
      }

      let content: string;
      try {
        content = buf.toString('utf8');
      } catch {
        skipped.push({ path: childRel, size: String(buf.length), reason: 'binary' });
        continue;
      }
      files.push({ path: childRel, size: buf.length, content });
      total += buf.length;
    }
  };

  await walk(root, '');
  return files;
}

/**
 * Persist the state of a session workspace keyed by message id. Returns the
 * snapshot filename when captured, or null when the workspace is empty /
 * missing.
 */
export async function snapshotSessionWorkspace(
  sessionId: string,
  messageId: string,
): Promise<string | null> {
  const root = sessionWorkspaceDir(sessionId);
  if (!existsSync(root)) return null;

  const skipped: WorkspaceSnapshot['skipped'] = [];
  const files = await walkForSnapshot(root, skipped);

  const snapshotDir = sessionSnapshotDir(sessionId);
  await mkdir(snapshotDir, { recursive: true });

  const snapshot: WorkspaceSnapshot = {
    sessionId,
    messageId,
    timestamp: new Date().toISOString(),
    files,
    skipped,
  };

  const file = sessionSnapshotFile(sessionId, messageId);
  await writeFile(file, JSON.stringify(snapshot), 'utf8');
  return file;
}

/**
 * Restore a session workspace from a snapshot captured at a message id.
 * Removes the live directory first, then recreates it from the snapshot.
 * Returns false when no snapshot exists for that message.
 */
export async function restoreSessionWorkspace(
  sessionId: string,
  messageId: string,
): Promise<boolean> {
  const file = sessionSnapshotFile(sessionId, messageId);
  if (!(await pathExists(file))) return false;

  let snapshot: WorkspaceSnapshot;
  try {
    snapshot = JSON.parse(await readFile(file, 'utf8')) as WorkspaceSnapshot;
  } catch {
    return false;
  }

  const dir = sessionWorkspaceDir(sessionId);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  for (const entry of snapshot.files || []) {
    const target = resolveWorkspacePath(dir, entry.path);
    if (!target.ok) continue;
    await mkdir(join(target.path, '..'), { recursive: true });
    await writeFile(target.path, entry.content, 'utf8');
  }

  return true;
}

/**
 * Persist agent-produced file artifacts (from fenced code blocks) into the
 * session workspace. Returns the relative paths that were written. Never
 * throws — chat must not fail because of storage.
 */
export async function writeExtractedFiles(
  sessionId: string,
  files: Array<{ path: string; content: string }>,
): Promise<string[]> {
  if (files.length === 0) return [];
  const written: string[] = [];
  try {
    const root = await ensureSessionWorkspace(sessionId);
    for (const file of files) {
      const target = resolveWorkspacePath(root, file.path);
      if (!target.ok) continue;
      await mkdir(join(target.path, '..'), { recursive: true });
      await writeFile(target.path, file.content, 'utf8');
      written.push(workspaceRelative(root, target.path));
    }
  } catch {
    // Storage failures should never break chat.
  }
  return written;
}

export async function deleteSessionWorkspace(sessionId: string): Promise<void> {
  await rm(sessionWorkspaceDir(sessionId), { recursive: true, force: true });
  await rm(sessionSnapshotDir(sessionId), { recursive: true, force: true });
}

export async function deleteMessageSnapshots(sessionId: string, messageIds: string[]): Promise<void> {
  const dir = sessionSnapshotDir(sessionId);
  for (const messageId of messageIds) {
    await rm(join(dir, `${messageId}.json`), { recursive: true, force: true }).catch(() => {});
  }
}

export function workspaceRelative(root: string, target: string): string {
  return relative(root, target);
}