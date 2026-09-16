import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { analyzeContract, analyzeResume } from "./services/openai";
import { extractTextFromFile } from "./services/fileParser";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";

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

// Generate session ID for anonymous users
function getSessionId(req: any): string {
  if (!req.session.sessionId) {
    req.session.sessionId = crypto.randomUUID();
  }
  return req.session.sessionId;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Document upload and analysis (works for both contracts and resumes)
  app.post("/api/documents/upload", upload.single("document"), async (req: any, res) => {
    try {
      const sessionId = getSessionId(req);
      const file = req.file;
      const documentType = req.body.documentType || "contract"; // default to contract

      if (!file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      if (!["contract", "resume"].includes(documentType)) {
        return res.status(400).json({ message: "Invalid document type. Must be 'contract' or 'resume'" });
      }

      // Create document record
      const document = await storage.createDocument({
        sessionId,
        documentType,
        filename: file.filename,
        originalName: file.originalname,
        fileSize: file.size,
        fileType: file.mimetype,
        analysisStatus: "processing",
      });

      // Start background processing
      processDocumentAnalysis(document.id, file.path, file.mimetype, documentType as "contract" | "resume");

      res.json({ 
        message: `${documentType === 'contract' ? 'Contract' : 'Resume'} uploaded successfully`, 
        documentId: document.id 
      });
    } catch (error) {
      console.error("Error uploading document:", error);
      res.status(500).json({ message: "Failed to upload document" });
    }
  });

  // Get user's documents by session
  app.get("/api/documents", async (req: any, res) => {
    try {
      const sessionId = getSessionId(req);
      const documents = await storage.getDocumentsBySession(sessionId);
      res.json(documents);
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  // Get specific document with analysis
  app.get("/api/documents/:id", async (req: any, res) => {
    try {
      const sessionId = getSessionId(req);
      const documentId = parseInt(req.params.id);
      
      const document = await storage.getDocument(documentId);
      if (!document || document.sessionId !== sessionId) {
        return res.status(404).json({ message: "Document not found" });
      }

      const items = await storage.getAnalysisItemsByDocument(documentId);
      const summary = await storage.getAnalysisSummary(documentId);

      res.json({
        document,
        items,
        summary,
      });
    } catch (error) {
      console.error("Error fetching document:", error);
      res.status(500).json({ message: "Failed to fetch document" });
    }
  });

  // Profile routes for anonymous users
  app.get("/api/profile", async (req: any, res) => {
    try {
      const sessionId = getSessionId(req);
      const profile = await storage.getProfile(sessionId);
      res.json(profile || {});
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.post("/api/profile", async (req: any, res) => {
    try {
      const sessionId = getSessionId(req);
      const { name, email, bio, profileImageUrl } = req.body;
      
      const profile = await storage.upsertProfile({
        sessionId,
        name,
        email,
        bio,
        profileImageUrl,
      });
      
      res.json(profile);
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Legacy contract routes for backward compatibility (without auth)
  app.post("/api/contracts/upload", upload.single("contract"), async (req: any, res) => {
    req.body.documentType = "contract";
    // Forward to new document upload endpoint
    return app._router.handle({ ...req, url: "/api/documents/upload", method: "POST" }, res);
  });

  app.get("/api/contracts", async (req: any, res) => {
    try {
      const sessionId = getSessionId(req);
      const documents = await storage.getDocumentsBySession(sessionId);
      const contracts = documents.filter(doc => doc.documentType === "contract");
      res.json(contracts);
    } catch (error) {
      console.error("Error fetching contracts:", error);
      res.status(500).json({ message: "Failed to fetch contracts" });
    }
  });

  app.get("/api/contracts/:id", async (req: any, res) => {
    try {
      const sessionId = getSessionId(req);
      const documentId = parseInt(req.params.id);
      const document = await storage.getDocument(documentId);
      if (!document || document.sessionId !== sessionId) {
        return res.status(404).json({ message: "Document not found" });
      }
      const items = await storage.getAnalysisItemsByDocument(documentId);
      const summary = await storage.getAnalysisSummary(documentId);
      res.json({
        contract: document,
        clauses: items,
        summary,
        document,
        items,
      });
    } catch (error) {
      console.error("Error fetching contract:", error);
      res.status(500).json({ message: "Failed to fetch contract" });
    }
  });

  // Background document analysis processing
  async function processDocumentAnalysis(
    documentId: number, 
    filePath: string, 
    fileType: string, 
    documentType: "contract" | "resume"
  ) {
    try {
      // Extract text from file
      const extractedText = await extractTextFromFile(filePath, fileType);
      
      // Update document with extracted text
      await storage.updateDocumentStatus(documentId, "analyzing");
      
      let analysis: any;
      let summary: any;
      let items: any[];

      if (documentType === "contract") {
        // Analyze contract with OpenAI
        analysis = await analyzeContract(extractedText);
        
        // Save analysis items (clauses)
        const clauseData = analysis.clauses.map((clause: any) => ({
          documentId,
          itemText: clause.clauseText,
          category: clause.category,
          riskLevel: clause.riskLevel,
          summary: clause.summary,
          suggestion: clause.suggestion,
          startPosition: clause.startPosition,
          endPosition: clause.endPosition,
        }));
        
        items = await storage.createAnalysisItems(clauseData);
        
        // Save analysis summary
        summary = await storage.createAnalysisSummary({
          documentId,
          criticalIssues: analysis.criticalIssues,
          recommendations: analysis.recommendations,
          missingItems: analysis.missingClauses,
          highRiskCount: analysis.highRiskCount,
          mediumRiskCount: analysis.mediumRiskCount,
          lowRiskCount: analysis.lowRiskCount,
        });
        
        await storage.updateDocumentStatus(documentId, "completed", analysis.overallRiskLevel);
      } else {
        // Analyze resume with OpenAI
        analysis = await analyzeResume(extractedText);
        
        // Save analysis items (sections)
        const sectionData = analysis.sections.map((section: any) => ({
          documentId,
          itemText: section.sectionText,
          category: section.category,
          score: section.score,
          summary: section.summary,
          suggestion: section.suggestion,
          startPosition: section.startPosition,
          endPosition: section.endPosition,
        }));
        
        items = await storage.createAnalysisItems(sectionData);
        
        // Save analysis summary
        summary = await storage.createAnalysisSummary({
          documentId,
          criticalIssues: analysis.weaknesses,
          recommendations: analysis.recommendations,
          missingItems: analysis.missingElements,
          overallScore: analysis.overallScore,
        });
        
        await storage.updateDocumentStatus(documentId, "completed");
      }
      
      // Clean up uploaded file
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
      
    } catch (error) {
      console.error("Error processing document analysis:", error);
      await storage.updateDocumentStatus(documentId, "failed");
      
      // Clean up uploaded file on error
      fs.unlink(filePath, (err) => {
        if (err) console.error("Error deleting uploaded file:", err);
      });
    }
  }

  const httpServer = createServer(app);
  return httpServer;
}