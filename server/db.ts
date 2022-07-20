import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import dotenv from "dotenv";

dotenv.config();

const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/covenant";

export const pool = new pg.Pool({ connectionString });
export const db = drizzle(pool, { schema });