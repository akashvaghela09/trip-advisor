import type {
  Plan,
  AgentName,
  SynthesizedAnswer,
  RunRecord,
  RunSummary,
  RunStatus,
  AgentStepStatus,
} from "@trip/shared";

export interface CreateRunInput {
  id: string;
  sessionId: string;
  userMessage: string;
}

export interface AppendStepInput {
  runId: string;
  agent: AgentName;
  sequence: number;
  status: AgentStepStatus;
  input: unknown;
  output: unknown;
  error: string | null;
  durationMs: number;
  constraintFlag: string | null;
}

export interface FinishRunInput {
  plan: Plan | null;
  answer: SynthesizedAnswer | null;
  status: RunStatus;
  durationMs: number;
}

/**
 * Data-access contract for the audit trail. The app depends only on this
 * interface, so the storage engine can be swapped behind it. Methods are async
 * so a synchronous (SQLite) and a network-backed implementation share one shape.
 */
export interface RunRepository {
  createRun(input: CreateRunInput): Promise<void>;
  setPlan(runId: string, plan: Plan): Promise<void>;
  appendStep(input: AppendStepInput): Promise<void>;
  finishRun(runId: string, input: FinishRunInput): Promise<void>;
  getRun(runId: string): Promise<RunRecord | null>;
  listRuns(sessionId: string, limit?: number): Promise<RunSummary[]>;
}
