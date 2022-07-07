import { DocumentIR, BlockNode } from "@covenant/document-ir";

export interface DocumentChunk {
  id: string;
  documentVersionId: string;
  chunkIndex: number;
  headingContext: string;
  canonicalStart: number;
  canonicalEnd: number;
  text: string;
  blockIds: string[];
}

export interface ChunkingOptions {
  targetChunkChars?: number;
  overlapChars?: number;
  preserveHeadings?: boolean;
}

export class HeadingAwareChunker {
  private readonly targetChunkChars: number;
  private readonly overlapChars: number;

  constructor(options: ChunkingOptions = {}) {
    this.targetChunkChars = options.targetChunkChars ?? 500;
    this.overlapChars = options.overlapChars ?? 100;
  }

  chunkDocument(doc: DocumentIR): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    let currentHeadingContext = "";
    let chunkIndex = 0;

    // Collect all blocks in reading order
    const allBlocks: BlockNode[] = [];
    for (const page of doc.pages) {
      for (const block of page.blocks) {
        allBlocks.push(block);
      }
    }

    let currentChunkBlocks: BlockNode[] = [];
    let currentChunkLength = 0;

    const flushChunk = () => {
      if (currentChunkBlocks.length === 0) return;

      const firstBlock = currentChunkBlocks[0];
      const lastBlock = currentChunkBlocks[currentChunkBlocks.length - 1];
      const canonicalStart = firstBlock.canonicalStart;
      const canonicalEnd = lastBlock.canonicalEnd;
      const text = doc.canonicalText.slice(canonicalStart, canonicalEnd);

      chunks.push({
        id: `chunk-${doc.versionId}-${chunkIndex++}`,
        documentVersionId: doc.versionId,
        chunkIndex: chunkIndex - 1,
        headingContext: currentHeadingContext,
        canonicalStart,
        canonicalEnd,
        text,
        blockIds: currentChunkBlocks.map((b) => b.id),
      });

      // Retain overlap: keep blocks from the end that fit in overlapChars
      const overlapBlocks: BlockNode[] = [];
      let overlapLen = 0;
      for (let i = currentChunkBlocks.length - 1; i >= 0; i--) {
        const blk = currentChunkBlocks[i];
        if (overlapLen + blk.text.length <= this.overlapChars) {
          overlapBlocks.unshift(blk);
          overlapLen += blk.text.length;
        } else {
          break;
        }
      }

      currentChunkBlocks = overlapBlocks;
      currentChunkLength = overlapLen;
    };

    for (const block of allBlocks) {
      if (block.type === "heading") {
        // When a new heading is encountered, flush previous section chunk
        if (currentChunkBlocks.length > 0) {
          flushChunk();
        }
        currentHeadingContext = block.text;
      }

      currentChunkBlocks.push(block);
      currentChunkLength += block.text.length;

      if (currentChunkLength >= this.targetChunkChars) {
        flushChunk();
      }
    }

    flushChunk();
    return chunks;
  }
}
