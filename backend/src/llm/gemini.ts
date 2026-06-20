import { GoogleGenAI } from "@google/genai";
import { config, assertGeminiConfigured } from "../config.js";
import { BaseLLMProvider, type StreamArgs } from "./base.js";

export class GeminiProvider extends BaseLLMProvider {
  private client: GoogleGenAI | null = null;

  private getClient(): GoogleGenAI {
    assertGeminiConfigured();
    if (!this.client) {
      this.client = new GoogleGenAI({ apiKey: config.geminiApiKey });
    }
    return this.client;
  }

  protected async streamCompletion(args: StreamArgs): Promise<string> {
    const client = this.getClient();
    const stream = await client.models.generateContentStream({
      model: config.geminiModel,
      contents: args.user,
      config: {
        systemInstruction: args.system,
        responseMimeType: args.json ? "application/json" : "text/plain",
        temperature: args.temperature,
        abortSignal: args.signal,
      },
    });
    let full = "";
    for await (const chunk of stream) {
      const t = chunk.text ?? "";
      if (t) {
        full += t;
        args.onToken?.(t);
      }
    }
    return full;
  }
}
