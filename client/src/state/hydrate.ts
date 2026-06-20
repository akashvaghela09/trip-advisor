import type { RunRecord, AgentStepRecord } from "@trip/shared";
import {
  type RunViewState,
  type AgentView,
  type TerminalLine,
  type AgentViewStatus,
  initialRunState,
} from "./runReducer";

const timeOf = (createdAt: string): string =>
  createdAt.includes(" ") ? createdAt.split(" ")[1] : createdAt;

const stepStatus = (s: AgentStepRecord["status"]): AgentViewStatus =>
  s === "completed" ? "completed" : s === "skipped" ? "skipped" : "failed";

/**
 * Rebuilds the exact same view state from a persisted run - so the history
 * "view" renders identically to a live run, just from stored data.
 */
export function hydrateFromRecord(record: RunRecord): RunViewState {
  const steps = record.steps ?? [];

  const agents: AgentView[] = (record.plan?.agents ?? []).map((name) => {
    const step = steps.find((s) => s.agent === name);
    return {
      name,
      status: step ? stepStatus(step.status) : "pending",
      output: step?.output ?? undefined,
      durationMs: step?.durationMs,
      error: step?.error ?? undefined,
    };
  });

  const terminal: TerminalLine[] = [];
  if (record.plan) {
    const t = timeOf(record.createdAt);
    terminal.push({
      ts: t,
      text: `route: ${record.plan.agents.join(" → ")}`,
      level: "decision",
    });
    terminal.push({
      ts: t,
      text: `planner: ${record.plan.reasoning}`,
      level: "decision",
    });
  }
  for (const s of steps) {
    const t = timeOf(s.createdAt);
    if (s.status === "completed")
      terminal.push({
        ts: t,
        text: `${s.agent} completed (${s.durationMs}ms)`,
        level: "success",
      });
    else if (s.status === "failed")
      terminal.push({
        ts: t,
        text: `${s.agent} failed: ${s.error ?? "error"}`,
        level: "error",
      });
    else
      terminal.push({ ts: t, text: `${s.agent} skipped`, level: "info" });
  }
  terminal.push({
    ts: timeOf(record.createdAt),
    text: `run ${record.status} (${record.durationMs}ms)`,
    level: record.status === "completed" ? "success" : "flag",
  });

  return {
    ...initialRunState,
    runId: record.id,
    phase: record.status,
    query: record.userMessage,
    plan: record.plan,
    agents,
    summary: record.answer?.summary ?? "",
    answer: record.answer,
    terminal,
    source: "history",
  };
}
