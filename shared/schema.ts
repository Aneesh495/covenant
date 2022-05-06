import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Contract analysis storage
export const contracts = pgTable("contracts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: varchar("filename").notNull(),
  originalName: varchar("original_name").notNull(),
  fileSize: integer("file_size").notNull(),
  fileType: varchar("file_type").notNull(),
  extractedText: text("extracted_text"),
  analysisStatus: varchar("analysis_status").notNull().default("pending"), // pending, processing, completed, failed
  overallRiskLevel: varchar("overall_risk_level"), // low, medium, high
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Clause analysis results
export const clauses = pgTable("clauses", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  clauseText: text("clause_text").notNull(),
  category: varchar("category").notNull(), // liability, termination, confidentiality, etc.
  riskLevel: varchar("risk_level").notNull(), // low, medium, high
  summary: text("summary"),
  suggestion: text("suggestion"),
  startPosition: integer("start_position"),
  endPosition: integer("end_position"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Analysis summary
export const analysisSummaries = pgTable("analysis_summaries", {
  id: serial("id").primaryKey(),
  contractId: integer("contract_id").notNull().references(() => contracts.id),
  criticalIssues: text("critical_issues"),
  recommendations: text("recommendations"),
  missingClauses: text("missing_clauses"),
  highRiskCount: integer("high_risk_count").default(0),
  mediumRiskCount: integer("medium_risk_count").default(0),
  lowRiskCount: integer("low_risk_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

export type InsertContract = typeof contracts.$inferInsert;
export type Contract = typeof contracts.$inferSelect;

export type InsertClause = typeof clauses.$inferInsert;
export type Clause = typeof clauses.$inferSelect;

export type InsertAnalysisSummary = typeof analysisSummaries.$inferInsert;
export type AnalysisSummary = typeof analysisSummaries.$inferSelect;

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertClauseSchema = createInsertSchema(clauses).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisSummarySchema = createInsertSchema(analysisSummaries).omit({
  id: true,
  createdAt: true,
});
