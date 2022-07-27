import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitCompare, Plus, Minus, Edit3, ArrowRight, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface VersionComparisonModalProps {
  currentDocumentId: string;
  currentDocumentTitle: string;
  isOpen: boolean;
  onClose: () => void;
}

export function VersionComparisonModal({
  currentDocumentId,
  currentDocumentTitle,
  isOpen,
  onClose,
}: VersionComparisonModalProps) {
  const [selectedTargetId, setSelectedTargetId] = useState<string>("");
  const [comparisonResult, setComparisonResult] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all documents in workspace to choose comparison target
  const { data: documents = [] } = useQuery({
    queryKey: ["/api/documents"],
    queryFn: async () => {
      const res = await fetch("/api/documents", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: isOpen,
  });

  const availableTargets = (documents as any[]).filter(
    (d: any) => d.id !== currentDocumentId && d.documentType === "contract"
  );

  const handleRunComparison = async () => {
    if (!selectedTargetId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/documents/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          baseDocumentId: currentDocumentId,
          targetDocumentId: selectedTargetId,
        }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || "Failed to compare document versions");
      }

      const data = await res.json();
      setComparisonResult(data);
    } catch (err: any) {
      setError(err.message || "An error occurred during comparison.");
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-xl shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <GitCompare className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">Semantic Revision Comparison</h3>
              <p className="text-xs text-slate-500">
                Aligns contract clauses and obligations across versions to highlight redlines and risk deltas.
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            <X className="h-4 w-4 text-slate-500" />
          </Button>
        </div>

        {/* Target Selector Toolbar */}
        <div className="px-6 py-3 bg-slate-100/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-700">Base:</span>
            <Badge variant="outline" className="bg-white text-slate-800 font-medium">
              {currentDocumentTitle}
            </Badge>
            <ArrowRight className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-semibold text-slate-700">Compare against:</span>
            <select
              value={selectedTargetId}
              onChange={(e) => setSelectedTargetId(e.target.value)}
              className="h-8 px-2.5 rounded-md border border-slate-300 bg-white text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Select a revision to compare...</option>
              {availableTargets.map((target: any) => (
                <option key={target.id} value={target.id}>
                  {target.title} ({target.originalFilename})
                </option>
              ))}
            </select>
          </div>

          <Button
            size="sm"
            onClick={handleRunComparison}
            disabled={!selectedTargetId || isLoading}
            className="h-8 text-xs px-4"
          >
            {isLoading ? "Comparing..." : "Run Diff"}
          </Button>
        </div>

        {/* Error banner */}
        {error && (
          <div className="px-6 py-2 bg-red-50 border-b border-red-200 text-xs text-red-800 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Body content */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {!comparisonResult ? (
            <div className="text-center py-16 text-slate-500">
              <GitCompare className="h-12 w-12 text-slate-300 mx-auto mb-3" />
              <p className="font-medium text-slate-700">Select a target document revision to start comparison</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                Clause alignment pairs will identify modifications, additions, deletions, and high-risk changes.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Metrics */}
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <Card className="border border-slate-200 p-3 bg-white">
                  <span className="text-[10px] font-semibold uppercase text-slate-500">Identical</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {comparisonResult.summary?.identicalCount ?? 0}
                  </div>
                </Card>
                <Card className="border border-amber-200 p-3 bg-amber-50/50">
                  <span className="text-[10px] font-semibold uppercase text-amber-800">Modified</span>
                  <div className="text-lg font-bold text-amber-900 mt-0.5">
                    {comparisonResult.summary?.modifiedCount ?? 0}
                  </div>
                </Card>
                <Card className="border border-emerald-200 p-3 bg-emerald-50/50">
                  <span className="text-[10px] font-semibold uppercase text-emerald-800">Added</span>
                  <div className="text-lg font-bold text-emerald-900 mt-0.5">
                    {comparisonResult.summary?.addedCount ?? 0}
                  </div>
                </Card>
                <Card className="border border-red-200 p-3 bg-red-50/50">
                  <span className="text-[10px] font-semibold uppercase text-red-800">Deleted</span>
                  <div className="text-lg font-bold text-red-900 mt-0.5">
                    {comparisonResult.summary?.deletedCount ?? 0}
                  </div>
                </Card>
                <Card className="border border-purple-200 p-3 bg-purple-50/50">
                  <span className="text-[10px] font-semibold uppercase text-purple-800">Moved</span>
                  <div className="text-lg font-bold text-purple-900 mt-0.5">
                    {comparisonResult.summary?.movedCount ?? 0}
                  </div>
                </Card>
                <Card className="border border-rose-200 p-3 bg-rose-50/50">
                  <span className="text-[10px] font-semibold uppercase text-rose-800">High Risk</span>
                  <div className="text-lg font-bold text-rose-900 mt-0.5">
                    {comparisonResult.summary?.highRiskChangesCount ?? 0}
                  </div>
                </Card>
              </div>

              {/* Clause Alignments List */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">
                  Aligned Clauses ({comparisonResult.alignments?.length || 0})
                </h4>

                {comparisonResult.alignments?.map((alignment: any, idx: number) => {
                  const type = alignment.alignmentType;
                  const isModified = type === "modified";
                  const isAdded = type === "added";
                  const isDeleted = type === "deleted";
                  const isIdentical = type === "identical";

                  return (
                    <Card
                      key={idx}
                      className={cn(
                        "border bg-white text-xs overflow-hidden",
                        isModified && "border-amber-200",
                        isAdded && "border-emerald-200",
                        isDeleted && "border-red-200",
                        isIdentical && "border-slate-200 opacity-80"
                      )}
                    >
                      <div className="px-4 py-2 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isAdded && (
                            <Badge className="bg-emerald-600 text-white text-[10px] flex items-center gap-1">
                              <Plus className="h-3 w-3" /> Added Clause
                            </Badge>
                          )}
                          {isDeleted && (
                            <Badge className="bg-red-600 text-white text-[10px] flex items-center gap-1">
                              <Minus className="h-3 w-3" /> Deleted Clause
                            </Badge>
                          )}
                          {isModified && (
                            <Badge className="bg-amber-600 text-white text-[10px] flex items-center gap-1">
                              <Edit3 className="h-3 w-3" /> Modified
                            </Badge>
                          )}
                          {isIdentical && (
                            <Badge variant="outline" className="text-slate-600 text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-slate-400" /> Identical
                            </Badge>
                          )}
                          <span className="font-semibold text-slate-900">
                            {alignment.targetClause?.heading || alignment.baseClause?.heading || `Clause ${idx + 1}`}
                          </span>
                        </div>
                        {alignment.similarityScore !== undefined && (
                          <span className="text-[11px] font-mono text-slate-500">
                            Similarity: {Math.round(alignment.similarityScore * 100)}%
                          </span>
                        )}
                      </div>

                      <CardContent className="p-4 space-y-3 font-serif">
                        {isModified && alignment.diffTokens && (
                          <div className="p-3 rounded bg-slate-50 border border-slate-200 leading-relaxed font-sans text-xs">
                            {alignment.diffTokens.map((token: any, tIdx: number) => {
                              if (token.type === "insert") {
                                return (
                                  <span key={tIdx} className="bg-emerald-100 text-emerald-950 font-medium px-0.5 rounded">
                                    {token.text}
                                  </span>
                                );
                              }
                              if (token.type === "delete") {
                                return (
                                  <span key={tIdx} className="bg-red-100 text-red-950 line-through px-0.5 rounded">
                                    {token.text}
                                  </span>
                                );
                              }
                              return <span key={tIdx}>{token.text}</span>;
                            })}
                          </div>
                        )}

                        {isAdded && alignment.targetClause && (
                          <div className="p-3 rounded bg-emerald-50/50 border border-emerald-200/60 text-emerald-950 font-sans text-xs">
                            {alignment.targetClause.fullText}
                          </div>
                        )}

                        {isDeleted && alignment.baseClause && (
                          <div className="p-3 rounded bg-red-50/50 border border-red-200/60 text-red-950 line-through font-sans text-xs">
                            {alignment.baseClause.fullText}
                          </div>
                        )}

                        {isIdentical && alignment.baseClause && (
                          <p className="text-slate-600 font-sans text-xs line-clamp-3">
                            {alignment.baseClause.fullText}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
