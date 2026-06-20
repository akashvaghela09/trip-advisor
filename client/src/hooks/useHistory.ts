import { useCallback, useState } from "react";
import type { RunSummary, RunRecord } from "@trip/shared";
import { API_BASE, getSessionId } from "../lib/config";

/** Fetches this session's run history and individual stored runs. */
export function useHistory() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/runs?sessionId=${encodeURIComponent(getSessionId())}`,
      );
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch {
      /* leave existing list */
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRun = useCallback(
    async (id: string): Promise<RunRecord | null> => {
      try {
        const res = await fetch(`${API_BASE}/api/runs/${id}`);
        if (!res.ok) return null;
        const data = await res.json();
        return data.run ?? null;
      } catch {
        return null;
      }
    },
    [],
  );

  return { runs, loading, refresh, loadRun };
}
