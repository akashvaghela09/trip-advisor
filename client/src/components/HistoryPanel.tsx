import { useEffect } from "react";
import { X } from "lucide-react";
import { AGENT_LABELS, type RunRecord, type RunStatus } from "@trip/shared";
import { useHistory } from "../hooks/useHistory";

const STATUS_COLOR: Record<RunStatus, string> = {
  completed: "text-zinc-500",
  partial: "text-amber-400/80",
  failed: "text-rose-400/80",
  running: "text-indigo-400",
};

export function HistoryPanel({
  open,
  onClose,
  onView,
  currentRunId,
}: {
  open: boolean;
  onClose: () => void;
  onView: (record: RunRecord) => void;
  currentRunId: string | null;
}) {
  const { runs, loading, refresh, loadRun } = useHistory();

  useEffect(() => {
    if (open) void refresh();
  }, [open, refresh]);

  const select = async (id: string) => {
    const record = await loadRun(id);
    if (record) onView(record);
  };

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-10 bg-black/50"
          onClick={onClose}
          aria-hidden
        />
      )}
      <aside
        className={`fixed right-0 top-0 z-20 flex h-full w-[340px] max-w-[88vw] flex-col border-l border-zinc-800 bg-zinc-950 transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4">
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600">
            history {loading && "· loading"}
          </span>
          <button
            onClick={onClose}
            className="text-zinc-600 transition hover:text-zinc-300"
            aria-label="Close history"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-3 pb-4">
          {runs.length === 0 && !loading && (
            <p className="px-2 text-sm text-zinc-600">No requests yet.</p>
          )}
          <ul>
            {runs.map((r) => (
              <li key={r.id}>
                <button
                  onClick={() => void select(r.id)}
                  className={`w-full rounded-lg px-2 py-2.5 text-left transition hover:bg-zinc-900 ${
                    r.id === currentRunId ? "bg-zinc-900" : ""
                  }`}
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="line-clamp-1 text-[15px] text-zinc-200">
                      {r.userMessage}
                    </span>
                    <span className={`shrink-0 text-[11px] ${STATUS_COLOR[r.status]}`}>
                      {r.status}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-zinc-600">
                    {r.agents
                      .map((a) => AGENT_LABELS[a].replace(" Agent", ""))
                      .join(" → ") || "-"}
                    {r.hasOverBudgetFlag && (
                      <span className="text-rose-400/70"> · over budget</span>
                    )}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </>
  );
}
