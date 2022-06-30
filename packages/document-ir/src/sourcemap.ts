import { DocumentIR, SourceMapEntry, SourceSpan } from "./types";
import { CovenantError } from "@covenant/shared";

export function findSourceMapEntryAtOffset(
  sourceMap: SourceMapEntry[],
  offset: number
): SourceMapEntry | undefined {
  if (sourceMap.length === 0) return undefined;

  let low = 0;
  let high = sourceMap.length - 1;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const entry = sourceMap[mid];

    if (offset >= entry.canonicalStart && offset < entry.canonicalEnd) {
      return entry;
    } else if (offset < entry.canonicalStart) {
      high = mid - 1;
    } else {
      low = mid + 1;
    }
  }

  return undefined;
}

export function findSourceMapEntriesInRange(
  sourceMap: SourceMapEntry[],
  startOffset: number,
  endOffset: number
): SourceMapEntry[] {
  if (startOffset >= endOffset) return [];

  return sourceMap.filter(
    (entry) => entry.canonicalStart < endOffset && entry.canonicalEnd > startOffset
  );
}

export function resolveSpanFromDocument(
  doc: DocumentIR,
  startOffset: number,
  endOffset: number
): SourceSpan {
  if (startOffset < 0 || endOffset > doc.canonicalText.length || startOffset >= endOffset) {
    throw new CovenantError({
      message: `Invalid span offsets [${startOffset}, ${endOffset}) for document with canonical length ${doc.canonicalText.length}`,
      code: "SPAN_OUT_OF_BOUNDS",
      statusCode: 422,
    });
  }

  const entries = findSourceMapEntriesInRange(doc.sourceMap, startOffset, endOffset);
  if (entries.length === 0) {
    throw new CovenantError({
      message: `No source block found intersecting span [${startOffset}, ${endOffset})`,
      code: "CITATION_INVALID",
      statusCode: 422,
    });
  }

  const primaryEntry = entries[0];
  const sliceText = doc.canonicalText.slice(startOffset, endOffset);

  return {
    blockId: primaryEntry.blockId,
    pageNumber: primaryEntry.pageNumber,
    canonicalStart: startOffset,
    canonicalEnd: endOffset,
    text: sliceText,
    boundingBox: primaryEntry.boundingBox,
    isOcr: primaryEntry.isOcr,
    confidence: primaryEntry.confidence,
  };
}
