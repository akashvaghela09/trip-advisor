import type { AgentName } from "./constraints.js";

export type ConstraintFlagKind =
  | "over_budget"
  | "hard_constraint_filtered"
  | "low_confidence";

/**
 * A behavioural-constraint signal raised by an agent or by the code that
 * enforces its rule (e.g. budget exceeded, a destination filtered out).
 */
export interface ConstraintFlag {
  kind: ConstraintFlagKind;
  agent: AgentName;
  message: string;
  detail?: Record<string, unknown>;
}
