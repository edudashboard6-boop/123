import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir, stat, mkdir, writeFile, rm, access } from 'fs/promises';
import { join, relative, sep } from 'path';
import { existsSync, statSync } from 'fs';
import { db } from '@/lib/db';
import {
  WORKSPACE_ROOT,
  isValidSessionId,
  sessionWorkspaceDir,
  ensureSessionWorkspace,
  resolveWorkspacePath,
  deleteSessionWorkspace,
  workspaceRelative,
} from '@/lib/workspace';

const MAX_FILE_SIZE = 50 * 1024 * 1024;

async function ensureWorkspace() {
  if (!existsSync(WORKSPACE_ROOT)) {
    await mkdir(WORKSPACE_ROOT, { recursive: true });
  }
}

function statSyncSafe(path: string) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

/**
 * Resolve the requested session. When sessionId is absent, operations target
 * the global workspace root. When present, the session must exist in the
 * database and the workspace is scoped to workspace/sessions/<sessionId>/.
 */
async function resolveRoot(
  sessionId: string | null,
): Promise<
  | { ok: true; root: string; sessionId: string | null }
  | { ok: false; status: number; error: string }
> {
  if (!sessionId) {
    await ensureWorkspace();
    return { ok: true, root: WORKSPACE_ROOT, sessionId: null };
  }

  if (!isValidSessionId(sessionId)) {
    return { ok: false, status: 400, error: 'Invalid session id' };
  }

  const session = await db.chatSession.findUnique({ where: { id: sessionId } });
  if (!session) {
    return { ok: false, status: 404, error: 'Session not found' };
  }

  const root = await ensureSessionWorkspace(sessionId);
  return { ok: true, root, sessionId };
}

// GET /api/workspace — List files or read a file within a (session) workspace
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path') || '';
    const sessionId = searchParams.get('sessionId');

    const rootRes = await resolveRoot(sessionId);
    if (!rootRes.ok) {
      return NextResponse.json({ error: rootRes.error }, { status: rootRes.status });
    }
    const root = rootRes.root;

    const resolvedRes = resolveWorkspacePath(root, filePath);
    if (!resolvedRes.ok) {
      return NextResponse.json({ error: resolvedRes.reason }, { status: 403 });
    }

    let fileStat = statSyncSafe(resolvedRes.path);
    if (!fileStat) {
      return NextResponse.json({ error: 'Path not found in workspace' }, { status: 404 });
    }

    // File — return its content
    if (fileStat.isFile()) {
      const content = await readFile(/*turbopackIgnore: true*/ resolvedRes.path, 'utf-8');
      const ext = resolvedRes.path.split('.').pop() || '';
      return NextResponse.json({
        type: 'file',
        name: resolvedRes.path.split(sep).pop() || '',
        path: workspaceRelative(root, resolvedRes.path),
        content,
        size: fileStat.size,
        extension: ext,
        sessionId,
      });
    }

    // Directory — list contents
    if (fileStat.isDirectory()) {
      const entries = await readdir(/*turbopackIgnore: true*/ resolvedRes.path, { withFileTypes: true });
      const items = entries
        .filter((e) => !e.name.startsWith('.') && e.name !== 'node_modules')
        .map((e) => ({
          name: e.name,
          type: e.isDirectory() ? ('directory' as const) : ('file' as const),
          path: workspaceRelative(root, join(/*turbopackIgnore: true*/ resolvedRes.path, e.name)),
          size: e.isFile() ? statSyncSafe(join(/*turbopackIgnore: true*/ resolvedRes.path, e.name))?.size || 0 : 0,
        }))
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });

      return NextResponse.json({
        type: 'directory',
        path: filePath,
        items,
        sessionId,
      });
    }

    return NextResponse.json({ error: 'Not a file or directory' }, { status: 400 });
  } catch (error) {
    console.error('[GET /api/workspace]', error);
    return NextResponse.json({ error: 'Failed to read workspace' }, { status: 500 });
  }
}

