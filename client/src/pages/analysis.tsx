import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText, GitCompare, Sparkles, Eye, ShieldCheck } from "lucide-react";
import { ContractViewer, CitationHighlight } from "@/components/contract-viewer";
import { AnalysisSidebar } from "@/components/analysis-sidebar";
import { ResumeWorkbench } from "@/components/resume-workbench";
import { VersionComparisonModal } from "@/components/version-comparison-modal";

export default function Analysis() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [selectedFindingId, setSelectedFindingId] = useState<string | undefined>(undefined);
  const [selectedCitationId, setSelectedCitationId] = useState<string | undefined>(undefined);
  const [showComparisonModal, setShowComparisonModal] = useState<boolean>(false);
  const [resumeViewMode, setResumeViewMode] = useState<"workbench" | "viewer">("workbench");

  const { data: analysisData, isLoading, refetch } = useQuery({
    queryKey: ["/api/documents", id],
    queryFn: async () => {
      const res = await fetch(`/api/documents/${id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analysis");
      return res.json();
    },
    enabled: !!id,
  });

  const handleDecisionChange = async (
    findingId: string,
    decisionState: "accepted" | "rejected" | "pending"
  ) => {
    const res = await fetch(`/api/findings/${findingId}/decision`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ decisionState }),
    });

    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["/api/documents", id] });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Loading document intelligence</h3>
          <p className="text-slate-600 text-sm">Parsing DocumentIR, retrieving evidence, and evaluating policies.</p>
        </div>
      </div>
    );
  }

  if (!analysisData?.document) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">Analysis not found</h3>
          <p className="text-slate-600 mb-4 text-sm">This document is missing or belongs to another workspace.</p>
          <Button onClick={() => setLocation("/")}>Back to dashboard</Button>
        </div>
      </div>
    );
  }

  const document = analysisData.document;
  const version = analysisData.latestVersion;
  const documentIr = version?.documentIr;
  const canonicalText = documentIr?.canonicalText || "";
  const findings = analysisData.findings || [];
  const summary = analysisData.summary || {};
  const isResume = document.documentType === "resume";

  // Flatten all citations across findings for DocumentIR viewer highlighting
  const allCitations: CitationHighlight[] = findings.flatMap((f: any) =>
    (f.citations || []).map((c: any) => ({
      id: c.id,
      findingId: f.id,
      startOffset: c.start_offset ?? c.canonical_start ?? c.startOffset ?? 0,
      endOffset: c.end_offset ?? c.canonical_end ?? c.endOffset ?? 0,
      exactQuote: c.exact_quote ?? c.exactQuote ?? "",
      pageNumber: c.page_number ?? c.pageNumber ?? 1,
      confidence: c.confidence ? Number(c.confidence) : 1.0,
      severity: f.severity,
    }))
  );

  const handleSelectCitation = (citation: any) => {
    setSelectedCitationId(citation.id);
    if (citation.findingId) {
      setSelectedFindingId(citation.findingId);
    }
  };

  const handleSelectFinding = (findingId: string) => {
    setSelectedFindingId(findingId);
    const finding = findings.find((f: any) => f.id === findingId);
    if (finding?.citations && finding.citations.length > 0) {
      setSelectedCitationId(finding.citations[0].id);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Top Navbar */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <FileText className="text-white h-5 w-5" />
              </div>
              <span className="text-xl font-bold tracking-tight text-slate-900">Covenant</span>
              <Badge variant="outline" className="text-xs bg-slate-50 uppercase tracking-wider font-mono">
                {document.documentType || "contract"} intelligence
              </Badge>
            </div>

            <div className="flex items-center space-x-3">
              {isResume ? (
                <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                  <Button
                    variant={resumeViewMode === "workbench" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs flex items-center gap-1.5"
                    onClick={() => setResumeViewMode("workbench")}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Intelligence Studio</span>
                  </Button>
                  <Button
                    variant={resumeViewMode === "viewer" ? "default" : "ghost"}
                    size="sm"
                    className="h-7 text-xs flex items-center gap-1.5"
                    onClick={() => setResumeViewMode("viewer")}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Source Viewer</span>
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs flex items-center gap-1.5 text-slate-700 hover:bg-slate-100"
                  onClick={() => setShowComparisonModal(true)}
                >
                  <GitCompare className="h-3.5 w-3.5 text-primary" />
                  <span>Compare Revision</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Title and metadata toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="text-slate-600">
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Dashboard
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-900">
                  {document.title || document.originalFilename}
                </h1>
                <Badge variant="secondary" className="text-xs capitalize font-normal">
                  {document.documentType}
                </Badge>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {findings.length} findings identified · Immutable DocumentIR verified
              </p>
            </div>
          </div>
        </div>

        {/* View Switching */}
        {isResume && resumeViewMode === "workbench" ? (
          <ResumeWorkbench
            documentTitle={document.title || document.originalFilename}
            summary={summary}
            canonicalText={canonicalText}
            findings={findings}
            onSelectCitation={handleSelectCitation}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Interactive Source Document Viewer with Exact Highlight Spans */}
            <div className="lg:col-span-2">
              <ContractViewer
                documentTitle={document.title || document.originalFilename}
                canonicalText={canonicalText}
                citations={allCitations}
                selectedCitationId={selectedCitationId}
                onSelectCitation={handleSelectCitation}
                documentIr={documentIr}
                sha256={version?.sha256}
                pageCount={version?.pageCount}
              />
            </div>

            {/* Right 1 Col: Policy Findings Sidebar with Redlines and Triage Buttons */}
            <div className="lg:col-span-1">
              <AnalysisSidebar
                findings={findings}
                selectedFindingId={selectedFindingId}
                onSelectFinding={handleSelectFinding}
                onSelectCitation={handleSelectCitation}
                onDecisionChange={handleDecisionChange}
                documentType={document.documentType}
              />
            </div>
          </div>
        )}
      </div>

      {/* Semantic Revision Comparison Modal */}
      <VersionComparisonModal
        currentDocumentId={document.id}
        currentDocumentTitle={document.title || document.originalFilename}
        isOpen={showComparisonModal}
        onClose={() => setShowComparisonModal(false)}
      />
    </div>
  );
}
