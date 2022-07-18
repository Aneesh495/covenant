import { z } from "zod";
import {
  IModelProvider,
  ModelPrompt,
  ModelResponse,
  ProviderType,
} from "./types";
import crypto from "crypto";

export interface LocalProviderConfig {
  baseUrl?: string;
  modelName?: string;
  timeoutMs?: number;
}

export class LocalModelProvider implements IModelProvider {
  readonly providerType: ProviderType = "local";
  readonly modelName: string;
  private baseUrl: string;
  private timeoutMs: number;

  constructor(config?: LocalProviderConfig) {
    this.baseUrl = config?.baseUrl || process.env.LOCAL_MODEL_URL || "http://127.0.0.1:8080/v1";
    this.modelName = config?.modelName || process.env.LOCAL_MODEL_NAME || "llama-3-8b-instruct";
    this.timeoutMs = config?.timeoutMs || 30000;
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 2000);

      const healthUrl = this.baseUrl.replace(/\/v1\/?$/, "") + "/health";
      const res = await fetch(healthUrl, { signal: controller.signal });
      clearTimeout(timer);
      return res.ok;
    } catch {
      return false;
    }
  }

  async generateText(prompt: ModelPrompt): Promise<ModelResponse> {
    const startTime = Date.now();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.modelName,
          messages,
          temperature: prompt.temperature ?? 0.1,
          max_tokens: prompt.maxTokens ?? 2048,
          response_format: prompt.responseFormat === "json" ? { type: "json_object" } : undefined,
        }),
        signal: controller.signal,
      });

      clearTimeout(timer);

      if (!res.ok) {
        throw new Error(`Local model HTTP error: ${res.status} ${res.statusText}`);
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
          // Keep undefined if not valid JSON
        }
      }

      return {
        text,
        parsedJson,
        usage,
        latencyMs,
        modelName: this.modelName,
        providerType: "local",
        fingerprint,
      };
    } catch (err) {
      clearTimeout(timer);
      throw new Error(`LocalModelProvider failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  async generateStructured<T>(
    prompt: ModelPrompt,
    schema: z.ZodType<T>
  ): Promise<{ data: T; response: ModelResponse }> {
    const jsonPrompt: ModelPrompt = {
      ...prompt,
      responseFormat: "json",
      systemPrompt: (prompt.systemPrompt || "") + "\nYou must reply with valid JSON only.",
    };

    const response = await this.generateText(jsonPrompt);

    if (!response.parsedJson) {
      throw new Error("Local model did not return valid JSON output.");
    }

    const parseResult = schema.safeParse(response.parsedJson);
    if (!parseResult.success) {
      throw new Error(`Local model output failed schema validation: ${parseResult.error.message}`);
    }

    return { data: parseResult.data, response };
  }
}
