import { Router } from "express";
import { randomUUID } from "node:crypto";
import { repository } from "../db/index.js";
import { runOrchestration } from "../orchestrator/index.js";
import { SseChannel } from "../sse.js";
import { config } from "../config.js";

export const planRouter = Router();

/** POST /api/plan -> SSE stream of the orchestration. */
planRouter.post("/plan", async (req, res) => {
  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";
  const sessionId =
    typeof req.body?.sessionId === "string" && req.body.sessionId
      ? req.body.sessionId
      : "anonymous";

  if (!message) {
    res.status(400).json({ error: "message is required" });
    return;
  }

  const runId = randomUUID();
  await repository.createRun({ id: runId, sessionId, userMessage: message });

  const channel = new SseChannel(res);
  channel.onClientClose(() => channel.close());

  // Overall run cap so a stuck run can never hold the connection forever.
  const timeout = setTimeout(() => {
    if (!channel.isClosed) {
      channel.emit({
        type: "error",
        stage: "run",
        message: `Run exceeded ${config.runMaxMs}ms and was stopped.`,
        fatal: true,
      });
      channel.close();
    }
  }, config.runMaxMs);

  try {
    await runOrchestration({
      runId,
      message,
      repo: repository,
      emit: (e) => channel.emit(e),
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    channel.emit({ type: "error", stage: "run", message: m, fatal: true });
    try {
      await repository.finishRun(runId, {
        plan: null,
        answer: null,
        status: "failed",
        durationMs: 0,
      });
    } catch {
      /* best effort */
    }
  } finally {
    clearTimeout(timeout);
    channel.close();
  }
});
