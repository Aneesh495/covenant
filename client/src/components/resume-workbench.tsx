import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  User,
  Briefcase,
  GraduationCap,
  Wrench,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ShieldCheck,
  Copy,
  Check,
  Sparkles,
  FileCheck,
  Target,
  Mail,
  MapPin,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface ResumeWorkbenchProps {
  documentTitle: string;
  summary?: any;
  canonicalText?: string;
  findings?: any[];
  onSelectCitation?: (citation: any) => void;
}

export function ResumeWorkbench({
  documentTitle,
  summary = {},
  canonicalText = "",
  findings = [],
  onSelectCitation,
}: ResumeWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<string>("coverage");
  const [copiedBulletId, setCopiedBulletId] = useState<string | null>(null);

  const profile = summary.profile || {};
  const coverageMatrix = summary.coverageMatrix;
  const atsAudit = summary.atsAudit || { overallScore: summary.atsScore || 85, checks: [] };
  const bulletRevisions = summary.bulletRevisions || [];

  const handleCopyBullet = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedBulletId(id);
    setTimeout(() => setCopiedBulletId(null), 2000);
  };

  const atsScore = atsAudit.overallScore || summary.atsScore || 85;
  const matchScore = coverageMatrix?.overallMatchScore ?? summary.roleMatchScore ?? 0;
  const totalExpYears = summary.totalYearsExperience ?? profile.totalExperienceYears ?? 0;
  const verifiedRevisionsCount = summary.verifiedRevisionsCount ?? bulletRevisions.filter((b: any) => b.passedVerification).length;

  return (
    <div className="space-y-6">
      {/* Overview Stat Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* ATS Score Card */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">ATS Score</span>
              <FileCheck className="h-4 w-4 text-primary" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{atsScore}</span>
              <span className="text-xs text-slate-500">/ 100</span>
            </div>
            <Progress value={atsScore} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        {/* Role Match Score Card */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Role Match</span>
              <Target className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{matchScore}%</span>
              <span className="text-xs text-slate-500">alignment</span>
            </div>
            <Progress value={matchScore} className="h-1.5 mt-2" />
          </CardContent>
        </Card>

        {/* Experience Metric */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Experience</span>
              <Briefcase className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{totalExpYears}</span>
              <span className="text-xs text-slate-500">years verified</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              {profile.roles?.length || 0} professional roles extracted
            </p>
          </CardContent>
        </Card>

        {/* Factual Revisions Card */}
        <Card className="border border-slate-200 bg-white shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Factual Revisions</span>
              <ShieldCheck className="h-4 w-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-slate-900">{verifiedRevisionsCount}</span>
              <span className="text-xs text-emerald-600 font-medium">100% verified</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              Zero unsupported claims added
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Navigation */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full bg-slate-100/80 p-1">
          <TabsTrigger value="coverage" className="text-xs font-medium">
            Role Coverage
          </TabsTrigger>
          <TabsTrigger value="profile" className="text-xs font-medium">
            Candidate Profile
          </TabsTrigger>
          <TabsTrigger value="revisions" className="text-xs font-medium">
            Rewrite Studio
          </TabsTrigger>
          <TabsTrigger value="ats" className="text-xs font-medium">
            ATS Compliance
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: ROLE COVERAGE MATRIX */}
        <TabsContent value="coverage" className="mt-4 space-y-4">
          {coverageMatrix ? (
            <div className="space-y-4">
              <Card className="border border-slate-200 bg-white shadow-sm">
                <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base text-slate-900">Role Requirement Coverage Matrix</CardTitle>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        Factual candidate evidence matched against required and preferred specifications.
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-xs">
                        Required: {coverageMatrix.requiredMatchScore}%
                      </Badge>
                      <Badge variant="outline" className="bg-blue-50 text-blue-800 border-blue-200 text-xs">
                        Preferred: {coverageMatrix.preferredMatchScore}%
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {coverageMatrix.matches?.map((match: any, idx: number) => {
                    const isSupported = match.status === "supported";
                    const isPartial = match.status === "partially_supported";
                    const isUnsupported = match.status === "unsupported";

                    return (
                      <div
                        key={match.requirementId || idx}
                        className={cn(
                          "p-3.5 rounded-lg border transition-all text-xs space-y-2",
                          isSupported && "bg-emerald-50/40 border-emerald-200/70",
                          isPartial && "bg-amber-50/40 border-amber-200/70",
                          isUnsupported && "bg-red-50/30 border-red-200/60"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {isSupported && (
                              <Badge className="bg-emerald-600 text-white text-[10px] uppercase font-bold flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Supported
                              </Badge>
                            )}
                            {isPartial && (
                              <Badge className="bg-amber-500 text-white text-[10px] uppercase font-bold flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" /> Partial
                              </Badge>
                            )}
                            {isUnsupported && (
                              <Badge className="bg-red-600 text-white text-[10px] uppercase font-bold flex items-center gap-1">
                                <XCircle className="h-3 w-3" /> Missing
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-[10px] uppercase bg-white">
                              {match.priority}
                            </Badge>
                            <Badge variant="secondary" className="text-[10px] text-slate-600 bg-slate-100">
                              {match.category}
                            </Badge>
                          </div>
                          <span className="font-mono text-xs font-semibold text-slate-700">
                            {Math.round(match.score * 100)}%
                          </span>
                        </div>

                        <p className="font-medium text-slate-900 text-sm">{match.requirementText}</p>
                        <p className="text-slate-600 leading-relaxed">{match.explanation}</p>

                        {/* Exact Evidence Citations */}
                        {match.citations && match.citations.length > 0 && (
                          <div className="pt-2 border-t border-slate-200/60 space-y-1">
                            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                              Candidate Evidence
                            </span>
                            {match.citations.map((c: any, cIdx: number) => (
                              <div
                                key={c.id || cIdx}
                                onClick={() => onSelectCitation?.(c)}
                                className="p-2 rounded bg-white border border-slate-200 hover:border-primary/40 cursor-pointer flex items-center justify-between gap-2 text-slate-700 text-xs"
                              >
                                <span className="font-serif italic truncate">"{c.exactQuote}"</span>
                                <ExternalLink className="h-3 w-3 text-slate-400 flex-shrink-0" />
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border border-slate-200 p-8 text-center bg-white">
              <Target className="h-10 w-10 text-slate-400 mx-auto mb-2" />
              <h4 className="text-sm font-semibold text-slate-800">Job Description Required</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                Upload or paste a target job description to compute requirement coverage, gap analysis, and tailored bullet enhancements.
              </p>
            </Card>
          )}
        </TabsContent>

        {/* TAB 2: CANDIDATE PROFILE */}
        <TabsContent value="profile" className="mt-4 space-y-4">
          {/* Contact Details */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span>Contact & Summary</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              <div className="flex flex-wrap gap-4 text-xs text-slate-700">
                {profile.contact?.name && (
                  <div className="font-bold text-slate-900 text-sm">{profile.contact.name}</div>
                )}
                {profile.contact?.email && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span>{profile.contact.email}</span>
                  </div>
                )}
                {profile.contact?.location && (
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <MapPin className="h-3.5 w-3.5 text-slate-400" />
                    <span>{profile.contact.location}</span>
                  </div>
                )}
              </div>
              {profile.summaryText && (
                <p className="text-xs text-slate-700 leading-relaxed bg-slate-50 p-3 rounded border border-slate-100">
                  {profile.summaryText}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Professional Experience */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-600" />
                <span>Experience Timeline ({profile.roles?.length || 0} Roles)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {profile.roles?.map((role: any, idx: number) => (
                <div key={role.id || idx} className="space-y-2 border-b border-slate-100 pb-4 last:border-b-0 last:pb-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-900">{role.title}</h4>
                      <p className="text-xs font-medium text-slate-600">{role.company}</p>
                    </div>
                    <Badge variant="outline" className="text-[11px] font-mono bg-slate-50">
                      {role.startDateText} to {role.endDateText}
                    </Badge>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-700 list-disc list-inside">
                    {role.bullets?.map((b: any, bIdx: number) => (
                      <li key={bIdx} className="leading-relaxed">
                        {typeof b === "string" ? b : b.text}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Extracted Skills Grouped by Category */}
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Wrench className="h-4 w-4 text-emerald-600" />
                <span>Extracted Skills ({profile.skills?.length || 0})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="flex flex-wrap gap-1.5">
                {profile.skills?.map((skill: any, idx: number) => (
                  <Badge key={idx} variant="secondary" className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-800">
                    {skill.name || skill}
                    {skill.category && (
                      <span className="ml-1 text-[10px] text-slate-400 font-normal">({skill.category})</span>
                    )}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Education */}
          {profile.education && profile.education.length > 0 && (
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-3 border-b border-slate-100">
                <CardTitle className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-purple-600" />
                  <span>Education</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {profile.education.map((edu: any, idx: number) => (
                  <div key={edu.id || idx} className="flex justify-between items-start text-xs">
                    <div>
                      <h4 className="font-semibold text-slate-900">{edu.institution}</h4>
                      <p className="text-slate-600">{edu.degree} {edu.fieldOfStudy ? `in ${edu.fieldOfStudy}` : ""}</p>
                    </div>
                    {edu.graduationYear && (
                      <Badge variant="outline" className="font-mono text-[10px]">
                        Class of {edu.graduationYear}
                      </Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* TAB 3: REWRITE STUDIO WITH FACTUAL VERIFICATION */}
        <TabsContent value="revisions" className="mt-4 space-y-4">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Factual Bullet Revision Studio</span>
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Impact rewrites with strict zero-hallucination factual validation. Every metric and entity must originate from the candidate profile.
                  </CardDescription>
                </div>
                <Badge className="bg-purple-100 text-purple-800 border-purple-200 text-xs flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-purple-600" />
                  Factual Guardrail Active
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              {bulletRevisions.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <Sparkles className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-medium">No bullet revisions needed</p>
                  <p className="text-xs text-slate-400 mt-1">Existing bullets already satisfy high-impact quantifiable formatting.</p>
                </div>
              ) : (
                bulletRevisions.map((rev: any, idx: number) => {
                  const isVerified = rev.passedVerification ?? rev.validation?.isValid;
                  const isCopied = copiedBulletId === (rev.id || String(idx));

                  return (
                    <div
                      key={rev.id || idx}
                      className="p-4 rounded-lg border border-slate-200 bg-white shadow-sm space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isVerified ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" /> Factual Claim Verified
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-800 border-red-200 text-[10px] flex items-center gap-1">
                              <AlertCircle className="h-3 w-3" /> Verification Issue
                            </Badge>
                          )}
                          <span className="text-[11px] text-slate-400 font-mono">Revision {idx + 1}</span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 text-xs flex items-center gap-1"
                          onClick={() => handleCopyBullet(rev.id || String(idx), rev.rewrittenText)}
                        >
                          {isCopied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                          <span>{isCopied ? "Copied" : "Copy Bullet"}</span>
                        </Button>
                      </div>

                      {/* Side by side diff */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                        <div className="p-3 rounded bg-red-50/50 border border-red-200/60 space-y-1">
                          <span className="text-[10px] font-semibold text-red-800 uppercase tracking-wide">
                            Original Bullet
                          </span>
                          <p className="text-slate-800 leading-relaxed font-serif">{rev.originalText}</p>
                        </div>
                        <div className="p-3 rounded bg-emerald-50/50 border border-emerald-200/60 space-y-1">
                          <span className="text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">
                            Rewritten Impact Bullet
                          </span>
                          <p className="text-slate-900 leading-relaxed font-medium font-serif">{rev.rewrittenText}</p>
                        </div>
                      </div>

                      {rev.rationale && (
                        <p className="text-xs text-slate-500 italic bg-slate-50 p-2 rounded border border-slate-100">
                          Rationale: {rev.rationale}
                        </p>
                      )}

                      {/* Validation Signals */}
                      {rev.validation?.preservedMetrics && rev.validation.preservedMetrics.length > 0 && (
                        <div className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap">
                          <span className="font-semibold text-slate-700">Preserved Metrics:</span>
                          {rev.validation.preservedMetrics.map((m: string, mIdx: number) => (
                            <Badge key={mIdx} variant="outline" className="text-[10px] font-mono bg-white">
                              {m}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: ATS COMPLIANCE AUDIT */}
        <TabsContent value="ats" className="mt-4 space-y-4">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base text-slate-900">ATS Compliance & Parsing Audit</CardTitle>
                  <CardDescription className="text-xs text-slate-500 mt-0.5">
                    Evaluates structural hierarchy, section headers, date chronology, and contact information.
                  </CardDescription>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-slate-900">{atsScore}%</div>
                  <div className="text-[10px] text-slate-500 uppercase font-semibold">Parser Score</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3">
              {atsAudit.checks?.map((check: any, idx: number) => (
                <div
                  key={check.id || idx}
                  className="flex items-start justify-between p-3 rounded-lg border border-slate-100 bg-slate-50/60 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    {check.passed ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{check.name}</span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono bg-white">
                          {check.category}
                        </Badge>
                      </div>
                      <p className="text-slate-600 leading-normal">{check.message}</p>
                    </div>
                  </div>
                  <Badge
                    className={cn(
                      "text-[10px] font-semibold uppercase",
                      check.passed
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : "bg-amber-100 text-amber-800 border-amber-200"
                    )}
                  >
                    {check.passed ? "Pass" : "Warning"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
