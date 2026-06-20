import type { ZodType } from "zod";

/** Raised when the model call ultimately fails (after retries). */
export class LLMError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMError";
  }
}

/** Raised on a provider quota/rate-limit (HTTP 429). Not worth retrying inline. */
export class RateLimitError extends LLMError {
  constructor(
    message: string,
    public readonly retryAfterSec: number | null,
    cause?: unknown,
  ) {
    super(message, cause);
    this.name = "RateLimitError";
  }
}

export interface GenerateStructuredOptions<T> {
  system: string;
  user: string;
  schema: ZodType<T>;
  schemaName: string;
  temperature?: number;
  maxRetries?: number;
  /** Called before each retry after a failed attempt (0-based attempt index). */
  onRetry?: (attempt: number, message: string) => void;
}

export interface GenerateTextOptions {
  system: string;
  user: string;
  temperature?: number;
  /** Streams token deltas (used for the live synthesis summary). */
  onToken?: (delta: string) => void;
}

/** Provider-agnostic LLM interface; one implementation per backend. */
export interface LLMProvider {
  /** Generate JSON validated against a zod schema, with bounded repair retries. */
  generateStructured<T>(opts: GenerateStructuredOptions<T>): Promise<T>;
  /** Generate free-text (used for the synthesis summary). */
  generateText(opts: GenerateTextOptions): Promise<string>;
}
