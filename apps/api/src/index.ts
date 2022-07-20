import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import dotenv from "dotenv";
import pg from "pg";
import { registerApiRoutes } from "./routes";

dotenv.config();

const app = express();
app.use(express.json({ limit: "30mb" }));
app.use(express.urlencoded({ extended: false, limit: "30mb" }));

const connectionString = process.env.DATABASE_URL || "postgres://localhost:5432/covenant";
const pool = new pg.Pool({ connectionString });
const PgSession = connectPgSimple(session);

app.use(
  session({
    store: new PgSession({
      pool,
      tableName: "session",
      createTableIfMissing: true,
    }),
    secret: process.env.SESSION_SECRET || "dev-only-session-secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

const server = registerApiRoutes(app, { pool });

const PORT = parseInt(process.env.PORT || "5000", 10);
if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[API Server] Running on http://0.0.0.0:${PORT}`);
  });
}

export { app, server };