// POST /api/workspace — Upload a file, save content, or create a directory
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const action = formData.get('action') as string | null;
    const sessionId = ((formData.get('sessionId') as string) || null) as string | null;

    const rootRes = await resolveRoot(sessionId);
    if (!rootRes.ok) {
      return NextResponse.json({ error: rootRes.error }, { status: rootRes.status });
    }
    const root = rootRes.root;

    if (action === 'mkdir') {
      const dirPath = formData.get('path') as string;
      if (!dirPath || dirPath.length > 500) {
        return NextResponse.json({ error: 'path is required' }, { status: 400 });
      }
      const resolvedRes = resolveWorkspacePath(root, dirPath);
      if (!resolvedRes.ok) {
        return NextResponse.json({ error: resolvedRes.reason }, { status: 403 });
      }
      await mkdir(resolvedRes.path, { recursive: true });
      return NextResponse.json({ success: true, path: dirPath, sessionId: rootRes.sessionId });
    }

    if (action === 'save') {
      const filePath = formData.get('path') as string;
      const content = formData.get('content') as string;
      if (!filePath || filePath.length > 500 || typeof content !== 'string') {
        return NextResponse.json(
          { error: 'path and content are required' },
          { status: 400 },
        );
      }
      if (content.length > 10 * 1024 * 1024) {
        return NextResponse.json(
          { error: 'File too large. Maximum size is 10MB.' },
          { status: 413 },
        );
      }
      const resolvedRes = resolveWorkspacePath(root, filePath);
      if (!resolvedRes.ok) {
        return NextResponse.json({ error: resolvedRes.reason }, { status: 403 });
      }
      await mkdir(join(resolvedRes.path, '..'), { recursive: true });
      await writeFile(resolvedRes.path, content, 'utf-8');
      return NextResponse.json({ success: true, path: filePath, sessionId: rootRes.sessionId });
    }

    // Default: file upload
    const file = formData.get('file') as File | null;
    const subPath = (formData.get('path') as string) || '';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Use FormData with a "file" field.' },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB.' },
        { status: 413 },
      );
    }

    const directoryRes = resolveWorkspacePath(root, subPath);
    if (!directoryRes.ok) {
      return NextResponse.json({ error: directoryRes.reason }, { status: 403 });
    }

    await mkdir(directoryRes.path, { recursive: true });

    // Sanitize the filename: no path separators, no dotfiles
    const basename = file.name.split(/[\\/]/).pop() ?? 'file';
    const safeName = basename.startsWith('.') ? `_${basename}` : basename;

    const target = await resolveWorkspacePath(root, join(workspaceRelative(root, directoryRes.path), safeName));
    if (!target.ok) {
      return NextResponse.json({ error: target.reason }, { status: 403 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(target.path, buffer);

    return NextResponse.json(
      {
        success: true,
        path: workspaceRelative(root, target.path),
        size: file.size,
        name: safeName,
        sessionId: rootRes.sessionId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('[POST /api/workspace]', error);
    return NextResponse.json({ error: 'Failed to process workspace action' }, { status: 500 });
  }
}

// DELETE /api/workspace — Delete a file or directory inside a (session) workspace
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filePath = searchParams.get('path') || '';
    const sessionId = searchParams.get('sessionId');

    if (!filePath) {
      return NextResponse.json({ error: 'path is required' }, { status: 400 });
    }

    const rootRes = await resolveRoot(sessionId);
    if (!rootRes.ok) {
      return NextResponse.json({ error: rootRes.error }, { status: rootRes.status });
    }
    const root = rootRes.root;

    const resolvedRes = resolveWorkspacePath(root, filePath);
    if (!resolvedRes.ok) {
      return NextResponse.json({ error: resolvedRes.reason }, { status: 403 });
    }

    if (resolvedRes.path === root) {
      return NextResponse.json(
        { error: sessionId ? 'Cannot delete the session workspace root' : 'Cannot delete the workspace root' },
        { status: 403 },
      );
    }

    await access(resolvedRes.path);
    await rm(resolvedRes.path, { recursive: true, force: true });
    return NextResponse.json({ success: true, sessionId: rootRes.sessionId });
  } catch (error) {
    console.error('[DELETE /api/workspace]', error);
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}