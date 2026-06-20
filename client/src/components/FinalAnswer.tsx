import { AGENT_LABELS } from "@trip/shared";
import { useRunContext } from "../state/RunProvider";
import { useRunStream } from "../hooks/useRunStream";

export function FinalAnswer() {
  const { state } = useRunContext();
  const { retry, isRunning } = useRunStream();

  if (!state.summary && !state.answer) return null;

  return (
    <section className="border-t border-zinc-800/60 pt-5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-600">
          summary
        </span>
        {state.query && (
          <button
            onClick={retry}
            disabled={isRunning}
            className="text-xs text-zinc-500 transition hover:text-zinc-200 disabled:opacity-50"
          >
            retry
          </button>
        )}
      </div>

      <p className="whitespace-pre-wrap text-base leading-relaxed text-zinc-200">
        {state.summary}
        {isRunning && (
          <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-zinc-500 align-text-bottom" />
        )}
      </p>

      {state.answer && state.answer.contributors.length > 0 && (
        <p className="mt-4 text-[13px] text-zinc-600">
          via{" "}
          {state.answer.contributors.map((c) => AGENT_LABELS[c].replace(" Agent", "")).join(" · ")}
        </p>
      )}
    </section>
  );
}
