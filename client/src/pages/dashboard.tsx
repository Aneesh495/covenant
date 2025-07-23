import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, Upload, User, BarChart3 } from "lucide-react";
import { FileUpload } from "@/components/ui/file-upload";
import { useLocation } from "wouter";

export default function Dashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const { data: contracts, isLoading } = useQuery({
    queryKey: ["/api/contracts"],
  });

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

  const getRiskIcon = (fileType: string) => {
    if (fileType.includes("pdf")) {
      return "fas fa-file-pdf text-red-600";
    } else if (fileType.includes("word")) {
      return "fas fa-file-word text-blue-600";
    }
    return "fas fa-file text-gray-600";
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                  <FileText className="text-white h-5 w-5" />
                </div>
                <span className="text-xl font-bold text-slate-900">ContractAnalyzer</span>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-sm text-slate-600">Free analysis available</span>
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center">
                  <User className="h-4 w-4" />
                </div>
                <span className="text-sm font-medium text-slate-700">
                  {(user as any)?.firstName || (user as any)?.email || "User"}
                </span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.location.href = "/api/logout"}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Contract Analysis Dashboard</h1>
          <p className="text-slate-600">Upload your legal contracts for AI-powered analysis, risk detection, and clause summarization.</p>
        </div>

        {/* Upload Section */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Upload className="text-primary h-8 w-8" />
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">Upload Your Contract</h3>
              <p className="text-slate-600 mb-6">Support for PDF and DOCX files up to 10MB</p>
              
              <FileUpload 
                onUploadComplete={(contractId) => {
                  setLocation(`/analysis/${contractId}`);
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Recent Analyses */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-semibold text-slate-900">Recent Analyses</h3>
              <Button variant="ghost" size="sm">
                View All
              </Button>
            </div>
            
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg animate-pulse">
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-slate-200 rounded-lg"></div>
                      <div>
                        <div className="h-4 bg-slate-200 rounded w-32 mb-2"></div>
                        <div className="h-3 bg-slate-200 rounded w-48"></div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : contracts && Array.isArray(contracts) && contracts.length > 0 ? (
              <div className="space-y-4">
                {(contracts as any[]).map((contract: any) => (
                  <div 
                    key={contract.id}
                    className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors"
                    onClick={() => setLocation(`/analysis/${contract.id}`)}
                  >
                    <div className="flex items-center space-x-4">
                      <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center">
                        <FileText className="h-5 w-5 text-red-600" />
                      </div>
                      <div>
                        <h4 className="font-medium text-slate-900">{contract.originalName}</h4>
                        <p className="text-sm text-slate-600">
                          {contract.analysisStatus === "completed" 
                            ? `Analyzed ${new Date(contract.updatedAt).toLocaleDateString()}`
                            : `Status: ${contract.analysisStatus}`
                          }
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      {contract.overallRiskLevel && (
                        <Badge className={getRiskColor(contract.overallRiskLevel)}>
                          {contract.overallRiskLevel === "high" ? "High Risk" :
                           contract.overallRiskLevel === "medium" ? "Medium Risk" :
                           "Low Risk"}
                        </Badge>
                      )}
                      <BarChart3 className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-slate-900 mb-2">No contracts uploaded yet</h4>
                <p className="text-slate-600">Upload your first contract to get started with AI-powered analysis.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
