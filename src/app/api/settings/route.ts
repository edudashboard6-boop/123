import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { settingsPatchSchema } from '@/lib/validation';

// GET /api/settings — Return all settings as key-value pairs
export async function GET() {
  try {
    const settings = await db.appSettings.findMany({
      orderBy: { key: 'asc' },
    });

    // Convert array to simple key-value object
    const kv: Record<string, string> = {};
    for (const s of settings) {
      kv[s.key] = s.value;
    }

    return NextResponse.json(kv);
  } catch (error) {
    console.error('[GET /api/settings]', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

// PATCH /api/settings — Upsert a single setting
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = settingsPatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'key (string) and value (string) are required' },
        { status: 400 }
      );
    }

    const { key, value } = parsed.data;

    // Validate key against allowed settings
    const ALLOWED_KEYS = [
      'theme',
      'language',
      'defaultDebateMode',
      'autoSave',
      'sessionBudgetLimit',
      'agentBudgetLimits',
      'budgetAlertThreshold',
      'sandboxMode',
      'autoApproveTools',
      'auditLogging',
      'secretStorage',
      'contextWindowBudget',
      'maxDebateRounds',
      'fallbackOnError',
      'telemetry',
    ];
    if (!ALLOWED_KEYS.includes(key)) {
      return NextResponse.json(
        { error: `Unknown setting key: ${key}` },
        { status: 400 }
      );
    }

    const setting = await db.appSettings.upsert({
      where: { key },
      update: { value: String(value) },
      create: {
        key,
        value: String(value),
      },
    });

    return NextResponse.json(setting);
  } catch (error) {
    console.error('[PATCH /api/settings]', error);
    return NextResponse.json(
      { error: 'Failed to update setting' },
      { status: 500 }
    );
  }
}