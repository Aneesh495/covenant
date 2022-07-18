import { z } from "zod";
import {
  IModelProvider,
  ModelPrompt,
  ModelResponse,
  ProviderType,
} from "./types";
import crypto from "crypto";

export interface RecordedFixtureEntry {
  promptFingerprint: string;
  userPromptSubstring: string;
  response: ModelResponse;
}

export class RecordedReplayProvider implements IModelProvider {
  readonly providerType: ProviderType = "recorded";
  readonly modelName: string;
  private fixtures = new Map<string, ModelResponse>();
  private fallbackProvider?: IModelProvider;

  constructor(fixtures?: Record<string, ModelResponse>, fallbackProvider?: IModelProvider) {
    this.modelName = "recorded-replay-v1";
    this.fallbackProvider = fallbackProvider;

    if (fixtures) {
      for (const [key, val] of Object.entries(fixtures)) {
        this.fixtures.set(key, val);
      }
    }
  }

  async isAvailable(): Promise<boolean> {
    return true;
  }

  registerFixture(userPrompt: string, response: ModelResponse): void {
    const hash = this.computeHash(userPrompt);
    this.fixtures.set(hash, response);
  }

  getRegisteredCount(): number {
    return this.fixtures.size;
  }

  async generateText(prompt: ModelPrompt): Promise<ModelResponse> {
    const hash = this.computeHash(prompt.userPrompt);
    const recorded = this.fixtures.get(hash);

    if (recorded) {
      return {
        ...recorded,
        latencyMs: 1, // instantaneous replay
      };
    }

    // Try substring matching if exact hash misses
    for (const [key, fixture] of Array.from(this.fixtures.entries())) {
      if (prompt.userPrompt.includes(fixture.text.slice(0, 40))) {
        return fixture;
      }
    }

    if (this.fallbackProvider) {
      return this.fallbackProvider.generateText(prompt);
    }

    throw new Error(
      `RecordedReplayProvider: No recorded fixture found for prompt hash '${hash}'.`
    );
  }

  async generateStructured<T>(
    prompt: ModelPrompt,
    schema: z.ZodType<T>
  ): Promise<{ data: T; response: ModelResponse }> {
    const response = await this.generateText(prompt);

    if (!response.parsedJson) {
      throw new Error("Recorded replay response contains no parsedJson.");
    }

    const parseResult = schema.safeParse(response.parsedJson);
    if (!parseResult.success) {
      throw new Error(`Recorded replay failed schema validation: ${parseResult.error.message}`);
    }

    return { data: parseResult.data, response };
  }

  private computeHash(text: string): string {
    const normalized = text.replace(/\s+/g, " ").trim().toLowerCase();
    return crypto.createHash("sha256").update(normalized).digest("hex");
  }
}
