import { z } from "zod";

/** The three specialised agents. Order in an array = execution order. */
export const AGENT_NAMES = ["destination", "itinerary", "budget"] as const;
export const AgentNameSchema = z.enum(AGENT_NAMES);
export type AgentName = (typeof AGENT_NAMES)[number];

/** A hard money constraint extracted from the user's request. */
export const BudgetConstraintSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().min(1), // ISO-ish code or symbol name, e.g. "GBP"
});
export type BudgetConstraint = z.infer<typeof BudgetConstraintSchema>;

/**
 * Structured preferences the planner extracts from free text.
 * `budget`, `region`, and `knownDestination` are treated as HARD constraints
 * downstream; the rest are soft preferences.
 */
export const ConstraintsSchema = z.object({
  budget: BudgetConstraintSchema.nullable(),
  region: z.string().nullable(), // e.g. "Europe" - hard when the user states it
  knownDestination: z.string().nullable(), // set when the user already picked a place
  climate: z.string().nullable(), // "warm", "cold", "tropical", ...
  durationDays: z.number().int().positive().nullable(),
  travelMonth: z.string().nullable(),
  interests: z.array(z.string()),
  travellers: z.number().int().positive().nullable(),
  notes: z.string().nullable(), // free-form leftover nuance
});
export type Constraints = z.infer<typeof ConstraintsSchema>;
