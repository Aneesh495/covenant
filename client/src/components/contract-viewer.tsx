import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, ZoomIn, ZoomOut } from "lucide-react";
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

  // Sample contract text with clause highlighting
  const renderContractContent = () => {
    return (
      <div className="prose max-w-none">
        <h4 className="text-lg font-semibold mb-4">SOFTWARE LICENSE AGREEMENT</h4>
        
        <p className="mb-4 text-slate-700">
          This Software License Agreement ("Agreement") is entered into on December 1, 2024, 
          between TechCorp Inc. ("Licensor") and Customer ("Licensee").
        </p>
        
        {/* Sample clauses with highlighting */}
        <div className={cn("p-4 mb-4 rounded-r-lg", getClauseHighlightClass("high"))}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-slate-800">
                <strong>Section 8. LIMITATION OF LIABILITY:</strong> IN NO EVENT SHALL LICENSOR BE LIABLE 
                FOR ANY INDIRECT, INCIDENTAL, SPECIAL, PUNITIVE, OR CONSEQUENTIAL DAMAGES, INCLUDING BUT 
                NOT LIMITED TO LOSS OF PROFITS, DATA, OR USE, REGARDLESS OF WHETHER LICENSOR HAS BEEN 
                ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
              </p>
            </div>
            <Badge className={getRiskBadgeClass("high")}>High Risk</Badge>
          </div>
        </div>
        
        <div className={cn("p-4 mb-4 rounded-r-lg", getClauseHighlightClass("medium"))}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-slate-800">
                <strong>Section 12. AUTOMATIC RENEWAL:</strong> This Agreement shall automatically renew 
                for successive one-year periods unless either party provides written notice of non-renewal 
                at least 60 days prior to the expiration of the then-current term.
              </p>
            </div>
            <Badge className={getRiskBadgeClass("medium")}>Medium Risk</Badge>
          </div>
        </div>
        
        <p className="mb-4 text-slate-700">
          <strong>Section 2. GRANT OF LICENSE:</strong> Subject to the terms and conditions of this Agreement, 
          Licensor hereby grants to Licensee a non-exclusive, non-transferable license to use the Software 
          solely for Licensee's internal business purposes.
        </p>
        
        <div className={cn("p-4 mb-4 rounded-r-lg", getClauseHighlightClass("low"))}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <p className="text-slate-800">
                <strong>Section 15. CONFIDENTIALITY:</strong> Each party acknowledges that it may have access 
                to certain confidential information of the other party. Each party agrees to maintain the 
                confidentiality of such information and not to disclose it to third parties.
              </p>
            </div>
            <Badge className={getRiskBadgeClass("low")}>Standard</Badge>
          </div>
        </div>
        
        <p className="text-slate-700">
          <strong>Section 18. GOVERNING LAW:</strong> This Agreement shall be governed by and construed in 
          accordance with the laws of the State of California, without regard to its conflict of law provisions.
        </p>
        
        <p className="text-slate-700">
          <strong>Section 20. ENTIRE AGREEMENT:</strong> This Agreement constitutes the entire agreement 
          between the parties and supersedes all prior and contemporaneous agreements, representations, 
          and understandings.
        </p>
      </div>
    );
  };

  return (
    <Card>
      {/* Document Header */}
      <div className="p-6 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900">{contract.originalName}</h3>
              <p className="text-sm text-slate-600">
                {(contract.fileSize / 1024).toFixed(0)} KB • {contract.fileType.includes("pdf") ? "PDF" : "DOCX"}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="ghost" size="sm">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="text-sm text-slate-600">100%</span>
            <Button variant="ghost" size="sm">
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Document Content */}
      <CardContent className="p-6 max-h-96 overflow-y-auto">
        {contract.analysisStatus === "completed" ? (
          renderContractContent()
        ) : contract.analysisStatus === "processing" ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <div className="w-6 h-6 border-2 border-primary/20 border-t-primary rounded-full animate-spin"></div>
            </div>
            <h4 className="text-lg font-medium text-slate-900 mb-2">Analysis in Progress</h4>
            <p className="text-slate-600">Your contract is being analyzed. This usually takes 30-60 seconds.</p>
          </div>
        ) : contract.analysisStatus === "failed" ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-red-600" />
            </div>
            <h4 className="text-lg font-medium text-slate-900 mb-2">Analysis Failed</h4>
            <p className="text-slate-600">There was an error analyzing your contract. Please try uploading again.</p>
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="h-6 w-6 text-slate-400" />
            </div>
            <h4 className="text-lg font-medium text-slate-900 mb-2">Ready for Analysis</h4>
            <p className="text-slate-600">Your contract has been uploaded and is ready for analysis.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
