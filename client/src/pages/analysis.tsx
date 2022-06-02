import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";
import { ContractViewer } from "@/components/contract-viewer";
import { AnalysisSidebar } from "@/components/analysis-sidebar";

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: analysisData, isLoading } = useQuery({
    queryKey: ["/api/documents", id],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analysis");
      return res.json();
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Loading analysis</h3>
          <p className="text-slate-600">Fetching document and model results.</p>
        </div>
      </div>
    );
  }

  if (!analysisData?.document) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Analysis not found</h3>
          <p className="text-slate-600 mb-4">This document is missing or belongs to another session.</p>
          <Button onClick={() => setLocation("/")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const contract = analysisData.document;
  const clauses = analysisData.items || [];
  const summary = analysisData.summary;

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="text-white h-5 w-5" />
              </div>
              <span className="text-xl font-bold text-slate-900">Covenant</span>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{contract.originalName}</h1>
              <p className="text-slate-600">
                {contract.updatedAt
                  ? `Updated ${new Date(contract.updatedAt).toLocaleDateString()} · `
                  : ""}
                {clauses.length} findings
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <ContractViewer contract={contract} clauses={clauses} />
          </div>
          <div className="lg:col-span-1">
            <AnalysisSidebar summary={summary} clauses={clauses} contract={contract} />
          </div>
        </div>
      </div>
    </div>
  );
}
