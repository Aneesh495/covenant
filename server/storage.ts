import {
  users,
  contracts,
  clauses,
  analysisSummaries,
  type User,
  type UpsertUser,
  type Contract,
  type InsertContract,
  type Clause,
  type InsertClause,
  type AnalysisSummary,
  type InsertAnalysisSummary,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  // User operations (IMPORTANT) these user operations are mandatory for Replit Auth.
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  
  // Contract operations
  createContract(contract: InsertContract): Promise<Contract>;
  getContract(id: number): Promise<Contract | undefined>;
  getContractsByUser(userId: string): Promise<Contract[]>;
  updateContractStatus(id: number, status: string, riskLevel?: string): Promise<void>;
  
  // Clause operations
  createClauses(clauses: InsertClause[]): Promise<Clause[]>;
  getClausesByContract(contractId: number): Promise<Clause[]>;
  
  // Analysis summary operations
  createAnalysisSummary(summary: InsertAnalysisSummary): Promise<AnalysisSummary>;
  getAnalysisSummary(contractId: number): Promise<AnalysisSummary | undefined>;
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

  // Contract operations
  async createContract(contract: InsertContract): Promise<Contract> {
    const [newContract] = await db
      .insert(contracts)
      .values(contract)
      .returning();
    return newContract;
  }

  async getContract(id: number): Promise<Contract | undefined> {
    const [contract] = await db
      .select()
      .from(contracts)
      .where(eq(contracts.id, id));
    return contract;
  }

  async getContractsByUser(userId: string): Promise<Contract[]> {
    return await db
      .select()
      .from(contracts)
      .where(eq(contracts.userId, userId))
      .orderBy(desc(contracts.createdAt));
  }

  async updateContractStatus(id: number, status: string, riskLevel?: string): Promise<void> {
    const updateData: any = { 
      analysisStatus: status,
      updatedAt: new Date()
    };
    if (riskLevel) {
      updateData.overallRiskLevel = riskLevel;
    }
    
    await db
      .update(contracts)
      .set(updateData)
      .where(eq(contracts.id, id));
  }

  // Clause operations
  async createClauses(clauseData: InsertClause[]): Promise<Clause[]> {
    return await db
      .insert(clauses)
      .values(clauseData)
      .returning();
  }

  async getClausesByContract(contractId: number): Promise<Clause[]> {
    return await db
      .select()
      .from(clauses)
      .where(eq(clauses.contractId, contractId));
  }

  // Analysis summary operations
  async createAnalysisSummary(summary: InsertAnalysisSummary): Promise<AnalysisSummary> {
    const [newSummary] = await db
      .insert(analysisSummaries)
      .values(summary)
      .returning();
    return newSummary;
  }

  async getAnalysisSummary(contractId: number): Promise<AnalysisSummary | undefined> {
    const [summary] = await db
      .select()
      .from(analysisSummaries)
      .where(eq(analysisSummaries.contractId, contractId));
    return summary;
  }
}

export const storage = new DatabaseStorage();
