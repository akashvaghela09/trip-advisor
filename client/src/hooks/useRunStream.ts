import { useCallback, useRef } from "react";
import { useRunContext } from "../state/RunProvider";
import { parseSseStream } from "../lib/sseParser";
import { API_BASE, getSessionId, nowHHMMSS } from "../lib/config";

/** Drives a live planning run: POST -> read SSE -> dispatch into the reducer. */
export function useRunStream() {
  const { state, dispatch } = useRunContext();
  const abortRef = useRef<AbortController | null>(null);

  const submit = useCallback(
    async (query: string) => {
      const q = query.trim();
      if (!q) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      dispatch({ type: "submit", query: q, at: nowHHMMSS() });

      try {
        const res = await fetch(`${API_BASE}/api/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: q, sessionId: getSessionId() }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const txt = await res.text().catch(() => "");
          dispatch({
            type: "fatal",
            message: `Request failed (${res.status}). ${txt}`.trim(),
            at: nowHHMMSS(),
          });
          return;
        }

        for await (const event of parseSseStream(res.body)) {
          dispatch({ type: "event", event, at: nowHHMMSS() });
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        dispatch({
          type: "fatal",
          message: err instanceof Error ? err.message : String(err),
          at: nowHHMMSS(),
        });
      }
    },
    [dispatch],
  );

  /** Re-run the same query as a brand-new run (the Retry button). */
  const retry = useCallback(() => {
    if (state.query) void submit(state.query);
  }, [state.query, submit]);

  const isRunning = state.phase === "running";

  return { submit, retry, isRunning };
}
