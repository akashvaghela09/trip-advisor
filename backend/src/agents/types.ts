import type {
  Constraints,
  DestinationOut,
  ItineraryOut,
  BudgetVerdict,
  ConstraintFlag,
} from "@trip/shared";

/** Shared, mutable working memory for one run. Lives only for the request. */
export interface RunContext {
  constraints: Constraints;
  destination?: DestinationOut;
  itinerary?: ItineraryOut;
  budget?: BudgetVerdict;
}

export interface AgentDeps {
  /** Emit a granular trace line from inside the agent. */
  log?: (message: string, level?: "info" | "decision" | "flag") => void;
}

export interface AgentResult<T> {
  output: T;
  flags: ConstraintFlag[];
}
