import type { AgentName } from "./constraints.js";

/** Human-readable agent labels, shared so client + logs agree. */
export const AGENT_LABELS: Record<AgentName, string> = {
  destination: "Destination Agent",
  itinerary: "Itinerary Agent",
  budget: "Budget Agent",
};
