import pg from "pg";
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

const { Pool } = pg;

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS runs (
  id           TEXT PRIMARY KEY,
  session_id   TEXT NOT NULL,
  user_message TEXT NOT NULL,
  plan_json    TEXT,
  answer_json  TEXT,
  status       TEXT NOT NULL DEFAULT 'running',
  duration_ms  INTEGER NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_steps (
  id              SERIAL PRIMARY KEY,
  run_id          TEXT NOT NULL REFERENCES runs(id),
  agent           TEXT NOT NULL,
  sequence        INTEGER NOT NULL,
  status          TEXT NOT NULL,
  input_json      TEXT,
  output_json     TEXT,
  error           TEXT,
  duration_ms     INTEGER NOT NULL DEFAULT 0,
  constraint_flag TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
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

/** Postgres returns TIMESTAMPTZ as a JS Date; normalise to an ISO string so the
 * API response shape matches what the SQLite implementation produced. */
function isoString(v: unknown): string {
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

/* Row shapes as read from Postgres. */
interface RunRow {
  id: string;
  session_id: string;
  user_message: string;
  plan_json: string | null;
  answer_json: string | null;
  status: string;
  duration_ms: number;
  created_at: Date | string;
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
  created_at: Date | string;
}

export class PostgresRunRepository implements RunRepository {
  private pool: pg.Pool;
  /** Schema creation runs once; every query awaits it first. */
  private ready: Promise<void>;

  constructor(connectionString: string) {
    // Supabase (and any non-local host) requires TLS; a local Droplet Postgres
    // on localhost does not. Detect from the host so one DATABASE_URL works for
    // both without an extra flag.
    const isLocal = /@(localhost|127\.0\.0\.1)(:|\/)/.test(connectionString);
    this.pool = new Pool({
      connectionString,
      ssl: isLocal ? undefined : { rejectUnauthorized: false },
    });
    this.ready = this.pool.query(SCHEMA_SQL).then(() => undefined);
  }

  private async query<R extends pg.QueryResultRow>(
    text: string,
    params: unknown[] = [],
  ): Promise<R[]> {
    await this.ready;
    const res = await this.pool.query<R>(text, params);
    return res.rows;
  }

  async createRun(input: CreateRunInput): Promise<void> {
    await this.query(
      `INSERT INTO runs (id, session_id, user_message, status)
       VALUES ($1, $2, $3, 'running')`,
      [input.id, input.sessionId, input.userMessage],
    );
  }

  async setPlan(runId: string, plan: Plan): Promise<void> {
    await this.query(`UPDATE runs SET plan_json = $1 WHERE id = $2`, [
      JSON.stringify(plan),
      runId,
    ]);
  }

  async appendStep(input: AppendStepInput): Promise<void> {
    await this.query(
      `INSERT INTO agent_steps
       (run_id, agent, sequence, status, input_json, output_json, error, duration_ms, constraint_flag)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        input.runId,
        input.agent,
        input.sequence,
        input.status,
        input.input != null ? JSON.stringify(input.input) : null,
        input.output != null ? JSON.stringify(input.output) : null,
        input.error,
        input.durationMs,
        input.constraintFlag,
      ],
    );
  }

  async finishRun(runId: string, input: FinishRunInput): Promise<void> {
    await this.query(
      `UPDATE runs
       SET plan_json = COALESCE($1, plan_json), answer_json = $2, status = $3, duration_ms = $4
       WHERE id = $5`,
      [
        input.plan ? JSON.stringify(input.plan) : null,
        input.answer ? JSON.stringify(input.answer) : null,
        input.status,
        input.durationMs,
        runId,
      ],
    );
  }

  async getRun(runId: string): Promise<RunRecord | null> {
    const rows = await this.query<RunRow>(`SELECT * FROM runs WHERE id = $1`, [
      runId,
    ]);
    const row = rows[0];
    if (!row) return null;
    const steps = await this.query<StepRow>(
      `SELECT * FROM agent_steps WHERE run_id = $1 ORDER BY sequence ASC, id ASC`,
      [runId],
    );
    return this.mapRun(row, steps);
  }

  async listRuns(sessionId: string, limit = 25): Promise<RunSummary[]> {
    const rows = await this.query<RunRow>(
      `SELECT * FROM runs WHERE session_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`,
      [sessionId, limit],
    );
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
      createdAt: isoString(row.created_at),
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
      createdAt: isoString(s.created_at),
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
      createdAt: isoString(row.created_at),
    };
  }
}
