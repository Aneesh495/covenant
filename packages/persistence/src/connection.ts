import { Pool } from "pg";
import { drizzle, NodePgDatabase } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

let globalPool: Pool | null = null;
let globalDb: NodePgDatabase<typeof schema> | null = null;

export function getDatabaseUrl(): string {
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }
  const isTest = process.env.NODE_ENV === "test";
  const dbName = isTest ? "covenant_test" : "covenant";
  return `postgres://localhost:5432/${dbName}`;
}

export function getPgPool(): Pool {
  if (!globalPool) {
    globalPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return globalPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!globalDb) {
    const pool = getPgPool();
    globalDb = drizzle(pool, { schema });
  }
  return globalDb;
}

export async function closeDatabase(): Promise<void> {
  if (globalPool) {
    await globalPool.end();
    globalPool = null;
    globalDb = null;
  }
}
