import type {
  StreamEvent,
  AgentName,
  RunStatus,
  ConstraintFlag,
  SynthesizedAnswer,
  AgentOutput,
  DestinationOut,
  ItineraryOut,
  BudgetVerdict,
  Plan,
  LlmErrorCode,
} from "@trip/shared";
import type { RunRepository } from "../db/repository.js";
import type { RunContext } from "../agents/types.js";
import { runDestinationAgent } from "../agents/destination.js";
import { runItineraryAgent } from "../agents/itinerary.js";
import { runBudgetAgent } from "../agents/budget.js";
import { synthesise } from "./synthesis.js";
import { RateLimitError } from "../llm/index.js";

function classifyError(err: unknown): LlmErrorCode {
  if (err instanceof RateLimitError) return "rate_limit";
  const m = err instanceof Error ? err.message : "";
  if (/timed out/i.test(m)) return "timeout";
  return "model_error";
}

function toAgentOutput(name: AgentName, output: unknown): AgentOutput {
  switch (name) {
    case "destination":
      return { agent: "destination", data: output as DestinationOut };
    case "itinerary":
      return { agent: "itinerary", data: output as ItineraryOut };
    case "budget":
      return { agent: "budget", data: output as BudgetVerdict };
    default:
      throw new Error(`Unknown agent: ${name}`);
  }
}

/** A short trace line summarising what an agent produced. */
function summariseOutput(name: AgentName, output: unknown): string {
  switch (name) {
    case "destination": {
      const d = output as DestinationOut;
      return `destination - ${d.candidates.length} option(s), recommended ${d.recommended}`;
    }
    case "itinerary": {
      const d = output as ItineraryOut;
      return `itinerary - ${d.days.length} day(s) planned`;
    }
    case "budget": {
      const d = output as BudgetVerdict;
      const limit = d.budgetAmount != null ? `${d.budgetAmount} ${d.currency}` : "no limit";
      return `budget - ${d.total} ${d.currency} vs ${limit} → ${d.status}`;
    }
    default:
      return name;
  }
}

/**
 * Deterministic, code-controlled chaining. The LLM decided the plan; this
 * function runs it: sequential context passing, per-agent retry/degradation,
 * event emission, and audit persistence.
 */
export async function executeRun(args: {
  runId: string;
  plan: Plan;
  repo: RunRepository;
  emit: (e: StreamEvent) => void;
}): Promise<{ answer: SynthesizedAnswer; status: RunStatus }> {
  const { runId, plan, repo, emit } = args;

  const ctx: RunContext = { constraints: plan.constraints };
  const flags: ConstraintFlag[] = [];
  const contributors: AgentName[] = [];
  let anyFailed = false;

  for (let i = 0; i < plan.agents.length; i++) {
    const name = plan.agents[i];
    const sequence = i + 1;
    emit({ type: "agent_started", agent: name, sequence });
    emit({ type: "log", message: `${name} - querying model…`, level: "info" });
    const started = Date.now();

    try {
      // Agents return structured JSON; we don't stream their raw tokens to the
      // UI (it's not human-readable). Only the final summary streams. Agents can
      // emit granular trace lines (retries, constraint re-runs) via `log`.
      const deps = {
        log: (message: string, level?: "info" | "decision" | "flag") =>
          emit({ type: "log", message, level: level ?? "info" }),
      };
      const result =
        name === "destination"
          ? await runDestinationAgent(ctx, deps)
          : name === "itinerary"
            ? await runItineraryAgent(ctx, deps)
            : await runBudgetAgent(ctx, deps);

      const durationMs = Date.now() - started;

      // Output becomes context for the next agent.
      if (name === "destination") ctx.destination = result.output as DestinationOut;
      else if (name === "itinerary") ctx.itinerary = result.output as ItineraryOut;
      else ctx.budget = result.output as BudgetVerdict;

      for (const f of result.flags) {
        flags.push(f);
        emit({ type: "constraint_flag", flag: f });
      }

      contributors.push(name);
      emit({
        type: "agent_completed",
        agent: name,
        output: toAgentOutput(name, result.output),
        durationMs,
      });
      emit({
        type: "log",
        message: summariseOutput(name, result.output),
        level: "decision",
      });

      await repo.appendStep({
        runId,
        agent: name,
        sequence,
        status: "completed",
        input: ctx.constraints,
        output: result.output,
        error: null,
        durationMs,
        constraintFlag: result.flags[0]?.kind ?? null,
      });
    } catch (err) {
      const durationMs = Date.now() - started;
      const message = err instanceof Error ? err.message : String(err);
      const code = classifyError(err);
      anyFailed = true;

      emit({ type: "agent_failed", agent: name, message, durationMs, code });
      await repo.appendStep({
        runId,
        agent: name,
        sequence,
        status: "failed",
        input: ctx.constraints,
        output: null,
        error: message,
        durationMs,
        constraintFlag: null,
      });

      // Degradation policy: abort the rest if a downstream-required destination
      // failed, or on a rate limit (the quota won't clear mid-run).
      const mustAbort =
        code === "rate_limit" ||
        (name === "destination" && !ctx.constraints.knownDestination);
      if (mustAbort) {
        for (let j = i + 1; j < plan.agents.length; j++) {
          emit({
            type: "agent_skipped",
            agent: plan.agents[j],
            reason: "Skipped because a required earlier agent failed.",
          });
          await repo.appendStep({
            runId,
            agent: plan.agents[j],
            sequence: j + 1,
            status: "skipped",
            input: null,
            output: null,
            error: null,
            durationMs: 0,
            constraintFlag: null,
          });
        }
        break;
      }
      // Otherwise continue the chain with partial context.
    }
  }

  if (contributors.length > 0) {
    emit({ type: "log", message: "writing summary…", level: "info" });
  }
  const answer = await synthesise({ ctx, contributors, flags, emit });
  const status: RunStatus = anyFailed
    ? contributors.length > 0
      ? "partial"
      : "failed"
    : "completed";

  return { answer, status };
}
