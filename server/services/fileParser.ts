import * as fs from "fs";

export async function extractTextFromPDF(filePath: string): Promise<string> {
  const pdfParse = await import("pdf-parse").then((m) => m.default);
  const fileBuffer = fs.readFileSync(filePath);
  const pdf = await pdfParse(fileBuffer);
  return pdf.text;
}

export async function extractTextFromDOCX(filePath: string): Promise<string> {
  const mammoth = await import("mammoth");
  const fileBuffer = fs.readFileSync(filePath);
  const result = await mammoth.extractRawText({ buffer: fileBuffer });
  return result.value;
}

export async function extractTextFromFile(filePath: string, fileType: string): Promise<string> {
  if (fileType === "application/pdf") {
    return extractTextFromPDF(filePath);
  }
  if (fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
    return extractTextFromDOCX(filePath);
  }
  throw new Error(`Unsupported file type: ${fileType}`);
}
