import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type {
  Plan,
  AgentName,
  SynthesizedAnswer,
  RunRecord,
  RunSummary,
  AgentStepRecord,
  RunStatus,
  AgentStepStatus,
  ConstraintFlag,
} from "@trip/shared";
import type {
  RunRepository,
  CreateRunInput,
  AppendStepInput,
  FinishRunInput,
} from "./repository.js";

type DB = Database.Database;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  user_message TEXT NOT NULL,
  plan_json    TEXT,
  answer_json  TEXT,
  status       TEXT NOT NULL DEFAULT 'running',
  duration_ms  INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS agent_steps (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  run_id          TEXT NOT NULL REFERENCES runs(id),
  agent           TEXT NOT NULL,
  sequence        INTEGER NOT NULL,
  status          TEXT NOT NULL,
  input_json      TEXT,
  output_json     TEXT,
  error           TEXT,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  constraint_flag TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_steps_run ON agent_steps(run_id, sequence);
`;

function parseJson<T>(s: string | null | undefined): T | null {
  if (!s) return null;
  try {
    return JSON.parse(s) as T;
  } catch {
    return null;
  }
}

/* Row shapes as read from SQLite. */
interface RunRow {
  id: string;
  session_id: string;
  user_message: string;
  plan_json: string | null;
  answer_json: string | null;
  status: string;
  duration_ms: number;
  created_at: string;
}
interface StepRow {
  id: number;
  run_id: string;
  agent: string;
  sequence: number;
  status: string;
  input_json: string | null;
  output_json: string | null;
  error: string | null;
  duration_ms: number;
  constraint_flag: string | null;
  created_at: string;
}

export class SqliteRunRepository implements RunRepository {
  private db: DB;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(SCHEMA_SQL);
  }

  async createRun(input: CreateRunInput): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO runs (id, session_id, user_message, status)
         VALUES (?, ?, ?, 'running')`,
      )
      .run(input.id, input.sessionId, input.userMessage);
  }

  async setPlan(runId: string, plan: Plan): Promise<void> {
    this.db
      .prepare(`UPDATE runs SET plan_json = ? WHERE id = ?`)
      .run(JSON.stringify(plan), runId);
  }

  async appendStep(input: AppendStepInput): Promise<void> {
    this.db
      .prepare(
        `INSERT INTO agent_steps
         (run_id, agent, sequence, status, input_json, output_json, error, duration_ms, constraint_flag)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.runId,
        input.agent,
        input.sequence,
        input.status,
        input.input != null ? JSON.stringify(input.input) : null,
        input.output != null ? JSON.stringify(input.output) : null,
        input.error,
        input.durationMs,
        input.constraintFlag,
      );
  }

  async finishRun(runId: string, input: FinishRunInput): Promise<void> {
    this.db
      .prepare(
        `UPDATE runs
         SET plan_json = COALESCE(?, plan_json), answer_json = ?, status = ?, duration_ms = ?
         WHERE id = ?`,
      )
      .run(
        input.plan ? JSON.stringify(input.plan) : null,
        input.answer ? JSON.stringify(input.answer) : null,
        input.status,
        input.durationMs,
        runId,
      );
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const row = this.db
      .prepare(`SELECT * FROM runs WHERE id = ?`)
      .get(runId) as RunRow | undefined;
    if (!row) return null;
    const steps = this.db
      .prepare(
        `SELECT * FROM agent_steps WHERE run_id = ? ORDER BY sequence ASC, id ASC`,
      )
      .all(runId) as StepRow[];
    return this.mapRun(row, steps);
  }

  async listRuns(sessionId: string, limit = 25): Promise<RunSummary[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM runs WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?`,
      )
      .all(sessionId, limit) as RunRow[];
    return rows.map((r) => this.mapSummary(r));
  }

  private mapRun(row: RunRow, steps: StepRow[]): RunRecord {
    return {
      id: row.id,
      sessionId: row.session_id,
      userMessage: row.user_message,
      plan: parseJson<Plan>(row.plan_json),
      answer: parseJson<SynthesizedAnswer>(row.answer_json),
      status: row.status as RunStatus,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
      steps: steps.map((s) => this.mapStep(s)),
    };
  }

  private mapStep(s: StepRow): AgentStepRecord {
    return {
      id: s.id,
      runId: s.run_id,
      agent: s.agent as AgentName,
      sequence: s.sequence,
      status: s.status as AgentStepStatus,
      input: parseJson(s.input_json),
      output: parseJson(s.output_json),
      error: s.error,
      durationMs: s.duration_ms,
      constraintFlag: s.constraint_flag,
      createdAt: s.created_at,
    };
  }

  private mapSummary(row: RunRow): RunSummary {
    const plan = parseJson<Plan>(row.plan_json);
    const answer = parseJson<SynthesizedAnswer>(row.answer_json);
    const hasOverBudgetFlag = !!answer?.flags?.some(
      (f: ConstraintFlag) => f.kind === "over_budget",
    );
    return {
      id: row.id,
      sessionId: row.session_id,
      userMessage: row.user_message,
      status: row.status as RunStatus,
      agents: plan?.agents ?? [],
      hasOverBudgetFlag,
      durationMs: row.duration_ms,
      createdAt: row.created_at,
    };
  }
}
