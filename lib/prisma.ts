// ─── Prisma Client Singleton ──────────────────────────────────────────────────
// Works with both MySQL (local dev) and MS SQL Server (production).
// The correct DB is determined by DB_PROVIDER + DATABASE_URL in your .env file.
//
// In development (DB_PROVIDER=mysql):
//   Re-uses a single client across HMR reloads. Query logging is off by default
//   to keep the terminal readable; set PRISMA_QUERY_LOG=true to re-enable.
// In production (DB_PROVIDER=sqlserver):
//   Creates a single instance without logging.

import { PrismaClient } from "@prisma/client";

const isDev = process.env.NODE_ENV !== "production";

const enableQueryLog = process.env.PRISMA_QUERY_LOG === "true";

function createPrismaClient() {
  return new PrismaClient({
    log:
      isDev && enableQueryLog ? ["query", "warn", "error"] : ["warn", "error"],
  });
}

// Prevent multiple instances during Next.js Hot Module Replacement in dev
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (isDev) globalForPrisma.prisma = prisma;
