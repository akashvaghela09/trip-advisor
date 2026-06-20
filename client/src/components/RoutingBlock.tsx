import { AGENT_LABELS } from "@trip/shared";
import { ArrowRight } from "lucide-react";
import { useRunContext } from "../state/RunProvider";

export function RoutingBlock() {
  const { state } = useRunContext();
  if (!state.plan) return null;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-zinc-300">
        {state.plan.agents.map((a, i) => (
          <span key={a} className="flex items-center gap-2">
            {AGENT_LABELS[a].replace(" Agent", "")}
            {i < state.plan!.agents.length - 1 && (
              <ArrowRight className="h-3.5 w-3.5 text-zinc-600" />
            )}
          </span>
        ))}
      </div>
      <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
        {state.plan.reasoning}
      </p>
    </div>
  );
}
