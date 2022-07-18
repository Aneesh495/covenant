import { z } from "zod";
import { DocumentIR } from "@covenant/document-ir";
import { GroundedFinding, GroundedCitation } from "@covenant/shared";

export type ProviderType = "local" | "hosted" | "recorded" | "deterministic";

export interface ModelPrompt {
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "text" | "json";
}

export interface ModelUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelResponse {
  text: string;
  parsedJson?: unknown;
  usage: ModelUsage;
  latencyMs: number;
  modelName: string;
  providerType: ProviderType;
  fingerprint: string;
}

export interface IModelProvider {
  readonly providerType: ProviderType;
  readonly modelName: string;

  isAvailable(): Promise<boolean>;

  generateText(prompt: ModelPrompt): Promise<ModelResponse>;

  generateStructured<T>(
    prompt: ModelPrompt,
    schema: z.ZodType<T>
  ): Promise<{ data: T; response: ModelResponse }>;
}

export interface EvidenceVerificationResult {
  isGrounded: boolean;
  startOffset?: number;
  endOffset?: number;
  exactQuote: string;
  confidence: number;
  rejectionReason?: string;
}

export interface ProposedFinding {
  title: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  explanation: string;
  suggestedAction?: string;
  proposedQuote?: string;
}
