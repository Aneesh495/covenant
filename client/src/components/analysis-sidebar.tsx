import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  AlertTriangle, 
  Calendar, 
  Shield, 
  Gavel, 
  DollarSign, 
  FileText,
  Brain
} from "lucide-react";

interface AnalysisSidebarProps {
  summary?: any;
  clauses: any[];
  contract: any;
}

export function AnalysisSidebar({ summary, clauses, contract }: AnalysisSidebarProps) {
  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-yellow-100 text-yellow-700";
      case "low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "liability":
        return <AlertTriangle className="h-4 w-4" />;
      case "termination":
        return <Calendar className="h-4 w-4" />;
      case "confidentiality":
        return <Shield className="h-4 w-4" />;
      case "compliance":
        return <Gavel className="h-4 w-4" />;
      case "payment":
        return <DollarSign className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "liability":
        return "bg-red-50 border-red-200 text-red-900";
      case "termination":
        return "bg-yellow-50 border-yellow-200 text-yellow-900";
      case "confidentiality":
        return "bg-blue-50 border-blue-200 text-blue-900";
      case "compliance":
        return "bg-green-50 border-green-200 text-green-900";
      case "payment":
        return "bg-purple-50 border-purple-200 text-purple-900";
      default:
        return "bg-gray-50 border-gray-200 text-gray-900";
    }
  };

  // Calculate clause categories
  const clauseCategories = clauses.reduce((acc, clause) => {
    const category = clause.category || "other";
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Calculate risk counts
  const riskCounts = clauses.reduce(
    (acc, clause) => {
      if (clause.riskLevel === "high") acc.high++;
      else if (clause.riskLevel === "medium") acc.medium++;
      else acc.low++;
      return acc;
    },
    { high: 0, medium: 0, low: 0 }
  );

  if (contract.analysisStatus !== "completed") {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Analysis Status</h3>
            <div className="text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
              </div>
              <p className="text-slate-600">
                {contract.analysisStatus === "processing" 
                  ? "Analysis in progress..." 
                  : contract.analysisStatus === "failed"
                  ? "Analysis failed"
                  : "Waiting for analysis"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Risk Summary Card */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Risk Assessment</h3>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">Overall Risk Level</span>
              <Badge className={getRiskColor(contract.overallRiskLevel || "low")}>
                {contract.overallRiskLevel === "high" ? "High Risk" :
                 contract.overallRiskLevel === "medium" ? "Medium Risk" :
                 "Low Risk"}
              </Badge>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">High Risk Issues</span>
                <span className="font-medium text-red-600">{riskCounts.high}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Medium Risk Issues</span>
                <span className="font-medium text-yellow-600">{riskCounts.medium}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Low Risk Issues</span>
                <span className="font-medium text-green-600">{riskCounts.low}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clause Categories */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Clause Categories</h3>
          
          <div className="space-y-3">
            {Object.entries(clauseCategories).map(([category, count]) => (
              <div 
                key={category}
                className={`flex items-center justify-between p-3 rounded-lg border ${getCategoryColor(category)}`}
              >
                <div className="flex items-center space-x-3">
                  {getCategoryIcon(category)}
                  <span className="font-medium capitalize">
                    {category.replace("_", " ")}
                  </span>
                </div>
                <span className="text-sm font-medium">
                  {String(count)} clause{count !== 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* AI Summary */}
      <Card>
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            <Brain className="h-5 w-5 inline mr-2" />
            AI Analysis Summary
          </h3>
          
          <div className="space-y-4 text-sm">
            {riskCounts.high > 0 && (
              <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                <h4 className="font-medium text-red-900 mb-2">⚠️ Critical Issues Found</h4>
                <p className="text-red-800">
                  {summary?.criticalIssues || 
                   "Extremely broad liability limitations found that could leave you unprotected. Consider negotiating exceptions for gross negligence and willful misconduct."}
                </p>
              </div>
            )}
            
            {riskCounts.medium > 0 && (
              <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-medium text-yellow-900 mb-2">⚡ Areas of Concern</h4>
                <p className="text-yellow-800">
                  {summary?.recommendations || 
                   "Auto-renewal clauses with short notice periods may be difficult to manage. Consider requesting longer notice periods."}
                </p>
              </div>
            )}
            
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <h4 className="font-medium text-blue-900 mb-2">✅ Recommendations</h4>
              <p className="text-blue-800">
                {summary?.missingClauses || 
                 "Consider adding: Data protection clause, Force majeure provision, Dispute resolution mechanism."}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
