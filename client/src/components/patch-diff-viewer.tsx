import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export interface PatchDiffViewerProps {
  originalText: string;
  replacementText: string;
  explanation?: string;
}

export function PatchDiffViewer({ originalText, replacementText, explanation }: PatchDiffViewerProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(replacementText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Card className="border border-slate-200 bg-slate-50/70 overflow-hidden my-3">
      <div className="bg-slate-100/80 px-3 py-2 border-b border-slate-200 flex items-center justify-between text-xs font-semibold text-slate-700">
        <div className="flex items-center gap-2">
          <span>Suggested Redline Patch</span>
          <Badge variant="outline" className="text-[10px] bg-white font-mono">
            Policy Remediation
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs flex items-center gap-1 text-slate-600 hover:text-slate-900"
          onClick={handleCopy}
        >
          {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
          <span>{copied ? "Copied" : "Copy Replacement"}</span>
        </Button>
      </div>

      <CardContent className="p-3 space-y-2 text-xs">
        {explanation && <p className="text-slate-600 italic">{explanation}</p>}

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-red-700 flex items-center gap-1">
            <span>Original Text (To Replace):</span>
          </div>
          <div className="p-2 rounded bg-red-50/80 border border-red-200 text-red-900 font-mono text-[11px] line-through whitespace-pre-wrap">
            {originalText}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
            <span>Proposed Compliant Redline:</span>
          </div>
          <div className="p-2 rounded bg-emerald-50/80 border border-emerald-200 text-emerald-950 font-mono text-[11px] whitespace-pre-wrap">
            {replacementText}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
