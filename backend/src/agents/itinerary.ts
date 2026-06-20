import {
  ItineraryOutSchema,
  type ItineraryOut,
  type ConstraintFlag,
} from "@trip/shared";
import { llm } from "../llm/index.js";
import type { RunContext, AgentDeps, AgentResult } from "./types.js";
import { describeConstraints } from "./prompts.js";

const SYSTEM = `You are the Itinerary Agent in a multi-agent trip planner.
Build a realistic day-by-day plan for the given destination and trip length.

RULES (follow strictly):
1. Each day must be realistic on travel time and the sequencing of activities - do not place activities that are far apart on the same day without accounting for travel.
2. When you are uncertain about timing, opening hours, seasonality, or feasibility, lower that day's "confidence" and explain why in "uncertaintyNote".
3. Tailor activities to the traveller's interests.
4. Produce exactly the requested number of days, numbered from 1.`;

export async function runItineraryAgent(
  ctx: RunContext,
  deps: AgentDeps,
): Promise<AgentResult<ItineraryOut>> {
  const destination =
    ctx.constraints.knownDestination ?? ctx.destination?.recommended;
  if (!destination) {
    throw new Error("Itinerary agent has no destination to plan for.");
  }
  const days = ctx.constraints.durationDays ?? 3;

  const whyChosen = ctx.destination?.candidates.find(
    (c) => c.name === destination,
  )?.justification;

  const user = `Build a ${days}-day itinerary for ${destination}.

Traveller context:
${describeConstraints(ctx.constraints)}${
    whyChosen ? `\n\nWhy this destination was chosen: ${whyChosen}` : ""
  }`;

  const out = await llm.generateStructured({
    system: SYSTEM,
    user,
    schema: ItineraryOutSchema,
    schemaName: "ItineraryOut",
    temperature: 0.7,
    onRetry: () => deps.log?.("itinerary output invalid, retrying…", "flag"),
  });

  const flags: ConstraintFlag[] = [];

  // Enforce the "say so when uncertain" rule: any non-high day must carry a note.
  const normalisedDays = out.days.map((d) =>
    d.confidence !== "high" && !d.uncertaintyNote
      ? { ...d, uncertaintyNote: "Some timings are approximate." }
      : d,
  );

  if (normalisedDays.some((d) => d.confidence === "low")) {
    flags.push({
      kind: "low_confidence",
      agent: "itinerary",
      message:
        "Some days are low-confidence on timing or feasibility; treat those as approximate.",
    });
  }

  return {
    output: {
      destination,
      durationDays: out.durationDays || days,
      days: normalisedDays,
      overallNotes: out.overallNotes,
    },
    flags,
  };
}
