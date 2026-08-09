import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSessionSchema } from '@/lib/validation';

// GET /api/chat/sessions — Return all sessions with message count
export async function GET() {
  try {
    const sessions = await db.chatSession.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { messages: true },
        },
      },
    });

    const result = sessions.map((s) => ({
      id: s.id,
      title: s.title,
      mode: s.mode,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      messageCount: s._count.messages,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[GET /api/chat/sessions]', error);
    return NextResponse.json(
      { error: 'Failed to fetch sessions' },
      { status: 500 },
    );
  }
}

// POST /api/chat/sessions — Create a new session
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: `Invalid request: ${first ? `${first.path.join('.')} ${first.message}` : 'malformed payload'}`,
        },
        { status: 400 },
      );
    }

    const { title, mode } = parsed.data;

    const session = await db.chatSession.create({
      data: {
        id: crypto.randomUUID(),
        title: title ?? 'New Session',
        mode: mode ?? 'council',
      },
    });

    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error('[POST /api/chat/sessions]', error);
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 },
    );
  }
}