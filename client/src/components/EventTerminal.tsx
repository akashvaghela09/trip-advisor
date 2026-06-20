import { useEffect, useRef } from "react";
import {
  ChevronRight,
  GitBranch,
  TriangleAlert,
  CircleX,
  Check,
  type LucideIcon,
} from "lucide-react";
import { useRunContext } from "../state/RunProvider";
import type { TerminalLevel } from "../state/runReducer";

const LEVEL: Record<TerminalLevel, { color: string; icon: LucideIcon }> = {
  info: { color: "text-zinc-500", icon: ChevronRight },
  decision: { color: "text-zinc-300", icon: GitBranch },
  flag: { color: "text-amber-400/80", icon: TriangleAlert },
  error: { color: "text-rose-400/90", icon: CircleX },
  success: { color: "text-zinc-400", icon: Check },
};

export function EventTerminal() {
  const { state } = useRunContext();
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [state.terminal.length]);

  return (
    <aside className="flex h-full flex-col">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600">
        trace
      </div>
      <div className="flex-1 overflow-auto pr-1 font-mono text-[12px] leading-relaxed">
        {state.terminal.length === 0 ? (
          <p className="text-zinc-700">Awaiting a request…</p>
        ) : (
          state.terminal.map((line, i) => {
            const { color, icon: Icon } = LEVEL[line.level];
            return (
              <div key={i} className="flex items-start gap-1.5 py-px">
                <span className="shrink-0 text-zinc-700">{line.ts}</span>
                <Icon className={`mt-[3px] h-3 w-3 shrink-0 ${color}`} />
                <span className={`${color} break-words`}>{line.text}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </aside>
  );
}
