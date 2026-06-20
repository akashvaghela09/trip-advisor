import OpenAI from "openai";
import type { ChatCompletionCreateParamsStreaming } from "openai/resources/chat/completions";
import { config, assertOpenAiConfigured } from "../config.js";
import { BaseLLMProvider, type StreamArgs } from "./base.js";

type ResponseFormat = ChatCompletionCreateParamsStreaming["response_format"];

/** Removes keys some endpoints reject in strict json_schema mode. */
function cleanSchema(schema: unknown): Record<string, unknown> {
  const obj = { ...(schema as Record<string, unknown>) };
  delete obj["$schema"];
  return obj;
}

/** Builds the response_format for a structured call per the configured mode. */
function buildResponseFormat(args: StreamArgs): ResponseFormat | undefined {
  if (!args.json) return undefined;
  switch (config.openaiJsonFormat) {
    case "off":
      return undefined;
    case "json_schema":
      if (!args.jsonSchema) return { type: "json_object" };
      return {
        type: "json_schema",
        json_schema: {
          name: (args.schemaName ?? "response").replace(/[^a-zA-Z0-9_]/g, "_"),
          strict: true,
          schema: cleanSchema(args.jsonSchema),
        },
      };
    case "json_object":
    default:
      return { type: "json_object" };
  }
}

/**
 * Works with any OpenAI Chat Completions-compatible endpoint:
 * OpenAI, xAI (Grok), Groq, Together, or a local server (Ollama / LM Studio)
 * via OPENAI_BASE_URL.
 */
export class OpenAICompatibleProvider extends BaseLLMProvider {
  private client: OpenAI | null = null;

  private getClient(): OpenAI {
    assertOpenAiConfigured();
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: config.openaiApiKey || "not-needed", // local servers ignore it
        baseURL: config.openaiBaseUrl || undefined, // undefined → api.openai.com
      });
    }
    return this.client;
  }

  protected async streamCompletion(args: StreamArgs): Promise<string> {
    const client = this.getClient();
    const responseFormat = buildResponseFormat(args);
    const stream = await client.chat.completions.create(
      {
        model: config.openaiModel,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user },
        ],
        temperature: args.temperature,
        stream: true,
        ...(responseFormat ? { response_format: responseFormat } : {}),
      },
      { signal: args.signal },
    );

    let full = "";
    for await (const chunk of stream) {
      const t = chunk.choices[0]?.delta?.content ?? "";
      if (t) {
        full += t;
        args.onToken?.(t);
      }
    }
    return full;
  }
}
