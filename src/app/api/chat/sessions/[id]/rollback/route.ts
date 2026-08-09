import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  isValidSessionId,
  restoreSessionWorkspace,
  deleteMessageSnapshots,
} from '@/lib/workspace';

/**
 * POST /api/chat/sessions/[id]/rollback
 * Body: { "messageId": "..." }
 *
 * Rolls the session back to a given message: every message persisted AFTER
 * it is deleted and, if a workspace snapshot exists for that point, the
 * session's workspace is restored to the state it had then.
 */
export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;

    if (!isValidSessionId(id)) {
      return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
    }

    const session = await db.chatSession.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const body = await request.json();
    const messageId = body?.messageId;

    if (typeof messageId !== 'string' || messageId.length === 0 || messageId.length > 128) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }

    const target = await db.chatMessage.findFirst({
      where: { id: messageId, sessionId: id },
    });
    if (!target) {
      return NextResponse.json({ error: 'Message not found in session' }, { status: 404 });
    }

    // Messages strictly after the rollback point are removed.
    const newer = await db.chatMessage.findMany({
      where: { sessionId: id, createdAt: { gt: target.createdAt } },
      select: { id: true },
    });

    // Restore the workspace to the snapshot of the target message, or of the
    // most recent message up to it that has one (resolved BEFORE deletion so
    // the candidate is still present in the database).
    let snapshotId = target.workspaceSnapshotId ?? null;
    if (!snapshotId) {
      const previous = await db.chatMessage.findFirst({
        where: {
          sessionId: id,
          id: { not: target.id },
          workspaceSnapshotId: { not: null },
          createdAt: { lte: target.createdAt },
        },
        orderBy: { createdAt: 'desc' },
      });
      snapshotId = previous?.workspaceSnapshotId ?? null;
    }

    const workspaceRestored = snapshotId
      ? await restoreSessionWorkspace(id, snapshotId)
      : false;

    await deleteMessageSnapshots(id, newer.map((m) => m.id));

    await db.chatMessage.deleteMany({
      where: { sessionId: id, createdAt: { gt: target.createdAt } },
    });

    await db.chatSession.update({
      where: { id },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({
      success: true,
      removed: newer.length,
      workspaceRestored,
      snapshotId,
    });
  } catch (error) {
    console.error('[POST /api/chat/sessions/[id]/rollback]', error);
    return NextResponse.json({ error: 'Failed to rollback' }, { status: 500 });
  }
}