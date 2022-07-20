import type { Express } from "express";
import type { Server } from "http";
import { pool } from "./db";
import { registerApiRoutes } from "../apps/api/src/routes";

export async function registerRoutes(app: Express): Promise<Server> {
  return registerApiRoutes(app, { pool });
}