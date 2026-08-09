import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// PATCH /api/mcp-servers/[id] — Update MCP server
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, description, transport, command, args, url, envVars, isActive, tools } = body;

    const existing = await db.mcpServer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      );
    }

    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (description !== undefined) data.description = description;
    if (transport !== undefined) data.transport = transport;
    if (command !== undefined) data.command = command;
    if (args !== undefined) data.args = JSON.stringify(args);
    if (url !== undefined) data.url = url;
    if (envVars !== undefined) data.envVars = JSON.stringify(envVars);
    if (isActive !== undefined) data.isActive = isActive;
    if (tools !== undefined) data.tools = JSON.stringify(tools);

    const updated = await db.mcpServer.update({
      where: { id },
      data,
    });

    return NextResponse.json({
      ...updated,
      args: JSON.parse(updated.args || '[]'),
      envVars: JSON.parse(updated.envVars || '{}'),
      tools: JSON.parse(updated.tools || '[]'),
    });
  } catch (error) {
    console.error('[PATCH /api/mcp-servers/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to update MCP server' },
      { status: 500 }
    );
  }
}

// DELETE /api/mcp-servers/[id] — Delete MCP server
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const existing = await db.mcpServer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: 'MCP server not found' },
        { status: 404 }
      );
    }

    await db.mcpServer.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[DELETE /api/mcp-servers/[id]]', error);
    return NextResponse.json(
      { error: 'Failed to delete MCP server' },
      { status: 500 }
    );
  }
}
