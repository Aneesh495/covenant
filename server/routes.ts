import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { analyzeContract } from "./services/openai";
import { extractTextFromFile } from "./services/fileParser";
import multer from "multer";
import path from "path";
import fs from "fs";

// Configure multer for file uploads
const upload = multer({
  dest: "uploads/",
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("Invalid file type. Only PDF and DOCX files are allowed."));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Contract upload and analysis
  app.post("/api/contracts/upload", isAuthenticated, upload.single("contract"), async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Create contract record
      const contract = await storage.createContract({
        userId,
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        analysisStatus: "processing",
      });

      // Start background processing
      processContractAnalysis(contract.id, file.path, file.mimetype);

      res.json({ 
        message: "Contract uploaded successfully", 
        contractId: contract.id 
      });
    } catch (error) {
      console.error("Error uploading contract:", error);
      res.status(500).json({ message: "Failed to upload contract" });
    }
  });

  // Get user's contracts
  app.get("/api/contracts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contracts = await storage.getContractsByUser(userId);
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  // Get specific contract with analysis
  app.get("/api/contracts/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const contractId = parseInt(req.params.id);
      
      const contract = await storage.getContract(contractId);
      if (!contract || contract.userId !== userId) {
        return res.status(404).json({ message: "Contract not found" });
      }

      const clauses = await storage.getClausesByContract(contractId);
      const summary = await storage.getAnalysisSummary(contractId);

      res.json({
        contract,
        clauses,
        summary,
      });
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  // Background contract analysis processing
  async function processContractAnalysis(contractId: number, filePath: string, fileType: string) {
    try {
      // Extract text from file
      const extractedText = await extractTextFromFile(filePath, fileType);
      
      // Analyze with OpenAI
      const analysis = await analyzeContract(extractedText);
      
      // Save clauses
      const clauseData = analysis.clauses.map(clause => ({
        contractId,
        clauseText: clause.clauseText,
        category: clause.category,
        riskLevel: clause.riskLevel,
        summary: clause.summary,
        suggestion: clause.suggestion || null,
        startPosition: clause.startPosition,
        endPosition: clause.endPosition,
      }));
      
      await storage.createClauses(clauseData);
      
      // Save analysis summary
      await storage.createAnalysisSummary({
        contractId,
        criticalIssues: analysis.criticalIssues,
        recommendations: analysis.recommendations,
        missingClauses: analysis.missingClauses,
        highRiskCount: analysis.highRiskCount,
        mediumRiskCount: analysis.mediumRiskCount,
        lowRiskCount: analysis.lowRiskCount,
      });
      
      // Update contract status
      await storage.updateContractStatus(contractId, "completed", analysis.overallRiskLevel);
      
      // Clean up uploaded file
      fs.unlinkSync(filePath);
      
    } catch (error) {
      console.error("Error processing contract:", error);
      await storage.updateContractStatus(contractId, "failed");
      
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}
