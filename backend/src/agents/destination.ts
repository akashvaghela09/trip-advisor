import {
  DestinationOutSchema,
  type DestinationOut,
  type ConstraintFlag,
} from "@trip/shared";
import { llm } from "../llm/index.js";
import type { RunContext, AgentDeps, AgentResult } from "./types.js";
import { describeConstraints } from "./prompts.js";

const SYSTEM = `You are the Destination Agent in a multi-agent trip planner.
Suggest 2-3 real destinations that fit the traveller's stated preferences (climate, interests, budget band, region).

RULES (follow strictly):
1. Justify EVERY suggestion explicitly against the stated preferences in the "justification" field.
2. NEVER suggest a destination that breaks a HARD constraint the user gave (an explicit region or budget band).
3. Set "region" to the continent / large area the destination sits in (e.g. "Europe", "Southeast Asia", "South America").
4. Be honest about budget fit via "approxBudgetFit".
5. Choose the single best option as "recommended".`;

function regionMatches(candidateRegion: string, hardRegion: string): boolean {
  const a = candidateRegion.trim().toLowerCase();
  const b = hardRegion.trim().toLowerCase();
  return a.includes(b) || b.includes(a);
}

export async function runDestinationAgent(
  ctx: RunContext,
  deps: AgentDeps,
): Promise<AgentResult<DestinationOut>> {
  const { constraints } = ctx;
  const user = `Suggest destinations for this traveller.\n\n${describeConstraints(
    constraints,
  )}`;

  const out = await llm.generateStructured({
    system: SYSTEM,
    user,
    schema: DestinationOutSchema,
    schemaName: "DestinationOut",
    temperature: 0.7,
    onRetry: () => deps.log?.("destination output invalid, retrying…", "flag"),
  });

  const flags: ConstraintFlag[] = [];
  let candidates = out.candidates;

  // CODE-ENFORCED hard constraint: drop anything outside a required region.
  if (constraints.region) {
    const region = constraints.region;
    const removed = candidates.filter((c) => !regionMatches(c.region, region));
    if (removed.length > 0) {
      flags.push({
        kind: "hard_constraint_filtered",
        agent: "destination",
        message: `Filtered out ${removed.length} suggestion(s) outside the required region "${region}": ${removed
          .map((r) => r.name)
          .join(", ")}.`,
        detail: { removed: removed.map((r) => r.name), region },
      });
    }
    candidates = candidates.filter((c) => regionMatches(c.region, region));
  }

  if (candidates.length === 0) {
    throw new Error(
      `No suggested destination satisfied the hard region constraint "${constraints.region}".`,
    );
  }

  // Keep "recommended" pointing at a surviving candidate.
  let recommended = out.recommended;
  if (!candidates.some((c) => c.name === recommended)) {
    deps.log?.(
      `recommended "${out.recommended}" broke a hard constraint; re-picking "${candidates[0].name}"`,
      "flag",
    );
    recommended = candidates[0].name;
  }

  return { output: { candidates, recommended, notes: out.notes }, flags };
}
