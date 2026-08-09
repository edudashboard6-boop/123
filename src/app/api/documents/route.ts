import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// GET /api/documents — Return all documents (metadata only; embeddings are
// heavy and only needed for server-side retrieval)
export async function GET() {
  try {
    const documents = await db.document.findMany({
      orderBy: { createdAt: 'desc' },
    });

    const parsed = documents.map((doc) => {
      const { embedding: _embedding, ...rest } = doc;
      return rest;
    });

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[GET /api/documents]', error);
    return NextResponse.json(
      { error: 'Failed to fetch documents' },
      { status: 500 }
    );
  }
}

// POST /api/documents — Upload a document
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    let workspaceId = ((formData.get('workspaceId') as string) || 'default').trim();
    if (workspaceId.length > 128) workspaceId = 'default';

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Use FormData with a "file" field.' },
        { status: 400 }
      );
    }

    // Validate file size (10MB limit)
    const MAX_FILE_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is 10MB.` },
        { status: 413 },
      );
    }

    // Reject binary file types that can't be read as UTF-8
    const BINARY_EXTENSIONS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.zip', '.gz', '.tar', '.png', '.jpg', '.jpeg', '.gif', '.mp3', '.mp4', '.exe', '.dll', '.so', '.dylib'];
    const ext = '.' + (file.name.split('.').pop() || '').toLowerCase();
    if (BINARY_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Binary file type (${ext}) is not supported. Please upload text-based files (.txt, .md, .json, .csv, .py, .js, .ts, etc.)` },
        { status: 400 },
      );
    }

    // Read file content as text
    const buffer = Buffer.from(await file.arrayBuffer());
    const content = buffer.toString('utf-8');

    // Generate fake embeddings (1536-dimensional normalized vector)
    const embedding = generateFakeEmbedding(1536);
    const chunkCount = Math.ceil(content.length / 1000);

    // Derive a title from the filename (remove extension)
    const title = file.name.replace(/\.[^/.]+$/, '');
    const fileType = file.name.split('.').pop() || '';

    const document = await db.document.create({
      data: {
        id: crypto.randomUUID(),
        filename: file.name,
        title,
        content,
        fileType,
        fileSize: file.size,
        embedding: JSON.stringify(embedding),
        chunkCount,
        workspaceId,
      },
    });

    return NextResponse.json(document, { status: 201 });
  } catch (error) {
    console.error('[POST /api/documents]', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
}

/**
 * Generate a normalized fake embedding vector.
 * Creates random values, then normalizes so the vector has unit length.
 */
function generateFakeEmbedding(dimensions: number): number[] {
  const vec = Array.from({ length: dimensions }, () => Math.random() - 0.5);
  const norm = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
  return norm > 0 ? vec.map((v) => v / norm) : vec;
}
