import { DocumentIR, DocumentIRSchema } from "./types";
import { CovenantError } from "@covenant/shared";

export function serializeDocumentIR(doc: DocumentIR): string {
  return JSON.stringify(doc);
}

export function deserializeDocumentIR(jsonString: string): DocumentIR {
  try {
    const raw = JSON.parse(jsonString);
    const parsed = DocumentIRSchema.parse(raw);
    return parsed;
  } catch (err) {
    throw new CovenantError({
      message: `Failed to deserialize DocumentIR: ${err instanceof Error ? err.message : String(err)}`,
      code: "CORRUPT_DOCUMENT",
      statusCode: 422,
      cause: err,
    });
  }
}
