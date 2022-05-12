import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, 
  Upload, 
  User, 
  BarChart3, 
  FileCheck, 
  Clock, 
  AlertTriangle,
  CheckCircle,
  FileDown,
  Settings,
  Brain,
  Briefcase
} from "lucide-react";
import { useLocation, Link } from "wouter";

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<"contract" | "resume">("contract");

  const { data: documents, isLoading } = useQuery({
    queryKey: ["/api/documents"],
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { file: File; documentType: string }) => {
      const formData = new FormData();
      formData.append("document", data.file);
      formData.append("documentType", data.documentType);

      const response = await fetch("/api/documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Upload Successful",
        description: `Your ${documentType} has been uploaded and analysis is starting.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      setUploadingFile(null);
    },
    onError: (error) => {
      toast({
        title: "Upload Failed",
        description: error.message,
        variant: "destructive",
      });
      setUploadingFile(null);
    },
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setUploadingFile(file);
      uploadMutation.mutate({ file, documentType });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100";
      case "processing":
      case "analyzing":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100";
      case "failed":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case "high":
        return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100";
      case "medium":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100";
      case "low":
        return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const contracts = Array.isArray(documents) ? documents.filter((doc: any) => doc.documentType === "contract") : [];
  const resumes = Array.isArray(documents) ? documents.filter((doc: any) => doc.documentType === "resume") : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-purple-900">
      {/* Header */}
      <div className="border-b bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm sticky top-0 z-40">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Brain className="text-white h-6 w-6" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                    AI Document Analyzer
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Analyze contracts and resumes with AI
                  </p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link href="/profile">
                <Button variant="outline" size="sm">
                  <Settings className="h-4 w-4 mr-2" />
                  Profile
                </Button>
              </Link>
              <ThemeToggle />
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Welcome Section */}
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Welcome to AI Document Analysis
          </h2>
          <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Upload your legal contracts or resumes to get instant AI-powered analysis, 
            risk assessment, and actionable insights. No registration required.
          </p>
        </div>

        {/* Upload Section */}
        <Card className="mb-8 shadow-lg border-0 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">Upload Document</CardTitle>
            <CardDescription>
              Choose a PDF or Word document to analyze (contracts or resumes)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Document Type Selection */}
            <div className="flex justify-center space-x-4 mb-6">
              <Button
                variant={documentType === "contract" ? "default" : "outline"}
                onClick={() => setDocumentType("contract")}
                className="flex items-center space-x-2"
              >
                <FileText className="h-4 w-4" />
                <span>Legal Contract</span>
              </Button>
              <Button
                variant={documentType === "resume" ? "default" : "outline"}
                onClick={() => setDocumentType("resume")}
                className="flex items-center space-x-2"
              >
                <Briefcase className="h-4 w-4" />
                <span>Resume/CV</span>
              </Button>
            </div>

            {/* File Upload */}
            <div className="flex flex-col items-center space-y-4">
              <div className="w-full max-w-md">
                <Label htmlFor="file-upload" className="cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                    <Upload className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                    <p className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Upload {documentType === "contract" ? "Contract" : "Resume"}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Drag and drop or click to select (PDF, DOCX)
                    </p>
                  </div>
                </Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={handleFileUpload}
                  disabled={uploadMutation.isPending}
                />
              </div>
              
              {uploadingFile && (
                <div className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                  <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                  <span>Uploading {uploadingFile.name}...</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Documents Tabs */}
        <Tabs defaultValue="contracts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto">
            <TabsTrigger value="contracts" className="flex items-center space-x-2">
              <FileText className="h-4 w-4" />
              <span>Contracts ({contracts.length})</span>
            </TabsTrigger>
            <TabsTrigger value="resumes" className="flex items-center space-x-2">
              <Briefcase className="h-4 w-4" />
              <span>Resumes ({resumes.length})</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contracts">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                // Loading skeleton
                [...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                    </CardContent>
                  </Card>
                ))
              ) : contracts.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No contracts yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Upload your first contract to get started with AI analysis
                  </p>
                </div>
              ) : (
                contracts.map((contract: any) => (
                  <Card key={contract.id} className="hover:shadow-lg transition-shadow cursor-pointer group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm" onClick={() => setLocation(`/analysis/${contract.id}`)}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {contract.originalName}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {new Date(contract.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(contract.analysisStatus)}>
                          {contract.analysisStatus === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {contract.analysisStatus === "processing" && <Clock className="h-3 w-3 mr-1" />}
                          {contract.analysisStatus === "failed" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {contract.analysisStatus}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {contract.overallRiskLevel && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Risk Level:</span>
                            <Badge className={getRiskColor(contract.overallRiskLevel)}>
                              {contract.overallRiskLevel.toUpperCase()}
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>Size: {(contract.fileSize / 1024).toFixed(1)} KB</span>
                          <span>Type: {contract.fileType.includes("pdf") ? "PDF" : "Word"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>

          <TabsContent value="resumes">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                // Loading skeleton
                [...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded" />
                    </CardContent>
                  </Card>
                ))
              ) : resumes.length === 0 ? (
                <div className="col-span-full text-center py-12">
                  <Briefcase className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    No resumes yet
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Upload your first resume to get AI-powered feedback and improvement suggestions
                  </p>
                </div>
              ) : (
                resumes.map((resume: any) => (
                  <Card key={resume.id} className="hover:shadow-lg transition-shadow cursor-pointer group bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm" onClick={() => setLocation(`/analysis/${resume.id}`)}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <CardTitle className="text-lg truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {resume.originalName}
                          </CardTitle>
                          <CardDescription className="text-sm">
                            {new Date(resume.createdAt).toLocaleDateString()}
                          </CardDescription>
                        </div>
                        <Badge className={getStatusColor(resume.analysisStatus)}>
                          {resume.analysisStatus === "completed" && <CheckCircle className="h-3 w-3 mr-1" />}
                          {resume.analysisStatus === "processing" && <Clock className="h-3 w-3 mr-1" />}
                          {resume.analysisStatus === "failed" && <AlertTriangle className="h-3 w-3 mr-1" />}
                          {resume.analysisStatus}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {resume.overallScore && (
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600 dark:text-gray-400">Score:</span>
                            <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100">
                              {resume.overallScore}/10
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-center justify-between text-sm text-gray-600 dark:text-gray-400">
                          <span>Size: {(resume.fileSize / 1024).toFixed(1)} KB</span>
                          <span>Type: {resume.fileType.includes("pdf") ? "PDF" : "Word"}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Features Section */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="text-center p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <Brain className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">AI-Powered Analysis</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Advanced OpenAI GPT-4 technology analyzes your documents with expert-level precision.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-teal-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <FileCheck className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Instant Results</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Get detailed analysis results within seconds, including risk assessments and recommendations.
              </p>
            </CardContent>
          </Card>

          <Card className="text-center p-6 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="h-6 w-6 text-white" />
              </div>
              <h3 className="text-lg font-semibold mb-2">100% Free</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                No subscriptions, no hidden fees. Analyze unlimited documents completely free.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}