import { z } from "zod";
import { AgentNameSchema, ConstraintsSchema } from "./constraints.js";

/**
 * The planner's output: which agents to run, in what order, the extracted
 * constraints, and why. The LLM proposes this; the executor (code) runs it.
 */
export const PlanSchema = z.object({
  agents: z.array(AgentNameSchema).min(1),
  constraints: ConstraintsSchema,
  reasoning: z.string(),
});
export type Plan = z.infer<typeof PlanSchema>;

/** Request body for POST /api/plan. */
export interface PlanRequest {
  message: string;
  sessionId: string;
}
