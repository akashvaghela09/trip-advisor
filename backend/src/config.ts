import dotenv from "dotenv";

// Load env regardless of where the process starts from: backend/.env (when run
// from the repo root via `npm start`), ./.env (when run from the backend dir),
// then the repo root .env as a fallback.
dotenv.config({ path: ["backend/.env", ".env", "../.env"] });

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export const config = {
  port: num("PORT", 3001),

  // Which provider to use: "gemini" | "openai".
  llmProvider: (process.env.LLM_PROVIDER ?? "gemini") as "gemini" | "openai",

  // Gemini provider
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-2.0-flash",

  // OpenAI-compatible provider (OpenAI / xAI Grok / Groq / Ollama / LM Studio)
  openaiApiKey: process.env.OPENAI_API_KEY ?? "",
  openaiBaseUrl: process.env.OPENAI_BASE_URL ?? "", // empty → api.openai.com
  openaiModel: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
  // How to request JSON from an OpenAI-compatible endpoint:
  //   "json_object" - OpenAI / Grok / Groq
  //   "json_schema" - LM Studio, newer OpenAI (grammar-constrained, best for local)
  //   "off"         - rely on prompting only
  openaiJsonFormat: (process.env.OPENAI_JSON_FORMAT ?? "json_object") as
    | "json_object"
    | "json_schema"
    | "off",

  // Postgres connection string
  databaseUrl: process.env.DATABASE_URL ?? "",
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  llmTimeoutMs: num("LLM_TIMEOUT_MS", 25000),
  llmMaxRetries: num("LLM_MAX_RETRIES", 2),
  runMaxMs: num("RUN_MAX_MS", 90000),
} as const;

/** Throws a clear error if Gemini is selected but no key is configured. */
export function assertGeminiConfigured(): void {
  if (!config.geminiApiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.example to .env and add your key.",
    );
  }
}

/** Throws if the openai provider has neither a key nor a base URL. */
export function assertOpenAiConfigured(): void {
  if (!config.openaiApiKey && !config.openaiBaseUrl) {
    throw new Error(
      "For LLM_PROVIDER=openai set OPENAI_API_KEY (hosted) or OPENAI_BASE_URL (local server).",
    );
  }
}
