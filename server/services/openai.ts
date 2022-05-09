import dotenv from "dotenv";
import OpenAI from "openai";

// Load environment variables first
dotenv.config();

console.log("Checking OpenAI API Key:", process.env.OPENAI_API_KEY ? "✓ Found" : "✗ Not found");

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY not found. Using demo mode with sample analysis.");
}

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY 
}) : null;

export interface ClauseAnalysis {
  clauseText: string;
  category: string;
  riskLevel: "low" | "medium" | "high";
  summary: string;
  suggestion?: string;
  startPosition: number;
  endPosition: number;
}

export interface ContractAnalysis {
  clauses: ClauseAnalysis[];
  overallRiskLevel: "low" | "medium" | "high";
  criticalIssues: string;
  recommendations: string;
  missingClauses: string;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
}

export async function analyzeContract(contractText: string): Promise<ContractAnalysis> {
  try {
    // If no OpenAI API key, return demo analysis
    if (!openai) {
      return getDemoAnalysis(contractText);
    }

    const prompt = `
You are a legal contract analysis AI. Analyze the following contract text and provide a structured analysis.

For each clause found, provide:
- The exact clause text
- Category (liability, termination, confidentiality, compliance, payment, intellectual_property, data_protection, force_majeure, dispute_resolution, or other)
- Risk level (low, medium, high)
- Plain English summary (1-2 sentences)
- Suggested revision if risky
- Start and end character positions in the text

Also provide:
- Overall risk assessment
- Critical issues summary
- Recommendations
- Missing common clauses
- Risk counts

Respond with JSON in this exact format:
{
  "clauses": [
    {
      "clauseText": "exact clause text",
      "category": "category_name",
      "riskLevel": "low|medium|high",
      "summary": "plain English summary",
      "suggestion": "suggested revision if risky",
      "startPosition": 0,
      "endPosition": 100
    }
  ],
  "overallRiskLevel": "low|medium|high",
  "criticalIssues": "summary of critical issues",
  "recommendations": "key recommendations",
  "missingClauses": "list of missing important clauses",
  "highRiskCount": 0,
  "mediumRiskCount": 0,
  "lowRiskCount": 0
}

Contract text:
${contractText}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are a legal contract analysis expert. Analyze contracts thoroughly and identify risks, categorize clauses, and provide actionable insights.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const result = JSON.parse(response.choices[0].message.content || "{}");
    
    // Validate and sanitize the response
    if (!result.clauses || !Array.isArray(result.clauses)) {
      throw new Error("Invalid analysis response: missing clauses array");
    }

    // Calculate risk counts
    const riskCounts = result.clauses.reduce(
      (acc: any, clause: any) => {
        if (clause.riskLevel === "high") acc.highRiskCount++;
        else if (clause.riskLevel === "medium") acc.mediumRiskCount++;
        else acc.lowRiskCount++;
        return acc;
      },
      { highRiskCount: 0, mediumRiskCount: 0, lowRiskCount: 0 }
    );

    return {
      ...result,
      ...riskCounts,
    } as ContractAnalysis;
  } catch (error) {
    console.error("OpenAI analysis error:", error);
    throw new Error(`Failed to analyze contract: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Demo analysis for when no API key is provided
function getDemoAnalysis(contractText: string): ContractAnalysis {
  return {
    clauses: [
      {
        clauseText: "IN NO EVENT SHALL LICENSOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, REGARDLESS OF WHETHER LICENSOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.",
        category: "liability",
        riskLevel: "high" as const,
        summary: "This clause completely eliminates the licensor's liability for most types of damages, which is very broad and could leave you unprotected.",
        suggestion: "Consider negotiating exceptions for gross negligence and willful misconduct.",
        startPosition: 250,
        endPosition: 520
      },
      {
        clauseText: "This Agreement shall automatically renew for successive one-year periods unless either party provides written notice of non-renewal at least 60 days prior to the expiration of the then-current term.",
        category: "termination",
        riskLevel: "medium" as const,
        summary: "Auto-renewal clause with a 60-day notice period may be difficult to manage if you forget to cancel.",
        suggestion: "Request a longer notice period (90-120 days) or annual confirmation requirement.",
        startPosition: 680,
        endPosition: 850
      },
      {
        clauseText: "Each party acknowledges that it may have access to certain confidential information of the other party. Each party agrees to maintain the confidentiality of such information and not to disclose it to third parties.",
        category: "confidentiality",
        riskLevel: "low" as const,
        summary: "Standard confidentiality clause that protects both parties' sensitive information.",
        suggestion: undefined,
        startPosition: 900,
        endPosition: 1150
      }
    ],
    overallRiskLevel: "medium" as const,
    criticalIssues: "Extremely broad liability limitations found that could leave you unprotected in case of damages.",
    recommendations: "Negotiate exceptions to liability limitations for gross negligence. Consider longer notice periods for auto-renewal clauses.",
    missingClauses: "Data protection clause, Force majeure provision, Specific dispute resolution mechanism",
    highRiskCount: 1,
    mediumRiskCount: 1,
    lowRiskCount: 1
  };
}
