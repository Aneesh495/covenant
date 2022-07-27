import { useMemo, useRef, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Hash, Layers, CheckCircle2, Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CitationHighlight {
  id: string;
  findingId?: string;
  startOffset: number;
  endOffset: number;
  exactQuote: string;
  pageNumber: number;
  confidence?: number;
  sourceType?: string;
  severity?: string;
}

export function extractClauseContent(clause: any): string {
  return clause.text || clause.content || clause.clauseText || JSON.stringify(clause);
}

export interface ContractViewerProps {
  documentTitle: string;
  canonicalText: string;
  citations: CitationHighlight[];
  selectedCitationId?: string;
  onSelectCitation?: (citation: CitationHighlight) => void;
  documentIr?: any;
  sha256?: string;
  pageCount?: number;
}

interface TextSegment {
  text: string;
  startOffset: number;
  endOffset: number;
  citation?: CitationHighlight;
}

export function ContractViewer({
  documentTitle,
  canonicalText,
  citations,
  selectedCitationId,
  onSelectCitation,
  documentIr,
  sha256,
  pageCount,
}: ContractViewerProps) {
  const [showIrModal, setShowIrModal] = useState(false);
  const activeHighlightRef = useRef<HTMLSpanElement | null>(null);

  // Scroll active citation into view when selected
  useEffect(() => {
    if (selectedCitationId && activeHighlightRef.current) {
      activeHighlightRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [selectedCitationId]);

  // Segment canonical text by citation offsets
  const segments = useMemo(() => {
    if (!canonicalText) return [];
    if (!citations || citations.length === 0) {
      return [{ text: canonicalText, startOffset: 0, endOffset: canonicalText.length }];
    }

    // Sort valid citations by startOffset
    const sortedCitations = [...citations]
      .filter((c) => c.startOffset >= 0 && c.endOffset <= canonicalText.length && c.startOffset < c.endOffset)
      .sort((a, b) => a.startOffset - b.startOffset);

    const result: TextSegment[] = [];
    let currentIdx = 0;

    for (const cit of sortedCitations) {
      if (cit.startOffset > currentIdx) {
        result.push({
          text: canonicalText.slice(currentIdx, cit.startOffset),
          startOffset: currentIdx,
          endOffset: cit.startOffset,
        });
      }

      if (cit.endOffset > currentIdx) {
        const segStart = Math.max(currentIdx, cit.startOffset);
        result.push({
          text: canonicalText.slice(segStart, cit.endOffset),
          startOffset: segStart,
          endOffset: cit.endOffset,
          citation: cit,
        });
        currentIdx = cit.endOffset;
      }
    }

    if (currentIdx < canonicalText.length) {
      result.push({
        text: canonicalText.slice(currentIdx),
        startOffset: currentIdx,
        endOffset: canonicalText.length,
      });
    }

    return result;
  }, [canonicalText, citations]);

  const getSeverityBadgeClass = (severity?: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-blue-100 text-blue-800 border-blue-200";
    }
  };

  return (
    <Card className="border border-slate-200 bg-white shadow-sm overflow-hidden flex flex-col">
      {/* Header bar with Document Metadata */}
      <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-slate-900 leading-tight">{documentTitle}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500">
              {pageCount && (
                <span className="flex items-center gap-1">
                  <Layers className="h-3 w-3" />
                  {pageCount} {pageCount === 1 ? "Page" : "Pages"}
                </span>
              )}
              {sha256 && (
                <span className="flex items-center gap-1 font-mono text-[11px]" title={`SHA-256: ${sha256}`}>
                  <Hash className="h-3 w-3" />
                  {sha256.slice(0, 12)}...
                </span>
              )}
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                Immutable DocumentIR
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {documentIr && (
            <Button
              variant="outline"
              size="sm"
              className="text-xs h-8 flex items-center gap-1.5 text-slate-700"
              onClick={() => setShowIrModal(!showIrModal)}
            >
              <Code2 className="h-3.5 w-3.5 text-slate-500" />
              <span>{showIrModal ? "Hide DocumentIR" : "Inspect DocumentIR"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Raw DocumentIR Inspector Sheet */}
      {showIrModal && documentIr && (
        <div className="bg-slate-900 text-slate-100 p-4 border-b border-slate-700 max-h-72 overflow-auto font-mono text-xs">
          <div className="flex justify-between items-center mb-2 pb-2 border-b border-slate-800 text-slate-400">
            <span>Canonical DocumentIR Representation</span>
            <span>Version: {documentIr.extractorVersion || "1.0.0"}</span>
          </div>
          <pre>{JSON.stringify(documentIr, null, 2)}</pre>
        </div>
      )}

      {/* Canonical Text Body with Offset Highlights */}
      <CardContent className="p-6 md:p-8 flex-1 overflow-auto max-h-[850px]">
        {canonicalText ? (
          <div className="font-serif text-slate-800 text-[15px] leading-relaxed max-w-none select-text">
            {segments.map((seg, idx) => {
              if (!seg.citation) {
                return (
                  <span key={idx} className="whitespace-pre-wrap">
                    {seg.text}
                  </span>
                );
              }

              const isSelected = seg.citation.id === selectedCitationId;
              const severity = seg.citation.severity || "medium";

              return (
                <mark
                  key={idx}
                  ref={isSelected ? activeHighlightRef : undefined}
                  onClick={() => onSelectCitation?.(seg.citation!)}
                  title={`Evidence quote [${seg.startOffset}, ${seg.endOffset}) - Page ${seg.citation.pageNumber}`}
                  className={cn(
                    "cursor-pointer rounded-sm px-1 py-0.5 transition-all inline",
                    severity === "critical"
                      ? "bg-red-100 hover:bg-red-200 text-red-950 border-b-2 border-red-500"
                      : severity === "high"
                      ? "bg-amber-100 hover:bg-amber-200 text-amber-950 border-b-2 border-amber-500"
                      : "bg-yellow-100 hover:bg-yellow-200 text-yellow-950 border-b-2 border-yellow-500",
                    isSelected && "ring-2 ring-primary ring-offset-2 font-medium bg-amber-200"
                  )}
                >
                  <span className="whitespace-pre-wrap">{seg.text}</span>
                </mark>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16 text-slate-500">
            <FileText className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <p className="font-medium text-slate-700">Document text extraction pending</p>
            <p className="text-xs text-slate-500 mt-1">Canonical text will appear once the background worker completes extraction.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
