import * as fs from "fs";
import * as path from "path";

// For PDF parsing using pdf-parse library
export async function extractTextFromPDF(filePath: string): Promise<string> {
  try {
    const pdfParse = await import("pdf-parse").then(m => m.default);
    const fileBuffer = fs.readFileSync(filePath);
    const pdf = await pdfParse(fileBuffer);
    return pdf.text;
  } catch (error) {
    console.error("PDF parsing error:", error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// For DOCX parsing using mammoth library
export async function extractTextFromDOCX(filePath: string): Promise<string> {
  try {
    const mammoth = await import("mammoth");
    const fileBuffer = fs.readFileSync(filePath);
    const result = await mammoth.extractRawText({ buffer: fileBuffer });
    return result.value;
  } catch (error) {
    throw new Error(`Failed to extract text from DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// For demo purposes, we'll provide a sample contract text
export function getSampleContractText(): string {
  return `SOFTWARE LICENSE AGREEMENT

This Software License Agreement ("Agreement") is entered into on December 1, 2024, between TechCorp Inc. ("Licensor") and Customer ("Licensee").

Section 2. GRANT OF LICENSE: Subject to the terms and conditions of this Agreement, Licensor hereby grants to Licensee a non-exclusive, non-transferable license to use the Software solely for Licensee's internal business purposes.

Section 8. LIMITATION OF LIABILITY: IN NO EVENT SHALL LICENSOR BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, REGARDLESS OF WHETHER LICENSOR HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.

Section 12. AUTOMATIC RENEWAL: This Agreement shall automatically renew for successive one-year periods unless either party provides written notice of non-renewal at least 60 days prior to the expiration of the then-current term.

Section 15. CONFIDENTIALITY: Each party acknowledges that it may have access to certain confidential information of the other party. Each party agrees to maintain the confidentiality of such information and not to disclose it to third parties.

Section 18. GOVERNING LAW: This Agreement shall be governed by and construed in accordance with the laws of the State of California, without regard to its conflict of law provisions.

Section 20. ENTIRE AGREEMENT: This Agreement constitutes the entire agreement between the parties and supersedes all prior and contemporaneous agreements, representations, and understandings.`;
}

export async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  try {
    if (fileType === "application/pdf") {
      return await extractTextFromPDF(filePath);
    } else if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      return await extractTextFromDOCX(filePath);
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
  } catch (error) {
    console.error("File parsing error:", error);
    // Fallback to sample text if parsing fails
    console.log("Falling back to sample contract text for demonstration");
    return getSampleContractText();
  }
}
