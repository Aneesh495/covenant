import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContractViewerProps {
  contract: any;
  clauses: any[];
}

export function ContractViewer({ contract, clauses }: ContractViewerProps) {
  const getRiskBadgeClass = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-blue-100 text-blue-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getClauseHighlightClass = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "clause-highlight-high";
      case "medium":
        return "clause-highlight-medium";
      case "low":
        return "clause-highlight-low";
      default:
        return "";
    }
  };

  const body = (contract?.extractedText || "").trim();

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center gap-2 mb-4 text-slate-700">
          <FileText className="h-5 w-5" />
          <span className="font-medium">{contract?.originalName || "Document"}</span>
        </div>

        {clauses?.length > 0 && (
          <div className="space-y-3 mb-6">
            {clauses.map((clause: any, idx: number) => (
              <div
                key={clause.id ?? idx}
                className={cn("p-4 rounded-r-lg border-l-4", getClauseHighlightClass(clause.riskLevel || clause.severity))}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-slate-800 text-sm whitespace-pre-wrap">
                    {clause.text || clause.content || clause.clauseText || JSON.stringify(clause)}
                  </p>
                  {(clause.riskLevel || clause.severity) && (
                    <Badge className={getRiskBadgeClass(clause.riskLevel || clause.severity)}>
                      {clause.riskLevel || clause.severity}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="prose max-w-none">
          {body ? (
            <pre className="whitespace-pre-wrap font-sans text-sm text-slate-700 leading-relaxed">{body}</pre>
          ) : (
            <p className="text-slate-500 text-sm">
              Extracted text is not available yet. Open this view again once analysis finishes.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
