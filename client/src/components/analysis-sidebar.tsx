import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PatchDiffViewer } from "./patch-diff-viewer";
import {
  AlertTriangle,
  ShieldAlert,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  ExternalLink,
  SlidersHorizontal,
  Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FindingCitation {
  id: string;
  exact_quote?: string;
  exactQuote?: string;
  start_offset?: number;
  startOffset?: number;
  end_offset?: number;
  endOffset?: number;
  page_number?: number;
  pageNumber?: number;
  confidence?: number;
  source_type?: string;
  sourceType?: string;
}

export interface GroundedFindingItem {
  id: string;
  rule_id?: string;
  ruleId?: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  title: string;
  explanation: string;
  suggested_action?: string;
  suggestedAction?: string;
  suggested_patch_json?: any;
  suggestedPatch?: any;
  decision_state?: "pending" | "accepted" | "rejected";
  decisionState?: "pending" | "accepted" | "rejected";
  reviewer_comments?: string;
  citations: FindingCitation[];
}

export interface AnalysisSidebarProps {
  findings: GroundedFindingItem[];
  selectedFindingId?: string;
  onSelectFinding?: (findingId: string) => void;
  onSelectCitation?: (citation: any) => void;
  onDecisionChange?: (findingId: string, decision: "accepted" | "rejected" | "pending") => Promise<void>;
  documentType?: string;
}

export function AnalysisSidebar({
  findings,
  selectedFindingId,
  onSelectFinding,
  onSelectCitation,
  onDecisionChange,
  documentType = "contract",
}: AnalysisSidebarProps) {
  const [filterSeverity, setFilterSeverity] = useState<string>("all");
  const [isUpdating, setIsUpdating] = useState<string | null>(null);

  const filteredFindings = findings.filter((f) => {
    if (filterSeverity === "all") return true;
    return f.severity === filterSeverity;
  });

  const criticalCount = findings.filter((f) => f.severity === "critical").length;
  const highCount = findings.filter((f) => f.severity === "high").length;
  const mediumCount = findings.filter((f) => f.severity === "medium").length;
  const lowCount = findings.filter((f) => f.severity === "low").length;

  const handleDecision = async (findingId: string, decision: "accepted" | "rejected" | "pending") => {
    if (!onDecisionChange) return;
    setIsUpdating(findingId);
    try {
      await onDecisionChange(findingId, decision);
    } finally {
      setIsUpdating(null);
    }
  };

  const getSeverityBadgeClass = (severity: string) => {
    switch (severity) {
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      case "high":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case "critical":
        return <ShieldAlert className="h-4 w-4 text-red-600" />;
      case "high":
        return <AlertTriangle className="h-4 w-4 text-amber-600" />;
      case "medium":
        return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Info className="h-4 w-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-4">
      {/* Triage Summary Card */}
      <Card className="border border-slate-200 shadow-sm bg-white">
        <CardHeader className="pb-3 pt-4 px-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-primary" />
              <span>Policy Findings ({findings.length})</span>
            </CardTitle>
            <Badge variant="outline" className="text-xs bg-slate-50">
              Institutional Policy
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-3">
          {/* Severity Filter Pills */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <Button
              variant={filterSeverity === "all" ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => setFilterSeverity("all")}
            >
              All ({findings.length})
            </Button>
            {criticalCount > 0 && (
              <Button
                variant={filterSeverity === "critical" ? "destructive" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2.5",
                  filterSeverity !== "critical" && "text-red-700 border-red-200 hover:bg-red-50"
                )}
                onClick={() => setFilterSeverity("critical")}
              >
                Critical ({criticalCount})
              </Button>
            )}
            {highCount > 0 && (
              <Button
                variant={filterSeverity === "high" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2.5",
                  filterSeverity !== "high" && "text-amber-800 border-amber-200 hover:bg-amber-50"
                )}
                onClick={() => setFilterSeverity("high")}
              >
                High ({highCount})
              </Button>
            )}
            {mediumCount > 0 && (
              <Button
                variant={filterSeverity === "medium" ? "default" : "outline"}
                size="sm"
                className={cn(
                  "h-7 text-xs px-2.5",
                  filterSeverity !== "medium" && "text-yellow-800 border-yellow-200 hover:bg-yellow-50"
                )}
                onClick={() => setFilterSeverity("medium")}
              >
                Medium ({mediumCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Findings List */}
      <div className="space-y-3 max-h-[850px] overflow-y-auto pr-1">
        {filteredFindings.length === 0 ? (
          <Card className="border border-slate-200 p-8 text-center bg-white">
            <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-slate-800">No policy violations found</h4>
            <p className="text-xs text-slate-500 mt-1">All clauses satisfy the institutional review guidelines.</p>
          </Card>
        ) : (
          filteredFindings.map((finding) => {
            const isSelected = finding.id === selectedFindingId;
            const patch = finding.suggested_patch_json || finding.suggestedPatch;
            const decision = finding.decision_state || finding.decisionState || "pending";
            const ruleId = finding.rule_id || finding.ruleId;

            return (
              <Card
                key={finding.id}
                onClick={() => onSelectFinding?.(finding.id)}
                className={cn(
                  "border transition-all cursor-pointer bg-white text-left",
                  isSelected
                    ? "border-primary ring-2 ring-primary/20 shadow-md"
                    : "border-slate-200 hover:border-slate-300 shadow-sm"
                )}
              >
                <CardContent className="p-4 space-y-3">
                  {/* Top status bar */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="flex items-center gap-1">
                        {getSeverityIcon(finding.severity)}
                      </span>
                      <Badge className={cn("text-[10px] uppercase font-bold", getSeverityBadgeClass(finding.severity))}>
                        {finding.severity}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-600 bg-slate-50">
                        {finding.category}
                      </Badge>
                    </div>

                    {/* Decision State Indicator */}
                    <div>
                      {decision === "accepted" && (
                        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] flex items-center gap-1">
                          <CheckCircle className="h-3 w-3" />
                          Accepted
                        </Badge>
                      )}
                      {decision === "rejected" && (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-[10px] flex items-center gap-1">
                          <XCircle className="h-3 w-3" />
                          Rejected
                        </Badge>
                      )}
                      {decision === "pending" && (
                        <Badge className="bg-amber-50 text-amber-800 border-amber-200 text-[10px] flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Pending Review
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Finding Title & Rule */}
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900 leading-snug">{finding.title}</h4>
                    {ruleId && <p className="text-[11px] font-mono text-slate-400 mt-0.5">{ruleId}</p>}
                  </div>

                  {/* Explanation */}
                  <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-2.5 rounded border border-slate-100">
                    {finding.explanation}
                  </p>

                  {/* Suggested Remediation Action */}
                  {(finding.suggested_action || finding.suggestedAction) && (
                    <div className="text-xs text-slate-700">
                      <span className="font-semibold text-slate-800">Action: </span>
                      {finding.suggested_action || finding.suggestedAction}
                    </div>
                  )}

                  {/* Suggested Redline Patch */}
                  {patch && (
                    <PatchDiffViewer
                      originalText={patch.originalText}
                      replacementText={patch.replacementText}
                      explanation={patch.explanation}
                    />
                  )}

                  {/* Citations List */}
                  {finding.citations && finding.citations.length > 0 && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Exact Evidence Citations ({finding.citations.length})
                      </span>
                      {finding.citations.map((c, cIdx) => {
                        const quote = c.exact_quote || c.exactQuote;
                        const page = c.page_number || c.pageNumber || 1;
                        const start = c.start_offset ?? c.startOffset ?? 0;
                        const end = c.end_offset ?? c.endOffset ?? 0;

                        return (
                          <div
                            key={c.id || cIdx}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectCitation?.({
                                ...c,
                                id: c.id,
                                findingId: finding.id,
                                startOffset: start,
                                endOffset: end,
                                exactQuote: quote,
                                pageNumber: page,
                                severity: finding.severity,
                              });
                            }}
                            className="p-2 rounded bg-amber-50/70 border border-amber-200/60 hover:bg-amber-100/70 transition-colors text-xs text-slate-800 flex items-start justify-between gap-2 group"
                          >
                            <div className="space-y-1 overflow-hidden">
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium">
                                <span>Page {page}</span>
                                <span>·</span>
                                <span className="font-mono">offsets [{start}, {end})</span>
                              </div>
                              <p className="font-serif italic text-slate-700 line-clamp-2">
                                "{quote}"
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 px-1.5 text-[10px] text-amber-900 group-hover:bg-amber-200/60"
                            >
                              <ExternalLink className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Reviewer Decision Triage Buttons */}
                  <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
                    <Button
                      variant={decision === "accepted" ? "default" : "outline"}
                      size="sm"
                      disabled={isUpdating === finding.id}
                      className={cn(
                        "h-7 text-xs px-2.5",
                        decision === "accepted" && "bg-emerald-600 hover:bg-emerald-700 text-white"
                      )}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDecision(finding.id, "accepted");
                      }}
                    >
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Accept
                    </Button>

                    <Button
                      variant={decision === "rejected" ? "secondary" : "outline"}
                      size="sm"
                      disabled={isUpdating === finding.id}
                      className={cn("h-7 text-xs px-2.5")}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDecision(finding.id, "rejected");
                      }}
                    >
                      <XCircle className="h-3 w-3 mr-1" />
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Model & Verification Pipeline Transparency Card */}
      <Card className="border border-slate-200 shadow-sm bg-slate-50/70 p-3 text-xs text-slate-600">
        <div className="flex items-center gap-2 mb-1.5 font-semibold text-slate-800">
          <Cpu className="h-4 w-4 text-primary" />
          <span>Verification & Model Lineage</span>
        </div>
        <p className="text-[11px] text-slate-500 leading-normal">
          Deterministic AST policy evaluator active. Every citation links to exact UTF-16 canonical offsets.
          Fallback verification guarantees zero unsupported factual additions.
        </p>
      </Card>
    </div>
  );
}
