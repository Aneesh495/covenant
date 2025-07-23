import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Download, Share, FileText, User, ZoomIn, ZoomOut } from "lucide-react";
import { ContractViewer } from "@/components/contract-viewer";
import { AnalysisSidebar } from "@/components/analysis-sidebar";

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: analysisData, isLoading } = useQuery({
    queryKey: ["/api/contracts", id],
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Loading Analysis</h3>
          <p className="text-slate-600">Please wait while we load your contract analysis...</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Analysis Not Found</h3>
          <p className="text-slate-600 mb-4">The contract analysis you're looking for doesn't exist.</p>
          <Button onClick={() => setLocation("/")}>
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  const { contract, clauses, summary } = analysisData as any;

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
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLocation("/")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{contract.originalName}</h1>
              <p className="text-slate-600">
                Analyzed on {new Date(contract.updatedAt).toLocaleDateString()} • 
                {clauses?.length || 0} clauses identified
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export Report
            </Button>
            <Button size="sm">
              <Share className="h-4 w-4 mr-2" />
              Share Analysis
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Document Viewer */}
          <div className="lg:col-span-2">
            <ContractViewer 
              contract={contract}
              clauses={clauses || []}
            />
          </div>

          {/* Sidebar - Analysis Results */}
          <div className="lg:col-span-1">
            <AnalysisSidebar 
              summary={summary}
              clauses={clauses || []}
              contract={contract}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
