import type { Plan } from "./plan.js";
import type { AgentName } from "./constraints.js";
import type { SynthesizedAnswer } from "./answer.js";
import type { RunStatus, AgentStepStatus } from "./events.js";

/** One persisted agent invocation within a run (the audit trail rows). */
export interface AgentStepRecord {
  id: number;
  runId: string;
  agent: AgentName;
  sequence: number;
  status: AgentStepStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  durationMs: number;
  constraintFlag: string | null;
  createdAt: string;
}

/** A full persisted run, with its steps when fetched in detail. */
export interface RunRecord {
  id: string;
  sessionId: string;
  userMessage: string;
  plan: Plan | null;
  answer: SynthesizedAnswer | null;
  status: RunStatus;
  durationMs: number;
  createdAt: string;
  steps?: AgentStepRecord[];
}

/** Lightweight row for the history list. */
export interface RunSummary {
  id: string;
  sessionId: string;
  userMessage: string;
  status: RunStatus;
  agents: AgentName[];
  hasOverBudgetFlag: boolean;
  durationMs: number;
  createdAt: string;
}
