import {
  PlanSchema,
  type Plan,
  type AgentName,
  type BudgetConstraint,
} from "@trip/shared";
import { llm } from "../llm/index.js";

const SYSTEM = `You are the Orchestration Planner of a multi-agent trip planner.
Given a user's trip request in plain language, do two things:

1. Extract structured constraints. budget, region, and a chosen destination are HARD constraints. Use null for anything not mentioned; "interests" is an array (possibly empty).
   - budget: set ONLY when the user states an explicit amount of money. If no money amount is given, budget MUST be null. Never invent a budget.
   - budget.currency: a real currency derived from the user's symbol/word (e.g. "£"->GBP, "$"->USD, "€"->EUR). Never use a non-currency word like "day".
   - region: a broad area only (e.g. "Europe", "Southeast Asia"), NOT a city or country. If the user names a specific place, put it in "knownDestination" and leave region null.

2. Decide which specialised agents are needed and in what order:
   - "destination": suggests where to go. Needed when the user has NOT already chosen a destination.
   - "itinerary": builds a day-by-day plan. Needed when the user wants a trip planned / things to do.
   - "budget": estimates cost and checks it against the budget. Needed when the user gives a budget or asks about cost, and useful to cost any full plan.

Routing rules:
- If the user already named a specific place, set "knownDestination" and do NOT include "destination".
- If the user only wants destination ideas, include just "destination".
- When several are included, order is always destination -> itinerary -> budget.

Briefly explain your routing in "reasoning".`;

// Symbols / words the model might emit, mapped to ISO codes.
const CURRENCY_ALIASES: Record<string, string> = {
  "£": "GBP", gbp: "GBP", pound: "GBP", pounds: "GBP", quid: "GBP",
  "$": "USD", usd: "USD", dollar: "USD", dollars: "USD",
  "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR",
  "₹": "INR", inr: "INR", rupee: "INR", rupees: "INR",
  "¥": "JPY", jpy: "JPY", yen: "JPY",
};

// Known ISO codes we accept directly (3-letter words like "day" must NOT pass).
const KNOWN_CURRENCIES = new Set([
  "GBP", "USD", "EUR", "INR", "JPY", "AUD", "CAD", "CHF", "CNY",
  "SEK", "NOK", "DKK", "NZD", "SGD", "HKD", "AED", "ZAR",
]);

function normaliseCurrency(raw: string): string | null {
  const key = raw.trim().toLowerCase();
  if (CURRENCY_ALIASES[key]) return CURRENCY_ALIASES[key];
  const upper = raw.trim().toUpperCase();
  return KNOWN_CURRENCIES.has(upper) ? upper : null;
}

/**
 * Guards against a weak model inventing a budget or a bogus currency
 * (e.g. currency "day" from "day by day"): if the currency isn't a real
 * currency or the amount isn't positive, the whole budget is dropped.
 */
function sanitiseBudget(budget: BudgetConstraint | null): BudgetConstraint | null {
  if (!budget) return null;
  if (!(budget.amount > 0)) return null;
  const currency = normaliseCurrency(budget.currency);
  if (!currency) return null;
  return { amount: budget.amount, currency };
}

/**
 * Drops a region that is actually the chosen city (a weak model sometimes puts
 * the same place in both), which would otherwise wrongly filter every
 * destination candidate.
 */
function sanitiseRegion(
  region: string | null,
  knownDestination: string | null,
): string | null {
  const r = region?.trim();
  if (!r) return null;
  if (knownDestination && r.toLowerCase() === knownDestination.trim().toLowerCase()) {
    return null;
  }
  return r;
}

function normalisePlan(plan: Plan): Plan {
  plan = {
    ...plan,
    constraints: {
      ...plan.constraints,
      budget: sanitiseBudget(plan.constraints.budget),
      region: sanitiseRegion(
        plan.constraints.region,
        plan.constraints.knownDestination,
      ),
    },
  };

  const set = new Set<AgentName>(plan.agents);
  const hasDest = !!plan.constraints.knownDestination;

  // A known destination makes the destination agent redundant.
  if (hasDest) set.delete("destination");

  // Itinerary/budget need a destination from somewhere.
  if (
    (set.has("itinerary") || set.has("budget")) &&
    !set.has("destination") &&
    !hasDest
  ) {
    set.add("destination");
  }

  // Enforce the canonical dependency order regardless of what the model returned.
  const order: AgentName[] = ["destination", "itinerary", "budget"];
  let agents = order.filter((a) => set.has(a));
  if (agents.length === 0) agents = hasDest ? ["itinerary"] : ["destination"];

  return { ...plan, agents };
}

export async function planRequest(
  message: string,
  onRetry?: (attempt: number, message: string) => void,
): Promise<Plan> {
  const plan = await llm.generateStructured({
    system: SYSTEM,
    user: `User request:\n"""${message}"""`,
    schema: PlanSchema,
    schemaName: "Plan",
    temperature: 0.2,
    onRetry,
  });
  return normalisePlan(plan);
}

/** Safe default if the planner LLM call fails: run the full chain on raw text. */
export function fallbackPlan(message: string): Plan {
  return {
    agents: ["destination", "itinerary", "budget"],
    constraints: {
      budget: null,
      region: null,
      knownDestination: null,
      climate: null,
      durationDays: null,
      travelMonth: null,
      interests: [],
      travellers: null,
      notes: message,
    },
    reasoning: "Planner unavailable; running the full chain on the raw request.",
  };
}
