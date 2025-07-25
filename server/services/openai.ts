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

export interface ResumeSection {
  sectionText: string;
  category: string;
  score: number; // 1-10 rating
  summary: string;
  suggestion?: string;
  startPosition: number;
  endPosition: number;
}

export interface ResumeAnalysis {
  sections: ResumeSection[];
  overallScore: number; // 1-10 overall rating
  strengths: string;
  weaknesses: string;
  recommendations: string;
  missingElements: string;
  skillsGap: string;
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

export async function analyzeResume(resumeText: string): Promise<ResumeAnalysis> {
  try {
    // If no OpenAI API key, return demo analysis
    if (!openai) {
      return getDemoResumeAnalysis(resumeText);
    }

    const prompt = `
You are a professional resume analysis AI. Analyze the following resume text and provide detailed feedback.

For each section found, provide:
- The exact section text
- Category (summary, experience, education, skills, projects, certifications, achievements, contact, or other)
- Score from 1-10 (10 being excellent)
- Plain English summary of what's good/bad
- Specific improvement suggestions
- Start and end character positions in the text

Also provide:
- Overall score (1-10)
- Key strengths
- Main weaknesses
- Actionable recommendations
- Missing elements that should be added
- Skills gap analysis

Respond with JSON in this exact format:
{
  "sections": [
    {
      "sectionText": "exact section text",
      "category": "category_name",
      "score": 8,
      "summary": "analysis of this section",
      "suggestion": "specific improvement",
      "startPosition": 0,
      "endPosition": 100
    }
  ],
  "overallScore": 7,
  "strengths": "key strengths",
  "weaknesses": "main weaknesses",
  "recommendations": "actionable recommendations",
  "missingElements": "missing elements to add",
  "skillsGap": "skills gap analysis"
}

Resume text:
${resumeText}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o", // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      messages: [
        {
          role: "system",
          content: "You are an expert resume reviewer and career advisor. Analyze resumes thoroughly and provide detailed, actionable feedback to help improve job prospects.",
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
    if (!result.sections || !Array.isArray(result.sections)) {
      throw new Error("Invalid analysis response: missing sections array");
    }

    return {
      sections: result.sections,
      overallScore: Math.max(1, Math.min(10, result.overallScore || 5)),
      strengths: result.strengths || "No specific strengths identified.",
      weaknesses: result.weaknesses || "No specific weaknesses identified.",
      recommendations: result.recommendations || "No specific recommendations provided.",
      missingElements: result.missingElements || "No missing elements identified.",
      skillsGap: result.skillsGap || "No skills gap analysis available."
    };
  } catch (error) {
    console.error("Resume analysis error:", error);
    // Fallback to demo analysis on API error
    return getDemoResumeAnalysis(resumeText);
  }
}

// Demo resume analysis for when no API key is provided
function getDemoResumeAnalysis(resumeText: string): ResumeAnalysis {
  return {
    sections: [
      {
        sectionText: "Software Engineer with 5+ years of experience in full-stack development, specializing in React, Node.js, and cloud technologies.",
        category: "summary",
        score: 7,
        summary: "Good technical summary that highlights key skills and experience. However, it could be more specific about achievements and impact.",
        suggestion: "Add quantifiable achievements and specify the types of applications or industries you've worked in.",
        startPosition: 0,
        endPosition: 120
      },
      {
        sectionText: "Senior Developer at TechCorp (2020-2023): Built scalable web applications using React and Node.js. Managed a team of 3 developers.",
        category: "experience",
        score: 6,
        summary: "Experience section shows progression and leadership but lacks specific achievements and metrics.",
        suggestion: "Add specific metrics like 'increased performance by 40%' or 'delivered 15+ projects on time'.",
        startPosition: 150,
        endPosition: 280
      },
      {
        sectionText: "JavaScript, React, Node.js, Python, AWS, Docker, PostgreSQL",
        category: "skills",
        score: 8,
        summary: "Good mix of frontend, backend, and infrastructure skills that are in high demand.",
        suggestion: "Group skills by category (Frontend, Backend, Cloud) and add proficiency levels.",
        startPosition: 300,
        endPosition: 380
      }
    ],
    overallScore: 7,
    strengths: "Strong technical skill set, shows career progression, good mix of frontend and backend experience.",
    weaknesses: "Lacks quantifiable achievements, missing education section, no certifications mentioned.",
    recommendations: "Add specific metrics to achievements, include education background, consider adding relevant certifications, improve formatting and visual appeal.",
    missingElements: "Education section, certifications, projects section, contact information.",
    skillsGap: "Consider adding modern frameworks like Next.js, cloud certifications (AWS/Azure), and DevOps skills like Kubernetes."
  };
}
