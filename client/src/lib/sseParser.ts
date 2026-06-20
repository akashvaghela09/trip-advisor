import type { StreamEvent } from "@trip/shared";

/**
 * Parses an SSE byte stream into typed events. Heartbeat/comment frames
 * (lines starting with ":") carry no data and are skipped.
 */
export async function* parseSseStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<StreamEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);

      const dataLines = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"));
      if (dataLines.length === 0) continue; // comment / heartbeat

      const json = dataLines.map((l) => l.slice(5).trim()).join("");
      try {
        yield JSON.parse(json) as StreamEvent;
      } catch {
        /* ignore malformed frame */
      }
    }
  }
}
