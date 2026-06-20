import {
  AGENT_LABELS,
  type DestinationOut,
  type ItineraryOut,
  type BudgetVerdict,
} from "@trip/shared";
import {
  Loader2,
  Check,
  X,
  Minus,
  Circle,
  Star,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import type { AgentView, AgentViewStatus } from "../state/runReducer";

const STATUS_ICON: Record<
  AgentViewStatus,
  { icon: LucideIcon; color: string; spin?: boolean }
> = {
  pending: { icon: Circle, color: "text-zinc-700" },
  running: { icon: Loader2, color: "text-indigo-400", spin: true },
  completed: { icon: Check, color: "text-zinc-500" },
  failed: { icon: X, color: "text-rose-500" },
  skipped: { icon: Minus, color: "text-zinc-700" },
};

const money = (n: number, c: string) => `${n.toLocaleString()} ${c}`;

function statusLabel(a: AgentView): string {
  if (a.status === "running") return "working…";
  if (a.status === "completed") return a.durationMs ? `${a.durationMs}ms` : "done";
  return a.status;
}

export function AgentCard({ agent }: { agent: AgentView }) {
  const { icon: Icon, color, spin } = STATUS_ICON[agent.status];

  return (
    <section className="border-t border-zinc-800/60 py-5 first:border-t-0 first:pt-0">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={`h-3.5 w-3.5 ${color} ${spin ? "animate-spin" : ""}`} />
          <h3 className="text-[15px] font-medium text-zinc-200">
            {AGENT_LABELS[agent.name]}
          </h3>
        </div>
        <span className="text-xs text-zinc-600">{statusLabel(agent)}</span>
      </div>

      {agent.status === "failed" && agent.error && (
        <p className="mt-2 text-[15px] text-rose-400/90">{agent.error}</p>
      )}

      {agent.status === "running" && (
        <p className="mt-2 animate-pulse text-[15px] text-zinc-600">thinking…</p>
      )}

      {agent.status === "completed" && agent.output != null && (
        <div className="mt-3">
          {agent.name === "destination" && (
            <DestinationView data={agent.output as DestinationOut} />
          )}
          {agent.name === "itinerary" && (
            <ItineraryView data={agent.output as ItineraryOut} />
          )}
          {agent.name === "budget" && (
            <BudgetView data={agent.output as BudgetVerdict} />
          )}
        </div>
      )}
    </section>
  );
}

function DestinationView({ data }: { data: DestinationOut }) {
  const recommended = data.candidates.find((c) => c.name === data.recommended);
  const others = data.candidates.filter((c) => c.name !== data.recommended);

  return (
    <div className="space-y-4">
      {recommended && (
        <div className="rounded-lg bg-indigo-500/5 p-3 ring-1 ring-indigo-500/20">
          <div className="flex items-center gap-1.5 text-indigo-400">
            <Star className="h-3.5 w-3.5 fill-indigo-400" />
            <span className="text-[12px] font-medium uppercase tracking-wide">
              Recommended
            </span>
          </div>
          <div className="mt-1 text-[15px] font-medium text-zinc-100">
            {recommended.name}, {recommended.country}
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-zinc-400">
            {recommended.justification}
          </p>
        </div>
      )}

      {others.length > 0 && (
        <div className="space-y-2">
          <div className="text-[12px] uppercase tracking-wide text-zinc-600">
            Other options
          </div>
          {others.map((c) => (
            <div key={c.name}>
              <span className="text-[15px] text-zinc-300">
                {c.name}, {c.country}
              </span>
              <p className="mt-0.5 text-[15px] leading-relaxed text-zinc-500">
                {c.justification}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ItineraryView({ data }: { data: ItineraryOut }) {
  return (
    <div className="space-y-3">
      {data.days.map((d) => (
        <div key={d.day}>
          <div className="flex items-baseline gap-2">
            <span className="text-[15px] text-zinc-100">
              Day {d.day} · {d.title}
            </span>
            {d.confidence !== "high" && (
              <span className="text-[12px] text-amber-400/80">{d.confidence}</span>
            )}
          </div>
          <ul className="mt-1 space-y-0.5 text-[15px] text-zinc-500">
            {d.activities.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ul>
          {d.uncertaintyNote && (
            <p className="mt-1 text-xs text-amber-400/60">{d.uncertaintyNote}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function BudgetView({ data }: { data: BudgetVerdict }) {
  const over = data.status === "over";
  const hasBudget = data.budgetAmount != null;
  const remaining = hasBudget ? data.budgetAmount! - data.total : 0;
  const infeasible = data.cheaperAlternativeMeetsBudget === false;

  return (
    <div className="space-y-4">
      <table className="w-full text-[15px]">
        <tbody className="text-zinc-400">
          {data.estimate.lineItems.map((li, i) => (
            <tr key={i}>
              <td className="py-1 pr-4">{li.description}</td>
              <td className="py-1 text-right tabular-nums text-zinc-300">
                {money(li.amount, data.currency)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot className="border-t border-zinc-800">
          <tr>
            <td className="py-1.5 pr-4 text-zinc-300">Total</td>
            <td className="py-1.5 text-right font-medium tabular-nums text-zinc-100">
              {money(data.total, data.currency)}
            </td>
          </tr>
          {hasBudget && (
            <>
              <tr>
                <td className="py-1 pr-4 text-zinc-500">Budget</td>
                <td className="py-1 text-right tabular-nums text-zinc-400">
                  {money(data.budgetAmount!, data.currency)}
                </td>
              </tr>
              <tr className={over ? "text-rose-400" : "text-emerald-400"}>
                <td className="py-1 pr-4">{over ? "Over by" : "Remaining"}</td>
                <td className="py-1 text-right font-medium tabular-nums">
                  {money(Math.abs(remaining), data.currency)}
                </td>
              </tr>
            </>
          )}
          {!hasBudget && (
            <tr>
              <td className="py-1 pr-4 text-zinc-600" colSpan={2}>
                no budget set
              </td>
            </tr>
          )}
        </tfoot>
      </table>

      {infeasible && (
        <div className="flex items-start gap-2 rounded-lg bg-rose-500/10 p-3 text-[15px] text-rose-300/90">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            This trip isn't realistic at {money(data.budgetAmount!, data.currency)} -
            even the cheapest option is well above it.
          </span>
        </div>
      )}

      {data.cheaperAlternative && (
        <div className="border-l border-zinc-700 pl-3">
          <div className="text-[12px] uppercase tracking-wide text-indigo-400">
            Cheaper option · ~
            {money(
              data.cheaperAlternative.newEstimatedTotal,
              data.cheaperAlternative.currency,
            )}
          </div>
          <p className="mt-1 text-[15px] leading-relaxed text-zinc-400">
            {data.cheaperAlternative.summary}
          </p>
          <ul className="mt-1 space-y-0.5 text-[15px] text-zinc-500">
            {data.cheaperAlternative.changes.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
