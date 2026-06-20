import type {
  StreamEvent,
  AgentName,
  ConstraintFlag,
  SynthesizedAnswer,
} from "@trip/shared";
import type { RunContext } from "../agents/types.js";
import { llm } from "../llm/index.js";

const SYSTEM = `You are the writer for a trip-planning assistant. Turn the trip data into a short, friendly answer addressed to the traveller ("you").

STYLE:
- Very concise: at most 2 short paragraphs, ideally 3-4 sentences total. No filler, no headings, no lists, no markdown.
- Never mention JSON, data, fields, "agents", or any internal mechanics.
- Lead with the recommended place or the plan. Sound like a helpful human.

WORDING (important):
- "total" is the ESTIMATED COST of the trip. "budgetAmount" is the traveller's BUDGET (their limit). Never call the estimated cost their budget.
- Always include the currency with every amount (e.g. "1120 GBP").
- State each point once; never restate the same fact in different words.
- Phrase it like: "The estimated cost is {total} {currency}, which is {within / over by overageAmount} your {budgetAmount} {currency} budget."

BUDGET OUTCOME:
- within budget: say it fits, give the estimated cost.
- over budget (cheaperMeetsBudget = true): say the estimated cost is over by the stated amount, then give the cheaper option's total in one sentence.
- not feasible (cheaperMeetsBudget = false): say plainly the trip is not realistic at this budget (even the cheapest option is well above it) and suggest raising the budget. Do NOT imply it fits.

ACCURACY: never invent or change a number; every figure must match the data exactly.`;

function buildFacts(ctx: RunContext): string {
  const facts = {
    destination: ctx.destination
      ? {
          recommended: ctx.destination.recommended,
          candidates: ctx.destination.candidates.map((c) => ({
            name: c.name,
            country: c.country,
            justification: c.justification,
          })),
        }
      : null,
    itinerary: ctx.itinerary
      ? {
          destination: ctx.itinerary.destination,
          durationDays: ctx.itinerary.durationDays,
          days: ctx.itinerary.days.map((d) => ({
            day: d.day,
            title: d.title,
            confidence: d.confidence,
          })),
        }
      : null,
    budget: ctx.budget
      ? {
          total: ctx.budget.total,
          currency: ctx.budget.currency,
          budgetAmount: ctx.budget.budgetAmount,
          status: ctx.budget.status,
          overageAmount: ctx.budget.overageAmount,
          cheaperAlternative: ctx.budget.cheaperAlternative,
          cheaperMeetsBudget: ctx.budget.cheaperAlternativeMeetsBudget,
        }
      : null,
  };

  return `Field meanings:
- destination.recommended: the chosen place to present first
- budget.status: "within" = under budget, "over" = exceeds budget, "no_budget" = no budget was given
- budget.overageAmount: how much over budget (only meaningful when status is "over")
- budget.cheaperAlternative: a cheaper plan, present only when over budget
- budget.cheaperMeetsBudget: true if the cheaper plan fits the budget; false means the trip is NOT feasible at this budget

Trip data (JSON):
${JSON.stringify(facts, null, 2)}

Write the traveller-facing summary now.`;
}

/** Pure fallback prose if the smoothing call fails - facts only, no model. */
function deterministicSummary(ctx: RunContext): string {
  const parts: string[] = [];
  if (ctx.destination)
    parts.push(`Recommended destination: ${ctx.destination.recommended}.`);
  if (ctx.itinerary)
    parts.push(
      `A ${ctx.itinerary.durationDays}-day itinerary for ${ctx.itinerary.destination} is ready.`,
    );
  if (ctx.budget) {
    if (ctx.budget.status === "over")
      parts.push(
        `Estimated cost is ${ctx.budget.total} ${ctx.budget.currency}, which is over budget by ${ctx.budget.overageAmount} ${ctx.budget.currency}; a cheaper alternative is included.`,
      );
    else if (ctx.budget.status === "within")
      parts.push(
        `Estimated cost is ${ctx.budget.total} ${ctx.budget.currency}, within budget.`,
      );
    else
      parts.push(`Estimated cost is ${ctx.budget.total} ${ctx.budget.currency}.`);
  }
  return parts.join(" ");
}

/**
 * Deterministic assembly of the answer (facts straight from ctx) plus an
 * LLM-smoothed prose summary that is forbidden from changing any fact.
 */
export async function synthesise(args: {
  ctx: RunContext;
  contributors: AgentName[];
  flags: ConstraintFlag[];
  emit: (e: StreamEvent) => void;
}): Promise<SynthesizedAnswer> {
  const { ctx, contributors, flags, emit } = args;

  if (contributors.length === 0) {
    const summary =
      "Sorry - we couldn't produce a plan this time. Please try again.";
    emit({ type: "synthesis_token", delta: summary });
    return {
      summary,
      destination: null,
      itinerary: null,
      budget: null,
      contributors,
      flags,
    };
  }

  let summary = "";
  try {
    summary = await llm.generateText({
      system: SYSTEM,
      user: buildFacts(ctx),
      temperature: 0.5,
      onToken: (delta) => emit({ type: "synthesis_token", delta }),
    });
  } catch {
    summary = deterministicSummary(ctx);
    emit({ type: "synthesis_token", delta: summary });
  }

  return {
    summary: summary.trim(),
    destination: ctx.destination ?? null,
    itinerary: ctx.itinerary ?? null,
    budget: ctx.budget ?? null,
    contributors,
    flags,
  };
}
