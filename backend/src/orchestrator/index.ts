import type {
  StreamEvent,
  Plan,
  SynthesizedAnswer,
  Constraints,
} from "@trip/shared";
import type { RunRepository } from "../db/repository.js";
import { planRequest, fallbackPlan } from "./planner.js";
import { executeRun } from "./executor.js";
import { RateLimitError } from "../llm/index.js";

/** Compact one-line constraint summary for the trace. */
function summariseConstraints(c: Constraints): string {
  const bits: string[] = [];
  if (c.budget) bits.push(`budget ${c.budget.amount} ${c.budget.currency}`);
  if (c.region) bits.push(`region ${c.region}`);
  if (c.knownDestination) bits.push(`destination ${c.knownDestination}`);
  if (c.durationDays) bits.push(`${c.durationDays} days`);
  if (c.climate) bits.push(c.climate);
  if (c.travellers) bits.push(`${c.travellers} traveller(s)`);
  return bits.length ? bits.join(", ") : "none specified";
}

function emptyAnswer(summary: string): SynthesizedAnswer {
  return {
    summary,
    destination: null,
    itinerary: null,
    budget: null,
    contributors: [],
    flags: [],
  };
}

/**
 * Top-level orchestration for one request: plan -> execute -> finish.
 * Emits the full event stream and persists plan + final result. The run row
 * itself is created by the caller before this runs, so failures are still
 * logged.
 */
export async function runOrchestration(args: {
  runId: string;
  message: string;
  emit: (e: StreamEvent) => void;
  repo: RunRepository;
}): Promise<void> {
  const { runId, message, emit, repo } = args;
  const start = Date.now();

  emit({ type: "log", message: "analysing request…", level: "info" });

  let plan: Plan;
  try {
    plan = await planRequest(message, () =>
      emit({ type: "log", message: "planner output invalid, retrying…", level: "flag" }),
    );
  } catch (err) {
    // A rate limit will hit every agent too - stop now with one clean message.
    if (err instanceof RateLimitError) {
      const durationMs = Date.now() - start;
      emit({
        type: "error",
        stage: "planner",
        message: err.message,
        fatal: true,
        code: "rate_limit",
        retryAfterSec: err.retryAfterSec ?? undefined,
      });
      await repo.finishRun(runId, {
        plan: null,
        answer: emptyAnswer(err.message),
        status: "failed",
        durationMs,
      });
      emit({
        type: "run_completed",
        runId,
        answer: emptyAnswer(err.message),
        status: "failed",
        durationMs,
      });
      return;
    }
    plan = fallbackPlan(message);
    emit({
      type: "error",
      stage: "planner",
      message: "Planner failed; using default routing.",
      fatal: false,
    });
  }

  await repo.setPlan(runId, plan);
  emit({ type: "run_started", runId, plan });
  emit({
    type: "log",
    message: `constraints - ${summariseConstraints(plan.constraints)}`,
    level: "decision",
  });

  const { answer, status } = await executeRun({ runId, plan, repo, emit });

  const durationMs = Date.now() - start;
  await repo.finishRun(runId, { plan, answer, status, durationMs });
  emit({ type: "run_completed", runId, answer, status, durationMs });
}
