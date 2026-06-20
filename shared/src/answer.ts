import type { AgentName } from "./constraints.js";
import type {
  DestinationOut,
  ItineraryOut,
  BudgetVerdict,
} from "./agentOutputs.js";
import type { ConstraintFlag } from "./flags.js";

/**
 * The single coherent answer returned to the user. Facts come from the agent
 * outputs (deterministic assembly); `summary` is LLM-smoothed prose that must
 * not alter any fact. `contributors` lists which agents actually produced data.
 */
export interface SynthesizedAnswer {
  summary: string;
  destination: DestinationOut | null;
  itinerary: ItineraryOut | null;
  budget: BudgetVerdict | null;
  contributors: AgentName[];
  flags: ConstraintFlag[];
}
