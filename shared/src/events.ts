import type { AgentName } from "./constraints.js";
import type { Plan } from "./plan.js";
import type {
  DestinationOut,
  ItineraryOut,
  BudgetVerdict,
} from "./agentOutputs.js";
import type { ConstraintFlag } from "./flags.js";
import type { SynthesizedAnswer } from "./answer.js";

export type RunStatus = "running" | "completed" | "partial" | "failed";
export type AgentStepStatus = "running" | "completed" | "failed" | "skipped";

/** Classifier for model-call failures, so the UI can react specifically. */
export type LlmErrorCode = "rate_limit" | "timeout" | "model_error";

/** Discriminated agent result, so each agent's output stays strongly typed. */
export type AgentOutput =
  | { agent: "destination"; data: DestinationOut }
  | { agent: "itinerary"; data: ItineraryOut }
  | { agent: "budget"; data: BudgetVerdict };

export interface RunStartedEvent {
  type: "run_started";
  runId: string;
  plan: Plan;
}
export interface AgentStartedEvent {
  type: "agent_started";
  agent: AgentName;
  sequence: number;
}
export interface AgentCompletedEvent {
  type: "agent_completed";
  agent: AgentName;
  output: AgentOutput;
  durationMs: number;
}
export interface AgentFailedEvent {
  type: "agent_failed";
  agent: AgentName;
  message: string;
  durationMs: number;
  code?: LlmErrorCode;
}
export interface AgentSkippedEvent {
  type: "agent_skipped";
  agent: AgentName;
  reason: string;
}
export interface ConstraintFlagEvent {
  type: "constraint_flag";
  flag: ConstraintFlag;
}
export interface SynthesisTokenEvent {
  type: "synthesis_token";
  delta: string;
}
export interface RunCompletedEvent {
  type: "run_completed";
  runId: string;
  answer: SynthesizedAnswer;
  status: RunStatus;
  durationMs: number;
}
export interface ErrorEvent {
  type: "error";
  stage: string;
  message: string;
  fatal: boolean;
  code?: LlmErrorCode;
  retryAfterSec?: number;
}
/** A fine-grained progress line for the trace (no effect on the answer). */
export interface LogEvent {
  type: "log";
  message: string;
  level?: "info" | "decision" | "flag";
}

/** Every event the SSE stream can emit. `type` is the discriminant. */
export type StreamEvent =
  | RunStartedEvent
  | AgentStartedEvent
  | AgentCompletedEvent
  | AgentFailedEvent
  | AgentSkippedEvent
  | ConstraintFlagEvent
  | SynthesisTokenEvent
  | RunCompletedEvent
  | LogEvent
  | ErrorEvent;
