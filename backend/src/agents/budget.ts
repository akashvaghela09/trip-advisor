import {
  BudgetEstimateSchema,
  CheaperAlternativeSchema,
  type BudgetVerdict,
  type BudgetStatus,
  type CheaperAlternative,
  type ConstraintFlag,
} from "@trip/shared";
import { llm } from "../llm/index.js";
import type { RunContext, AgentDeps, AgentResult } from "./types.js";
import { summariseItinerary, round2 } from "./prompts.js";

const SYSTEM_ESTIMATE = `You are the Budget Agent in a multi-agent trip planner.
Produce a realistic total cost estimate as line items in the requested currency, for the given number of travellers and days.

RULES (follow strictly):
1. Cover the main categories: flights, accommodation, food, activities, local transport, other.
2. Be realistic - neither over-optimistic nor padded.
3. State your assumptions (origin city unknown, mid-range hotels, etc.) in "assumptions".`;

const SYSTEM_CHEAPER = `You are the Budget Agent proposing a CHEAPER alternative for a trip that is over budget.
Keep the trip worthwhile but cut cost to meet the hard budget.

RULES (follow strictly):
1. Be specific about what changes (cheaper lodging, fewer paid activities, shoulder-season dates, nearby cheaper destination, etc.).
2. Give a realistic "newEstimatedTotal".
3. Be honest: if it is genuinely impossible to get under budget, propose the cheapest realistic option and say so plainly - do NOT pretend to meet a budget the numbers cannot meet.`;

export async function runBudgetAgent(
  ctx: RunContext,
  deps: AgentDeps,
): Promise<AgentResult<BudgetVerdict>> {
  const currency = ctx.constraints.budget?.currency ?? "GBP";
  const destination =
    ctx.constraints.knownDestination ??
    ctx.destination?.recommended ??
    "the destination";
  const days =
    ctx.constraints.durationDays ?? ctx.itinerary?.durationDays ?? 3;
  const travellers = ctx.constraints.travellers ?? 1;
  const itinSummary = ctx.itinerary
    ? summariseItinerary(ctx.itinerary)
    : "No detailed itinerary was produced; estimate for a typical trip of this length.";

  const user = `Estimate the total cost in ${currency} for this trip.

Destination: ${destination}
Duration: ${days} days
Travellers: ${travellers}

Itinerary:
${itinSummary}`;

  const estimate = await llm.generateStructured({
    system: SYSTEM_ESTIMATE,
    user,
    schema: BudgetEstimateSchema,
    schemaName: "BudgetEstimate",
    temperature: 0.4,
    onRetry: () => deps.log?.("budget estimate invalid, retrying…", "flag"),
  });

  // CODE-AUTHORITATIVE total + budget check. The model never self-certifies.
  const total = round2(
    estimate.lineItems.reduce((sum, li) => sum + li.amount, 0),
  );
  const budgetAmount = ctx.constraints.budget?.amount ?? null;

  const flags: ConstraintFlag[] = [];
  let status: BudgetStatus;
  let overageAmount = 0;
  let cheaperAlternative: CheaperAlternative | null = null;
  let cheaperAlternativeMeetsBudget: boolean | null = null;

  if (budgetAmount == null) {
    status = "no_budget";
  } else if (total <= budgetAmount) {
    status = "within";
  } else {
    status = "over";
    overageAmount = round2(total - budgetAmount);
    flags.push({
      kind: "over_budget",
      agent: "budget",
      message: `Estimated ${total} ${currency} exceeds the budget of ${budgetAmount} ${currency} by ${overageAmount} ${currency}.`,
      detail: { total, budgetAmount, overageAmount, currency },
    });

    // Exactly one cheaper-alternative attempt, with full context of why.
    const cheaperUser = `The current plan for ${destination} (${days} days, ${travellers} traveller(s)) is estimated at ${total} ${currency}, which is ${overageAmount} ${currency} OVER the hard budget of ${budgetAmount} ${currency}.

Current cost breakdown:
${estimate.lineItems
  .map((li) => `- ${li.category}: ${li.description} = ${li.amount} ${currency}`)
  .join("\n")}

Propose a cheaper alternative that comes in at or under ${budgetAmount} ${currency}.`;

    deps.log?.(
      `over budget by ${overageAmount} ${currency} - asking budget agent for a cheaper plan…`,
      "flag",
    );

    try {
      cheaperAlternative = await llm.generateStructured({
        system: SYSTEM_CHEAPER,
        user: cheaperUser,
        schema: CheaperAlternativeSchema,
        schemaName: "CheaperAlternative",
        temperature: 0.5,
        onRetry: () => deps.log?.("cheaper plan invalid, retrying…", "flag"),
      });
    } catch {
      cheaperAlternative = null; // degrade gracefully; the overage is still flagged
    }

    // Code-check the alternative too: if even it can't meet the budget, the
    // trip isn't feasible - flag it clearly instead of implying it fits.
    if (cheaperAlternative && budgetAmount != null) {
      cheaperAlternativeMeetsBudget =
        cheaperAlternative.newEstimatedTotal <= budgetAmount;
      deps.log?.(
        `cheaper plan ~${cheaperAlternative.newEstimatedTotal} ${currency} (${
          cheaperAlternativeMeetsBudget ? "within budget" : "still over - not feasible"
        })`,
        cheaperAlternativeMeetsBudget ? "decision" : "flag",
      );
      if (!cheaperAlternativeMeetsBudget) {
        flags.push({
          kind: "over_budget",
          agent: "budget",
          message: `Even the cheaper option (${cheaperAlternative.newEstimatedTotal} ${currency}) exceeds the budget of ${budgetAmount} ${currency} - this trip is not feasible at this budget.`,
          detail: {
            cheaperTotal: cheaperAlternative.newEstimatedTotal,
            budgetAmount,
            currency,
          },
        });
      }
    }
  }

  const verdict: BudgetVerdict = {
    estimate,
    total,
    budgetAmount,
    currency,
    status,
    overageAmount,
    cheaperAlternative,
    cheaperAlternativeMeetsBudget,
  };

  return { output: verdict, flags };
}
