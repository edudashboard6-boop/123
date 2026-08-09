import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orchestrateSession } from '@/lib/orchestrator';
import { rateLimit, clientIp } from '@/lib/rate-limit';
import { chatMessageSchema } from '@/lib/validation';
import { snapshotSessionWorkspace, writeExtractedFiles } from '@/lib/workspace';
import { extractCodeFiles } from '@/lib/code-files';
import type { DebateMode } from '@/lib/types';

/**
 * POST /api/chat — Main chat endpoint with multi-agent orchestration.
 *
 * Modes:
 *  - 'fast':    Only ARCHITECT responds with a plan
 *  - 'council': ARCHITECT → FORGE → SENTINEL → ARCHITECT arbitration
 *  - 'redteam': Same as council but SENTINEL is adversarial
 */
export async function POST(request: NextRequest) {
  try {
    const { message, sessionId, mode } = await request.json();

    if (!message || !sessionId) {
      return NextResponse.json(
        { error: 'message and sessionId are required' },
        { status: 400 },
      );
    }

    if (typeof message !== 'string' || typeof sessionId !== 'string') {
      return NextResponse.json(
        { error: 'message and sessionId must be strings' },
        { status: 400 },
      );
    }

    const trimmed = message.trim();
    if (trimmed.length === 0 || trimmed.length > 50_000 || sessionId.length > 128) {
      return NextResponse.json(
        { error: 'Invalid message or sessionId length' },
        { status: 400 },
      );
    }

    const limit = rateLimit(`chat:${clientIp(request.headers)}`, 30);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: `Too many requests. Try again in ${limit.retryAfterSeconds}s.` },
        {
          status: 429,
          headers: { 'Retry-After': String(limit.retryAfterSeconds) },
        },
      );
    }

    const chatMode = (mode as DebateMode) || 'council';
    if (!['fast', 'council', 'redteam'].includes(chatMode)) {
      return NextResponse.json(
        { error: `Unknown debate mode: ${chatMode}` },
        { status: 400 },
      );
    }

    // Find or create the session
    let session = await db.chatSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      session = await db.chatSession.create({
        data: {
          id: sessionId,
          title: trimmed.substring(0, 60) + (trimmed.length > 60 ? '...' : ''),
          mode: chatMode,
        },
      });
    } else {
      await db.chatSession.update({
        where: { id: sessionId },
        data: { updatedAt: new Date() },
      });
    }

    // Create user message record
    const userMessage = await db.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: trimmed,
        agentName: '',
        modelUsed: '',
        tokens: Math.ceil(trimmed.split(/\s+/).length * 1.3),
        cost: 0,
        toolCalls: '[]',
        debateData: '',
      },
    });

    // Run the real multi-agent pipeline (simulation fallback if no provider)
    const orchestrated = await orchestrateSession(sessionId, trimmed, chatMode);

    // Persist agent-produced file artifacts into the session workspace.
    try {
      const extracted = orchestrated.messages.flatMap((m) => extractCodeFiles(m.content));
      await writeExtractedFiles(sessionId, extracted);
    } catch (error) {
      console.error('[chat] failed to write agent files:', error);
    }

    // Save all agent messages
    const createdMessages = await db.$transaction(async (tx) => {
      const msgs = [];
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
          },
        });
        msgs.push(created);
      }
      return msgs;
    });

    // Capture the workspace state after this turn (rollback point).
    const lastSaved = createdMessages.at(-1);
    if (lastSaved) {
      snapshotSessionWorkspace(sessionId, lastSaved.id)
        .then((snapshotFile) => {
          if (!snapshotFile) return;
          return db.chatMessage.update({
            where: { id: lastSaved.id },
            data: { workspaceSnapshotId: lastSaved.id },
          });
        })
        .catch((error) => console.error('[snapshot] failed to capture workspace state:', error));
    }

    // Compute totals
    const totalTokens =
      createdMessages.reduce((sum, m) => sum + m.tokens, 0) + userMessage.tokens;
    const totalCost = createdMessages.reduce((sum, m) => sum + m.cost, 0);

    return NextResponse.json({
      messages: createdMessages,
      meta: {
        totalTokens,
        totalCost: parseFloat(totalCost.toFixed(6)),
        agentCount: createdMessages.length,
        mode: chatMode,
        usedFallback: orchestrated.usedFallback,
        fallbackReasons: orchestrated.fallbackReasons,
      },
    });
  } catch (error) {
    console.error('[POST /api/chat]', error);
    return NextResponse.json(
      { error: 'Failed to process chat message' },
      { status: 500 },
    );
  }
}