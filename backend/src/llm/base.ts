import { z } from "zod";
import { config } from "../config.js";
import {
  LLMError,
  RateLimitError,
  type LLMProvider,
  type GenerateStructuredOptions,
  type GenerateTextOptions,
} from "./provider.js";
import { parseProviderError } from "./errors.js";
import { stripFences, withTimeout, sleep } from "./util.js";

/** Args every concrete provider's single streaming call receives. */
export interface StreamArgs {
  system: string;
  user: string;
  json: boolean;
  temperature: number;
  signal: AbortSignal;
  onToken?: (delta: string) => void;
  /** JSON Schema object (for providers that support schema-constrained output). */
  jsonSchema?: unknown;
  schemaName?: string;
}

/**
 * Shared provider logic: timeout, bounded retries, JSON-schema prompting +
 * zod validation, and rate-limit detection. A concrete provider only has to
 * implement `streamCompletion` for its API.
 */
export abstract class BaseLLMProvider implements LLMProvider {
  /** One streaming generation against the provider; accumulates + returns text. */
  protected abstract streamCompletion(args: StreamArgs): Promise<string>;

  private async callOnce(args: Omit<StreamArgs, "signal">): Promise<string> {
    const controller = new AbortController();
    return withTimeout(
      this.streamCompletion({ ...args, signal: controller.signal }),
      config.llmTimeoutMs,
      () => controller.abort(),
    );
  }

  async generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<T> {
    const maxRetries = opts.maxRetries ?? config.llmMaxRetries;

    let schemaObj: unknown;
    let jsonSchema: string;
    try {
      schemaObj = z.toJSONSchema(opts.schema);
      jsonSchema = JSON.stringify(schemaObj);
    } catch {
      schemaObj = undefined;
      jsonSchema = "(schema unavailable; infer the shape from the instructions)";
    }

    let repair = "";
    let lastError: unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const system = `${opts.system}\n\nReturn ONLY a JSON object conforming to this JSON Schema (no prose, no code fences):\n${jsonSchema}${repair}`;
      try {
        const raw = await this.callOnce({
          system,
          user: opts.user,
          json: true,
          temperature: opts.temperature ?? 0.6,
          jsonSchema: schemaObj,
          schemaName: opts.schemaName,
        });
        const parsed = JSON.parse(stripFences(raw));
        return opts.schema.parse(parsed);
      } catch (err) {
        lastError = err;
        const info = parseProviderError(err);
        console.error(
          `[llm] ${opts.schemaName} attempt ${attempt} failed:`,
          info.clean,
        );
        if (info.isRateLimit) {
          throw new RateLimitError(info.clean, info.retryAfterSec, err);
        }
        repair = `\n\nYour previous reply was rejected: ${info.clean}\nRespond again with corrected JSON only.`;
        if (attempt < maxRetries) {
          opts.onRetry?.(attempt, info.clean);
          await sleep(300 * (attempt + 1));
        }
      }
    }
    const info = parseProviderError(lastError);
    throw new LLMError(`${opts.schemaName}: ${info.clean}`, lastError);
  }

  async generateText(opts: GenerateTextOptions): Promise<string> {
    let lastError: unknown;
    for (let attempt = 0; attempt <= config.llmMaxRetries; attempt++) {
      try {
        return await this.callOnce({
          system: opts.system,
          user: opts.user,
          json: false,
          temperature: opts.temperature ?? 0.5,
          onToken: opts.onToken,
        });
      } catch (err) {
        lastError = err;
        const info = parseProviderError(err);
        if (info.isRateLimit) {
          throw new RateLimitError(info.clean, info.retryAfterSec, err);
        }
        if (attempt < config.llmMaxRetries) await sleep(300 * (attempt + 1));
      }
    }
    const info = parseProviderError(lastError);
    throw new LLMError(`Text generation failed: ${info.clean}`, lastError);
  }
}
