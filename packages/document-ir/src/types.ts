import { z } from "zod";

export type BlockType =
  | "heading"
  | "paragraph"
  | "list_item"
  | "table"
  | "table_row"
  | "table_cell"
  | "header"
  | "footer"
  | "divider";

export interface BoundingBox {
  x: number;      // 0.0 to 1.0 normalized
  y: number;      // 0.0 to 1.0 normalized
  width: number;  // 0.0 to 1.0 normalized
  height: number; // 0.0 to 1.0 normalized
}

export interface SourceSpan {
  blockId: string;
  pageNumber: number;
  canonicalStart: number; // half-open UTF-16 code unit offset [start, end)
  canonicalEnd: number;
  text: string;
  boundingBox?: BoundingBox;
  isOcr?: boolean;
  confidence?: number;
}

export interface SourceMapEntry {
  blockId: string;
  pageNumber: number;
  canonicalStart: number;
  canonicalEnd: number;
  originalByteOffset?: [number, number];
  boundingBox?: BoundingBox;
  isOcr: boolean;
  confidence: number;
}

export interface BlockNode {
  id: string;
  type: BlockType;
  canonicalStart: number;
  canonicalEnd: number;
  text: string;
  rawText?: string;
  level?: number; // Heading level (1-6) or list nesting depth
  readingOrderIndex: number;
  boundingBox?: BoundingBox;
  confidence: number;
  isOcr: boolean;
  children?: BlockNode[];
  metadata?: Record<string, unknown>;
}

export interface PageNode {
  pageNumber: number; // 1-based index
  width: number;
  height: number;
  blocks: BlockNode[];
  isOcr: boolean;
  columnCount?: number;
  readingOrderConfidence?: number;
}

export interface DocumentIR {
  id: string;
  versionId: string;
  originalSha256: string;
  mediaType: string;
  extractorVersion: string;
  extractedAt: string;
  pageCount: number;
  pages: PageNode[];
  canonicalText: string;
  sourceMap: SourceMapEntry[];
  metadata?: Record<string, unknown>;
}

// Zod schemas for DocumentIR
export const BoundingBoxSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const BlockTypeSchema = z.enum([
  "heading",
  "paragraph",
  "list_item",
  "table",
  "table_row",
  "table_cell",
  "header",
  "footer",
  "divider",
]);

export const SourceMapEntrySchema = z.object({
  blockId: z.string().min(1),
  pageNumber: z.number().int().positive(),
  canonicalStart: z.number().int().nonnegative(),
  canonicalEnd: z.number().int().positive(),
  originalByteOffset: z.tuple([z.number().int().nonnegative(), z.number().int().positive()]).optional(),
  boundingBox: BoundingBoxSchema.optional(),
  isOcr: z.boolean(),
  confidence: z.number().min(0).max(1),
});

export const BlockNodeSchema: z.ZodType<BlockNode> = z.lazy(() =>
  z.object({
    id: z.string().min(1),
    type: BlockTypeSchema,
    canonicalStart: z.number().int().nonnegative(),
    canonicalEnd: z.number().int().positive(),
    text: z.string(),
    rawText: z.string().optional(),
    level: z.number().int().optional(),
    readingOrderIndex: z.number().int().nonnegative(),
    boundingBox: BoundingBoxSchema.optional(),
    confidence: z.number().min(0).max(1),
    isOcr: z.boolean(),
    children: z.array(BlockNodeSchema).optional(),
    metadata: z.record(z.unknown()).optional(),
  })
);

export const PageNodeSchema = z.object({
  pageNumber: z.number().int().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  blocks: z.array(BlockNodeSchema),
  isOcr: z.boolean(),
  columnCount: z.number().int().positive().optional(),
  readingOrderConfidence: z.number().min(0).max(1).optional(),
});

export const DocumentIRSchema = z.object({
  id: z.string().min(1),
  versionId: z.string().min(1),
  originalSha256: z.string().length(64),
  mediaType: z.string().min(1),
  extractorVersion: z.string().min(1),
  extractedAt: z.string().datetime(),
  pageCount: z.number().int().positive(),
  pages: z.array(PageNodeSchema),
  canonicalText: z.string(),
  sourceMap: z.array(SourceMapEntrySchema),
  metadata: z.record(z.unknown()).optional(),
});
