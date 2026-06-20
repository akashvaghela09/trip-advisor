import { z } from "zod";

/* ----------------------------- Destination ------------------------------ */

export const DestinationCandidateSchema = z.object({
  name: z.string(),
  country: z.string(),
  /** Continent/area, checked in code against a hard `region` constraint. */
  region: z.string(),
  /** Required: each suggestion must be justified against stated preferences. */
  justification: z.string(),
  climateMatch: z.string(),
  approxBudgetFit: z.enum(["under", "around", "over", "unknown"]),
  highlights: z.array(z.string()),
});

export const DestinationOutSchema = z.object({
  candidates: z.array(DestinationCandidateSchema).min(1),
  recommended: z.string(),
  notes: z.string().nullable(),
});
export type DestinationOut = z.infer<typeof DestinationOutSchema>;

/* ------------------------------ Itinerary ------------------------------- */

export const ItineraryDaySchema = z.object({
  day: z.number().int().positive(),
  title: z.string(),
  activities: z.array(z.string()),
  /** Realism of travel time / sequencing for the day. */
  travelNotes: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
  /** Required to be populated whenever confidence is not high. */
  uncertaintyNote: z.string().nullable(),
});

export const ItineraryOutSchema = z.object({
  destination: z.string(),
  durationDays: z.number().int().positive(),
  days: z.array(ItineraryDaySchema).min(1),
  overallNotes: z.string().nullable(),
});
export type ItineraryOut = z.infer<typeof ItineraryOutSchema>;

/* -------------------------------- Budget -------------------------------- */

export const BUDGET_CATEGORIES = [
  "flights",
  "accommodation",
  "food",
  "activities",
  "local_transport",
  "other",
] as const;

export const BudgetLineItemSchema = z.object({
  category: z.enum(BUDGET_CATEGORIES),
  description: z.string(),
  amount: z.number().nonnegative(),
});

/** Raw estimate produced by the budget agent. Total is recomputed in code. */
export const BudgetEstimateSchema = z.object({
  currency: z.string().min(1),
  lineItems: z.array(BudgetLineItemSchema).min(1),
  assumptions: z.array(z.string()),
});
export type BudgetEstimate = z.infer<typeof BudgetEstimateSchema>;

/** Produced by a second budget call only when the plan is over budget. */
export const CheaperAlternativeSchema = z.object({
  summary: z.string(),
  changes: z.array(z.string()),
  newEstimatedTotal: z.number().nonnegative(),
  currency: z.string().min(1),
});
export type CheaperAlternative = z.infer<typeof CheaperAlternativeSchema>;

export type BudgetStatus = "within" | "over" | "no_budget";

/**
 * The authoritative budget verdict - computed in code, never by the LLM.
 * This is what guarantees the budget is never *silently* exceeded.
 */
export interface BudgetVerdict {
  estimate: BudgetEstimate;
  total: number;
  budgetAmount: number | null;
  currency: string;
  status: BudgetStatus;
  overageAmount: number; // 0 when within budget
  cheaperAlternative: CheaperAlternative | null;
  /** Whether the cheaper alternative actually meets the budget (null if N/A). */
  cheaperAlternativeMeetsBudget: boolean | null;
}
