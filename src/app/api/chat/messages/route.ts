import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orchestrateSession } from '@/lib/orchestrator';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { chatMessageSchema } from '@/lib/validation';
import { snapshotSessionWorkspace, writeExtractedFiles } from '@/lib/workspace';
import { extractCodeFiles } from '@/lib/code-files';
import type { DebateMode } from '@/lib/types';

const CHAT_RATE_LIMIT = 30;

/**
 * Persist a snapshot of the session workspace keyed to the last message of
 * the turn. Never throws — chat must not fail because of storage.
 */
async function captureWorkspaceSnapshot(
  sessionId: string,
  saved: Array<{ id: unknown }>,
): Promise<void> {
  const last = saved.at(-1);
  if (!last || typeof last.id !== 'string') return;
  try {
    const snapshotFile = await snapshotSessionWorkspace(sessionId, last.id);
    if (snapshotFile) {
      await db.chatMessage.update({
        where: { id: last.id },
        data: { workspaceSnapshotId: last.id },
      });
    }
  } catch (error) {
    console.error('[snapshot] failed to capture workspace state:', error);
  }
}

/**
 * POST /api/chat/messages — Send a message and get the multi-agent response.
 * This is what the chat store calls.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = chatMessageSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        { error: `Invalid request: ${first ? `${first.path.join('.')} ${first.message}` : 'malformed payload'}` },
        { status: 400 },
      );
    }

    const { sessionId, content } = parsed.data;

    // Rate limit per client IP to protect the provider APIs.
    const limit = rateLimit(`chat:${clientIp(request.headers)}`, CHAT_RATE_LIMIT);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${limit.retryAfterSeconds}s.` },
        {
          status: 429,
          headers: {
            'Retry-After': String(limit.retryAfterSeconds),
            'X-RateLimit-Remaining': String(limit.remaining),
          },
        },
      );
    }

    // Get session to determine mode
    const session = await db.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found. Create a session first.' },
        { status: 404 },
      );
    }

    const mode = (session.mode ?? 'council') as DebateMode;

    // Monotonic timestamps so rollback ordering is precise even when rows
    // are persisted within the same millisecond.
    const turnStartMs = Date.now();
    let turnTick = 0;

    // Create user message
    const userMsg = await db.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content,
        agentName: '',
        modelUsed: '',
        tokens: Math.ceil(content.split(/\s+/).length * 1.3),
        cost: 0,
        toolCalls: '[]',
        debateData: '',
        createdAt: new Date(turnStartMs + turnTick++),
      },
    });

    // Update session timestamp
    await db.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    // Run the multi-agent debate pipeline (real providers with simulation fallback)
    const orchestrated = await orchestrateSession(sessionId, content, mode);

    // Persist file artifacts the agents produced into the session workspace
    // (fenced blocks labelled with a file path). Written BEFORE the snapshot
    // below so rollback restores them like any other file.
    let filesWritten: string[] = [];
    try {
      const extracted = orchestrated.messages.flatMap((m) => extractCodeFiles(m.content));
      filesWritten = await writeExtractedFiles(sessionId, extracted);
    } catch (error) {
      console.error('[chat/messages] failed to write agent files:', error);
    }

    // Persist agent messages + optional system notices in one transaction
    const saved = await db.$transaction(async (tx) => {
      const msgs: Array<{ id: string; [k: string]: unknown }> = [];

      if (orchestrated.usedFallback && orchestrated.fallbackReasons.length > 0) {
        const notice = await tx.chatMessage.create({
          data: {
            sessionId,
            role: 'system',
            content: orchestrated.fallbackReasons.join(' '),
            agentName: '',
            modelUsed: '',
            tokens: 0,
            cost: 0,
            toolCalls: '[]',
            debateData: '',
            createdAt: new Date(turnStartMs + turnTick++),
          },
        });
        msgs.push({
          id: notice.id,
          sessionId: notice.sessionId,
          role: notice.role,
          content: notice.content,
          agentName: notice.agentName,
          modelUsed: notice.modelUsed,
          tokens: notice.tokens,
          cost: Number(notice.cost),
          toolCalls: [],
          createdAt: notice.createdAt.toISOString(),
        });
      }

      for (const m of orchestrated.messages) {
        const created = await tx.chatMessage.create({
          data: {
            sessionId,
            role: m.role,
            content: m.content,
            agentName: m.agentName,
            modelUsed: m.modelUsed,
            tokens: m.tokens,
            cost: m.cost,
            toolCalls: JSON.stringify(m.toolCalls || []),
            debateData: JSON.stringify(m.debateData || {}),
            createdAt: new Date(turnStartMs + turnTick++),
          },
        });
        msgs.push({
          id: created.id,
          sessionId: created.sessionId,
          role: created.role,
          content: created.content,
          agentName: created.agentName,
          modelUsed: created.modelUsed,
          tokens: created.tokens,
          cost: Number(created.cost),
          toolCalls: m.toolCalls || [],
          debateData: m.debateData || undefined,
          createdAt: created.createdAt.toISOString(),
        });
      }

      return msgs;
    });

    // Capture the session's workspace state (files written/read this turn)
    // keyed to the final message of this turn. Serves as the rollback point.
    captureWorkspaceSnapshot(sessionId, saved).catch(() => {});

    // Return user message + agent messages
    return NextResponse.json([
      {
        id: userMsg.id,
        sessionId: userMsg.sessionId,
        role: userMsg.role,
        content: userMsg.content,
        agentName: userMsg.agentName || 'You',
        modelUsed: '',
        tokens: userMsg.tokens,
        cost: 0,
        toolCalls: [],
        createdAt: userMsg.createdAt.toISOString(),
      },
      ...saved,
    ]);
  } catch (error) {
    console.error('[POST /api/chat/messages]', error);
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 },
    );
  }
}