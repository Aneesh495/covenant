import pg from "pg";
import { DurableTaskWorker } from "./worker";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/covenant";
const pool = new pg.Pool({ connectionString });

const worker = new DurableTaskWorker(pool, {
  workerId: process.env.WORKER_ID || `worker-${process.pid}`,
  pollIntervalMs: 1000,
});

async function main() {
  console.log(`[Worker Entrypoint] Initializing durable task worker...`);

  // Handle graceful termination
  const shutdown = async () => {
    console.log("[Worker Entrypoint] Received termination signal, shutting down...");
    await worker.stop();
    await pool.end();
    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);

  await worker.start();
}

main().catch((err) => {
  console.error("[Worker Entrypoint] Fatal error:", err);
  process.exit(1);
});
