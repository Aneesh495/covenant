import fs from "fs";
import path from "path";
import { getPgPool } from "./connection";

export async function runMigrations(): Promise<void> {
  const pool = getPgPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    // Create migrations tracker table
    await client.query(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version VARCHAR(64) PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const currentDir = path.dirname(new URL(import.meta.url).pathname);
    const migrationsDir = path.resolve(currentDir, "migrations");
    if (!fs.existsSync(migrationsDir)) {
      await client.query("COMMIT");
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const { rows } = await client.query("SELECT version FROM _schema_migrations WHERE version = $1", [version]);

      if (rows.length === 0) {
        const sqlPath = path.join(migrationsDir, file);
        const sqlContent = fs.readFileSync(sqlPath, "utf-8");
        await client.query(sqlContent);
        await client.query("INSERT INTO _schema_migrations (version) VALUES ($1)", [version]);
      }
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations()
    .then(() => {
      console.log("Migrations applied successfully.");
      process.exit(0);
    })
    .catch((err) => {
      console.error("Migration failed:", err);
      process.exit(1);
    });
}
