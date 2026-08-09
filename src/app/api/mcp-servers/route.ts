import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { mcpServerSchema } from '@/lib/validation';

// GET /api/mcp-servers — Return all MCP servers
export async function GET() {
  try {
    const servers = await db.mcpServer.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const parsed = servers.map((s) => ({
      ...s,
      args: JSON.parse(s.args || '[]'),
      envVars: JSON.parse(s.envVars || '{}'),
      tools: JSON.parse(s.tools || '[]'),
    }));

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[GET /api/mcp-servers]', error);
    return NextResponse.json(
      { error: 'Failed to fetch MCP servers' },
      { status: 500 }
    );
  }
}

// POST /api/mcp-servers — Create a new MCP server
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = mcpServerSchema.safeParse(body);

    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: `Invalid request: ${first ? `${first.path.join('.')} ${first.message}` : 'malformed payload'}`,
        },
        { status: 400 },
      );
    }

    const { name, description, transport, command, args, url, envVars, isActive } = parsed.data;

    const server = await db.mcpServer.create({
      data: {
        id: crypto.randomUUID(),
        name,
        description: description || '',
        transport: transport || 'stdio',
        command: command || '',
        args: JSON.stringify(args || []),
        url: url || '',
        envVars: JSON.stringify(envVars || {}),
        isActive: isActive ?? true,
        tools: '[]',
      },
    });

    return NextResponse.json(
      {
        ...server,
        args: JSON.parse(server.args || '[]'),
        envVars: JSON.parse(server.envVars || '{}'),
        tools: JSON.parse(server.tools || '[]'),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('[POST /api/mcp-servers]', error);
    return NextResponse.json(
      { error: 'Failed to create MCP server' },
      { status: 500 }
    );
  }
}
