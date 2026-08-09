import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { isValidSessionId, deleteSessionWorkspace } from '@/lib/workspace';

// GET /api/chat/sessions/[id] — Return session with all messages
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const session = await db.chatSession.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error('[GET /api/chat/sessions/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to fetch session' },
      { status: 500 }
    );
  }
}

// DELETE /api/chat/sessions/[id] — Delete session and all messages
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check session exists
    const session = await db.chatSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Cascade delete handles messages automatically via schema
    await db.chatSession.delete({
      where: { id },
    });

    // Clean up the session's workspace and snapshots from disk
    if (isValidSessionId(id)) {
      await deleteSessionWorkspace(id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/chat/sessions/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to delete session' },
      { status: 500 }
    );
  }
}
