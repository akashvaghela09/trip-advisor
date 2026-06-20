import { config } from "../config.js";
import { GeminiProvider } from "./gemini.js";
import { OpenAICompatibleProvider } from "./openai.js";
import type { LLMProvider } from "./provider.js";

/** Selects the provider from config. Add a new case to support another API. */
function createProvider(): LLMProvider {
  switch (config.llmProvider) {
    case "openai":
      return new OpenAICompatibleProvider();
    case "gemini":
    default:
      return new GeminiProvider();
  }
}

/** Single provider instance used across the app. */
export const llm: LLMProvider = createProvider();

export * from "./provider.js";
