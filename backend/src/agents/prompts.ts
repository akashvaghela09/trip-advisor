import type { Constraints, ItineraryOut } from "@trip/shared";

/** Renders extracted constraints as readable prompt context. */
export function describeConstraints(c: Constraints): string {
  const lines: string[] = [];
  if (c.budget)
    lines.push(`Budget (HARD limit): ${c.budget.amount} ${c.budget.currency} total`);
  if (c.region) lines.push(`Region (HARD): ${c.region}`);
  if (c.knownDestination) lines.push(`Chosen destination: ${c.knownDestination}`);
  if (c.climate) lines.push(`Climate preference: ${c.climate}`);
  if (c.durationDays) lines.push(`Duration: ${c.durationDays} days`);
  if (c.travelMonth) lines.push(`Travel month: ${c.travelMonth}`);
  if (c.travellers) lines.push(`Travellers: ${c.travellers}`);
  if (c.interests.length) lines.push(`Interests: ${c.interests.join(", ")}`);
  if (c.notes) lines.push(`Other notes: ${c.notes}`);
  return lines.length ? lines.join("\n") : "No specific preferences stated.";
}

export function summariseItinerary(itin: ItineraryOut): string {
  return itin.days
    .map((d) => `Day ${d.day}: ${d.title} - ${d.activities.join("; ")}`)
    .join("\n");
}

export const round2 = (n: number): number => Math.round(n * 100) / 100;
