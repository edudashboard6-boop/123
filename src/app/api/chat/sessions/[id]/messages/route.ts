import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

/**
 * GET /api/chat/sessions/[id]/messages
 * Return all messages for a session, ordered by createdAt ASC.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const messages = await db.chatMessage.findMany({
      where: { sessionId: id },
      orderBy: { createdAt: 'asc' },
    });

    const parsed = messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      agentName: m.agentName,
      modelUsed: m.modelUsed,
      tokens: m.tokens,
      cost: Number(m.cost),
      toolCalls: safeParse(m.toolCalls, []),
      debateData: m.debateData ? safeParse(m.debateData, undefined) : undefined,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[GET /api/chat/sessions/[id]/messages]', error);
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 });
  }
}

/** Parse stored JSON safely — never crash on corrupt legacy rows. */
function safeParse(raw: string, fallback: unknown): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}