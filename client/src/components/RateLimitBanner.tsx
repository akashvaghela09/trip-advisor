import { useEffect, useState } from "react";
import { useRunContext } from "../state/RunProvider";
import { useRunStream } from "../hooks/useRunStream";

export function RateLimitBanner() {
  const { state } = useRunContext();
  const { retry } = useRunStream();
  const [secs, setSecs] = useState(0);

  useEffect(() => {
    setSecs(state.rateLimit?.retryAfterSec ?? 0);
  }, [state.rateLimit]);

  useEffect(() => {
    if (secs <= 0) return;
    const t = setTimeout(() => setSecs((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secs]);

  if (!state.rateLimit) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg bg-amber-500/10 px-4 py-2.5 text-sm text-amber-300/90">
      <span>{state.rateLimit.message}</span>
      <button
        onClick={retry}
        disabled={secs > 0}
        className="shrink-0 text-xs font-medium text-amber-300 transition hover:text-amber-200 disabled:text-amber-300/40"
      >
        {secs > 0 ? `retry in ${secs}s` : "retry"}
      </button>
    </div>
  );
}
