import type {
  StreamEvent,
  Plan,
  AgentName,
  SynthesizedAnswer,
} from "@trip/shared";

export type RunPhase =
  | "idle"
  | "running"
  | "completed"
  | "partial"
  | "failed";

export type AgentViewStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface AgentView {
  name: AgentName;
  status: AgentViewStatus;
  output?: unknown; // structured data once complete (agent-specific)
  durationMs?: number;
  error?: string;
}

export type TerminalLevel = "info" | "decision" | "flag" | "error" | "success";

export interface TerminalLine {
  ts: string;
  text: string;
  level: TerminalLevel;
}

export interface RunViewState {
  runId: string | null;
  phase: RunPhase;
  query: string;
  plan: Plan | null;
  agents: AgentView[];
  summary: string;
  answer: SynthesizedAnswer | null;
  terminal: TerminalLine[];
  error: string | null;
  rateLimit: { message: string; retryAfterSec?: number } | null;
  source: "live" | "history" | null;
}

export const initialRunState: RunViewState = {
  runId: null,
  phase: "idle",
  query: "",
  plan: null,
  agents: [],
  summary: "",
  answer: null,
  terminal: [],
  error: null,
  rateLimit: null,
  source: null,
};

export type RunAction =
  | { type: "submit"; query: string; at: string }
  | { type: "event"; event: StreamEvent; at: string }
  | { type: "fatal"; message: string; at: string }
  | { type: "hydrate"; state: RunViewState }
  | { type: "reset" };

const mk = (ts: string, text: string, level: TerminalLevel): TerminalLine => ({
  ts,
  text,
  level,
});

function updateAgent(
  agents: AgentView[],
  name: AgentName,
  patch: Partial<AgentView>,
): AgentView[] {
  return agents.map((a) => (a.name === name ? { ...a, ...patch } : a));
}

function applyEvent(
  state: RunViewState,
  event: StreamEvent,
  at: string,
): RunViewState {
  switch (event.type) {
    case "run_started": {
      const agents: AgentView[] = event.plan.agents.map((name) => ({
        name,
        status: "pending",
      }));
      return {
        ...state,
        runId: event.runId,
        plan: event.plan,
        agents,
        terminal: [
          ...state.terminal,
          mk(at, `route: ${event.plan.agents.join(" → ")}`, "decision"),
          mk(at, `planner: ${event.plan.reasoning}`, "decision"),
        ],
      };
    }
    case "agent_started":
      return {
        ...state,
        agents: updateAgent(state.agents, event.agent, { status: "running" }),
        terminal: [...state.terminal, mk(at, `▸ ${event.agent} started`, "info")],
      };
    case "agent_completed":
      return {
        ...state,
        agents: updateAgent(state.agents, event.agent, {
          status: "completed",
          output: event.output.data,
          durationMs: event.durationMs,
        }),
        terminal: [
          ...state.terminal,
          mk(at, `${event.agent} completed (${event.durationMs}ms)`, "success"),
        ],
      };
    case "agent_failed":
      return {
        ...state,
        agents: updateAgent(state.agents, event.agent, {
          status: "failed",
          error: event.message,
          durationMs: event.durationMs,
        }),
        rateLimit:
          event.code === "rate_limit"
            ? { message: event.message }
            : state.rateLimit,
        terminal: [
          ...state.terminal,
          mk(at, `${event.agent} failed: ${event.message}`, "error"),
        ],
      };
    case "agent_skipped":
      return {
        ...state,
        agents: updateAgent(state.agents, event.agent, { status: "skipped" }),
        terminal: [
          ...state.terminal,
          mk(at, `${event.agent} skipped - ${event.reason}`, "info"),
        ],
      };
    case "constraint_flag":
      return {
        ...state,
        terminal: [...state.terminal, mk(at, event.flag.message, "flag")],
      };
    case "log":
      return {
        ...state,
        terminal: [
          ...state.terminal,
          mk(at, event.message, event.level ?? "info"),
        ],
      };
    case "synthesis_token":
      return { ...state, summary: state.summary + event.delta };
    case "run_completed":
      return {
        ...state,
        phase: event.status,
        answer: event.answer,
        summary: event.answer.summary,
        terminal: [
          ...state.terminal,
          mk(
            at,
            `run ${event.status} (${event.durationMs}ms)`,
            event.status === "completed" ? "success" : "flag",
          ),
        ],
      };
    case "error":
      return {
        ...state,
        phase: event.fatal ? "failed" : state.phase,
        error: event.fatal ? event.message : state.error,
        rateLimit:
          event.code === "rate_limit"
            ? { message: event.message, retryAfterSec: event.retryAfterSec }
            : state.rateLimit,
        terminal: [
          ...state.terminal,
          mk(at, `error [${event.stage}]: ${event.message}`, "error"),
        ],
      };
    default:
      return state;
  }
}

export function runReducer(
  state: RunViewState,
  action: RunAction,
): RunViewState {
  switch (action.type) {
    case "submit":
      return {
        ...initialRunState,
        phase: "running",
        query: action.query,
        source: "live",
        terminal: [mk(action.at, `submitted request`, "info")],
      };
    case "event":
      return applyEvent(state, action.event, action.at);
    case "fatal":
      return {
        ...state,
        phase: "failed",
        error: action.message,
        terminal: [
          ...state.terminal,
          mk(action.at, `fatal: ${action.message}`, "error"),
        ],
      };
    case "hydrate":
      return action.state;
    case "reset":
      return initialRunState;
    default:
      return state;
  }
}
