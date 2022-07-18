import { z } from "zod";
import {
  IModelProvider,
  ModelPrompt,
  ModelResponse,
  ProviderType,
} from "./types";
import crypto from "crypto";

export interface HostedProviderConfig {
  apiKey?: string;
  baseUrl?: string;
  modelName?: string;
  maxRetries?: number;
  timeoutMs?: number;
}

export class HostedModelProvider implements IModelProvider {
  readonly providerType: ProviderType = "hosted";
  readonly modelName: string;
  private apiKey: string;
  private baseUrl: string;
  private maxRetries: number;
  private timeoutMs: number;

  constructor(config?: HostedProviderConfig) {
    this.apiKey = config?.apiKey || process.env.OPENAI_API_KEY || "";
    this.baseUrl = config?.baseUrl || process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
    this.modelName = config?.modelName || process.env.OPENAI_MODEL_NAME || "gpt-4o";
    this.maxRetries = config?.maxRetries ?? 3;
    this.timeoutMs = config?.timeoutMs ?? 30000;
  }

  async isAvailable(): Promise<boolean> {
    return Boolean(this.apiKey && this.apiKey.length > 5);
  }

  async generateText(prompt: ModelPrompt): Promise<ModelResponse> {
    if (!this.apiKey) {
      throw new Error("HostedModelProvider requires an API key (OPENAI_API_KEY).");
    }

    const startTime = Date.now();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      if (attempt > 0) {
        const backoffMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        await new Promise((resolve) => setTimeout(resolve, backoffMs));
      }

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      try {
        const messages = [];
        if (prompt.systemPrompt) {
          messages.push({ role: "system", content: prompt.systemPrompt });
        }
        messages.push({ role: "user", content: prompt.userPrompt });

        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.modelName,
            messages,
            temperature: prompt.temperature ?? 0.2,
            max_tokens: prompt.maxTokens ?? 2048,
            response_format: prompt.responseFormat === "json" ? { type: "json_object" } : undefined,
          }),
          signal: controller.signal,
        });

        clearTimeout(timer);

        if (res.status === 429 || res.status >= 500) {
          throw new Error(`Hosted model error status ${res.status}: ${res.statusText}`);
        }

        if (!res.ok) {
          const errBody = await res.text();
          throw new Error(`Hosted model request failed (${res.status}): ${errBody}`);
        }

        const json = await res.json() as any;
        const text = json.choices?.[0]?.message?.content || "";
        const usage = {
          promptTokens: json.usage?.prompt_tokens || 0,
          completionTokens: json.usage?.completion_tokens || 0,
          totalTokens: json.usage?.total_tokens || 0,
        };

        const latencyMs = Date.now() - startTime;
        const fingerprint = crypto.createHash("sha256").update(this.modelName + prompt.userPrompt).digest("hex");

        let parsedJson: unknown = undefined;
        if (prompt.responseFormat === "json" || text.trim().startsWith("{") || text.trim().startsWith("[")) {
          try {
            parsedJson = JSON.parse(text);
          } catch {
            // Keep undefined
          }
        }

        return {
          text,
          parsedJson,
          usage,
          latencyMs,
          modelName: this.modelName,
          providerType: "hosted",
          fingerprint,
        };
      } catch (err) {
        clearTimeout(timer);
        lastError = err instanceof Error ? err : new Error(String(err));
      }
    }

    throw new Error(`HostedModelProvider failed after ${this.maxRetries} retries: ${lastError?.message}`);
  }

  async generateStructured<T>(
    prompt: ModelPrompt,
    schema: z.ZodType<T>
  ): Promise<{ data: T; response: ModelResponse }> {
    const jsonPrompt: ModelPrompt = {
      ...prompt,
      responseFormat: "json",
      systemPrompt: (prompt.systemPrompt || "") + "\nRespond with valid JSON.",
    };

    const response = await this.generateText(jsonPrompt);

    if (!response.parsedJson) {
      throw new Error("Hosted model did not produce valid JSON.");
    }

    const parseResult = schema.safeParse(response.parsedJson);
    if (!parseResult.success) {
      throw new Error(`Hosted model output failed schema validation: ${parseResult.error.message}`);
    }

    return { data: parseResult.data, response };
  }
}
