import { PrismaClient } from '@prisma/client'
import { mkdirSync } from 'fs'
import { join } from 'path'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * Ensure the db directory exists (needed for SQLite with relative path).
 * Called once at module load time.
 */
function ensureDbDir() {
  try {
    const dbDir = join(process.cwd(), 'db')
    mkdirSync(dbDir, { recursive: true })
  } catch {
    // Directory already exists or cannot create — Prisma will handle the error
  }
}

ensureDbDir()

/**
 * Prisma CLI resolves relative SQLite paths against the schema directory
 * (prisma/), while the runtime resolves them against process.cwd(). Resolve
 * the URL to an absolute path here so both always target the same file.
 */
function resolveDatabaseUrl(raw: string): string {
  if (!raw.startsWith('file:./') && !raw.startsWith('file:../')) return raw
  const relative = raw.replace(/^file:/, '')
  return `file:${join(process.cwd(), relative)}`
}

const configuredUrl =
  process.env.DATABASE_URL ??
  /* Default mirrors .env.example */ 'file:./db/dev.db'

process.env.DATABASE_URL = resolveDatabaseUrl(configuredUrl)

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
