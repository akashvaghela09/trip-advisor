export interface ParsedError {
  isRateLimit: boolean;
  retryAfterSec: number | null;
  clean: string;
}

/**
 * Normalises errors from any provider (Gemini's nested JSON, the OpenAI SDK's
 * APIError, local servers) into a human message + rate-limit info.
 */
export function parseProviderError(err: unknown): ParsedError {
  const anyErr = err as Record<string, unknown> | null;
  const raw = err instanceof Error ? err.message : String(err);

  let code: number | undefined =
    typeof anyErr?.status === "number" ? (anyErr.status as number) : undefined;
  let human = raw;
  let retryAfterSec: number | null = null;

  // OpenAI SDK exposes a Retry-After header on rate limits.
  const headers = anyErr?.headers as
    | Record<string, string>
    | { get?: (k: string) => string | null }
    | undefined;
  const headerRetry =
    headers && typeof (headers as { get?: unknown }).get === "function"
      ? (headers as { get: (k: string) => string | null }).get("retry-after")
      : (headers as Record<string, string> | undefined)?.["retry-after"];
  if (headerRetry) {
    const n = parseInt(String(headerRetry), 10);
    if (Number.isFinite(n)) retryAfterSec = n;
  }

  // Gemini packs details in a nested JSON string: {"error":{"message":"{...}","code":429}}
  try {
    const outer = JSON.parse(raw);
    code = (outer?.error?.code as number) ?? code;
    const inner = outer?.error?.message;
    if (typeof inner === "string") {
      human = inner;
      try {
        const innerObj = JSON.parse(inner);
        human = innerObj?.error?.message ?? inner;
        code = (innerObj?.error?.code as number) ?? code;
        const details: Array<Record<string, unknown>> =
          innerObj?.error?.details ?? [];
        const retryInfo = details.find((d) =>
          String(d["@type"] ?? "").includes("RetryInfo"),
        );
        const delay = retryInfo?.retryDelay;
        if (typeof delay === "string" && retryAfterSec == null) {
          retryAfterSec = Math.ceil(parseFloat(delay));
        }
      } catch {
        /* inner not JSON */
      }
    }
  } catch {
    /* raw not JSON */
  }

  const isRateLimit =
    code === 429 ||
    /RESOURCE_EXHAUSTED|quota|rate.?limit|too many requests/i.test(raw);

  let clean = human.split("\n")[0].trim();
  if (isRateLimit) {
    clean = retryAfterSec
      ? `Rate limit reached. Try again in ~${retryAfterSec}s.`
      : "Rate limit reached. Please wait a moment and retry.";
  } else if (clean.length > 200) {
    clean = clean.slice(0, 200) + "…";
  }

  return { isRateLimit, retryAfterSec, clean };
}
