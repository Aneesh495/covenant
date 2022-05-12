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

// Document analysis storage (contracts and resumes)
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull(), // Use session instead of user for anonymous access
  documentType: varchar("document_type").notNull(), // contract, resume
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

// Analysis sections (clauses for contracts, sections for resumes)
export const analysisItems = pgTable("analysis_items", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  itemText: text("item_text").notNull(),
  category: varchar("category").notNull(), // For contracts: liability, termination, etc. For resumes: skills, experience, etc.
  riskLevel: varchar("risk_level"), // For contracts: low, medium, high. For resumes: could be strength level
  score: integer("score"), // For resumes: 1-10 rating
  summary: text("summary"),
  suggestion: text("suggestion"),
  startPosition: integer("start_position"),
  endPosition: integer("end_position"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Analysis summary
export const analysisSummaries = pgTable("analysis_summaries", {
  id: serial("id").primaryKey(),
  documentId: integer("document_id").notNull().references(() => documents.id),
  criticalIssues: text("critical_issues"),
  recommendations: text("recommendations"),
  missingItems: text("missing_items"), // missing clauses for contracts, missing skills for resumes
  overallScore: integer("overall_score"), // For resumes: overall rating 1-10
  highRiskCount: integer("high_risk_count").default(0),
  mediumRiskCount: integer("medium_risk_count").default(0),
  lowRiskCount: integer("low_risk_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Profile settings for anonymous users (stored in localStorage)
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  sessionId: varchar("session_id").notNull().unique(),
  name: varchar("name"),
  email: varchar("email"),
  bio: text("bio"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = typeof documents.$inferInsert;
export type AnalysisItem = typeof analysisItems.$inferSelect;
export type InsertAnalysisItem = typeof analysisItems.$inferInsert;
export type AnalysisSummary = typeof analysisSummaries.$inferSelect;
export type InsertAnalysisSummary = typeof analysisSummaries.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
export type InsertProfile = typeof profiles.$inferInsert;

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAnalysisItemSchema = createInsertSchema(analysisItems).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisSummarySchema = createInsertSchema(analysisSummaries).omit({
  id: true,
  createdAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
