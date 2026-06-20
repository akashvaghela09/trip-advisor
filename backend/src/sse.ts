import type { Response } from "express";
import type { StreamEvent } from "@trip/shared";

/**
 * A Server-Sent Events channel over an Express response. Sets the right
 * headers (including disabling proxy buffering), emits typed events, and keeps
 * the connection alive with periodic heartbeat comments.
 */
export class SseChannel {
  private heartbeat: NodeJS.Timeout;
  private closed = false;

  constructor(private res: Response) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // tells nginx not to buffer the stream
    });
    res.flushHeaders?.();
    res.write(": connected\n\n");

    this.heartbeat = setInterval(() => {
      if (!this.closed) this.res.write(": ping\n\n");
    }, 15000);
  }

  emit(event: StreamEvent): void {
    if (this.closed) return;
    this.res.write(`event: ${event.type}\n`);
    this.res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.heartbeat);
    this.res.end();
  }

  get isClosed(): boolean {
    return this.closed;
  }

  onClientClose(cb: () => void): void {
    this.res.on("close", cb);
  }
}
