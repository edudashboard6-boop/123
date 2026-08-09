import { NextRequest, NextResponse } from 'next/server';
import { readdir, readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { db } from '@/lib/db';
import {
  WORKSPACE_ROOT,
  isValidSessionId,
  sessionWorkspaceDir,
  resolveWorkspacePath,
} from '@/lib/workspace';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get('sessionId');

  let root = WORKSPACE_ROOT;

  if (sessionId) {
    if (!isValidSessionId(sessionId)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }
    const session = await db.chatSession.findUnique({ where: { id: sessionId } });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }
    root = sessionWorkspaceDir(sessionId);
  }

  if (!existsSync(root)) {
    return NextResponse.json({ error: 'Workspace is empty' }, { status: 404 });
  }

  try {
    const files: Array<{ path: string; content: Buffer }> = [];

    async function collectFiles(dir: string, base: string) {
      const entries = await readdir(/*turbopackIgnore: true*/ dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
        const fullPath = join(dir, entry.name);
        const relPath = join(base, entry.name);
        if (entry.isDirectory()) {
          await collectFiles(fullPath, relPath);
        } else {
          const content = await readFile(/*turbopackIgnore: true*/ fullPath);
          files.push({ path: relPath, content });
        }
      }
    }

    await collectFiles(root, '');

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files in workspace' }, { status: 404 });
    }

    return NextResponse.json({
      files: files.map((f) => ({ path: f.path, size: f.content.length })),
      totalSize: files.reduce((s, f) => s + f.content.length, 0),
      fileCount: files.length,
      sessionId,
    });
  } catch (error) {
    console.error('[GET /api/workspace/download]', error);
    return NextResponse.json({ error: 'Failed to prepare download' }, { status: 500 });
  }
}