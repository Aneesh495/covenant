import {
  users,
  documents,
  analysisItems,
  analysisSummaries,
  profiles,
  type User,
  type UpsertUser,
  type Document,
  type InsertDocument,
  type AnalysisItem,
  type InsertAnalysisItem,
  type AnalysisSummary,
  type InsertAnalysisSummary,
  type Profile,
  type InsertProfile,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Document operations (contracts and resumes)
  createDocument(document: InsertDocument): Promise<Document>;
  getDocument(id: number): Promise<Document | undefined>;
  getDocumentsBySession(sessionId: string): Promise<Document[]>;
  updateDocumentStatus(id: number, status: string, riskLevel?: string): Promise<void>;
  
  // Analysis items operations (clauses for contracts, sections for resumes)
  createAnalysisItems(items: InsertAnalysisItem[]): Promise<AnalysisItem[]>;
  getAnalysisItemsByDocument(documentId: number): Promise<AnalysisItem[]>;
  
  // Analysis summary operations
  createAnalysisSummary(summary: InsertAnalysisSummary): Promise<AnalysisSummary>;
  getAnalysisSummary(documentId: number): Promise<AnalysisSummary | undefined>;
  
  // Profile operations (for anonymous users)
  getProfile(sessionId: string): Promise<Profile | undefined>;
  upsertProfile(profile: InsertProfile): Promise<Profile>;
}

export class DatabaseStorage implements IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Document operations (contracts and resumes)
  async createDocument(documentData: InsertDocument): Promise<Document> {
    const [document] = await db
      .insert(documents)
      .values(documentData)
      .returning();
    return document;
  }

  async getDocument(id: number): Promise<Document | undefined> {
    const [document] = await db
      .select()
      .from(documents)
      .where(eq(documents.id, id));
    return document;
  }

  async getDocumentsBySession(sessionId: string): Promise<Document[]> {
    const documentsList = await db
      .select()
      .from(documents)
      .where(eq(documents.sessionId, sessionId))
      .orderBy(desc(documents.createdAt));
    return documentsList;
  }

  async updateDocumentStatus(id: number, status: string, riskLevel?: string): Promise<void> {
    const updateData: any = { 
      analysisStatus: status,
      updatedAt: new Date()
    };
    if (riskLevel) {
      updateData.overallRiskLevel = riskLevel;
    }
    
    await db
      .update(documents)
      .set(updateData)
      .where(eq(documents.id, id));
  }

  // Analysis items operations (clauses for contracts, sections for resumes)
  async createAnalysisItems(itemsData: InsertAnalysisItem[]): Promise<AnalysisItem[]> {
    const items = await db
      .insert(analysisItems)
      .values(itemsData)
      .returning();
    return items;
  }

  async getAnalysisItemsByDocument(documentId: number): Promise<AnalysisItem[]> {
    const items = await db
      .select()
      .from(analysisItems)
      .where(eq(analysisItems.documentId, documentId));
    return items;
  }

  // Analysis summary operations
  async createAnalysisSummary(summaryData: InsertAnalysisSummary): Promise<AnalysisSummary> {
    const [summary] = await db
      .insert(analysisSummaries)
      .values(summaryData)
      .returning();
    return summary;
  }

  async getAnalysisSummary(documentId: number): Promise<AnalysisSummary | undefined> {
    const [summary] = await db
      .select()
      .from(analysisSummaries)
      .where(eq(analysisSummaries.documentId, documentId));
    return summary;
  }

  // Profile operations (for anonymous users)
  async getProfile(sessionId: string): Promise<Profile | undefined> {
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.sessionId, sessionId));
    return profile;
  }

  async upsertProfile(profileData: InsertProfile): Promise<Profile> {
    const [profile] = await db
      .insert(profiles)
      .values(profileData)
      .onConflictDoUpdate({
        target: profiles.sessionId,
        set: {
          ...profileData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return profile;
  }
}

export const storage = new DatabaseStorage();