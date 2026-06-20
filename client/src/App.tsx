import { useState } from "react";
import { Clock } from "lucide-react";
import type { RunRecord } from "@trip/shared";
import { useRunContext } from "./state/RunProvider";
import { hydrateFromRecord } from "./state/hydrate";
import { InputBar } from "./components/InputBar";
import { RoutingBlock } from "./components/RoutingBlock";
import { AgentCard } from "./components/AgentCard";
import { FinalAnswer } from "./components/FinalAnswer";
import { EventTerminal } from "./components/EventTerminal";
import { HistoryPanel } from "./components/HistoryPanel";
import { RateLimitBanner } from "./components/RateLimitBanner";

export default function App() {
  const { state, dispatch } = useRunContext();
  const [historyOpen, setHistoryOpen] = useState(false);

  const onView = (record: RunRecord) => {
    dispatch({ type: "hydrate", state: hydrateFromRecord(record) });
    setHistoryOpen(false);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-zinc-800/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-100">
            Trip Advisor
          </h1>
          <button
            onClick={() => setHistoryOpen(true)}
            className="flex items-center gap-1.5 text-xs text-zinc-500 transition hover:text-zinc-200"
          >
            <Clock className="h-3.5 w-3.5" />
            History
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-6 py-9 lg:grid-cols-[300px_1fr]">
        <div className="order-2 lg:order-1 lg:sticky lg:top-8 lg:h-[calc(100vh-4rem)]">
          <EventTerminal />
        </div>

        <div className="order-1 lg:order-2 space-y-6">
          <InputBar />

          {state.source === "history" && (
            <div className="flex items-center justify-between text-xs text-zinc-500">
              <span>Viewing a past run.</span>
              <button
                onClick={() => dispatch({ type: "reset" })}
                className="text-zinc-400 underline-offset-2 hover:text-zinc-200 hover:underline"
              >
                New request
              </button>
            </div>
          )}

          <RateLimitBanner />

          {state.error && !state.rateLimit && (
            <p className="text-sm text-rose-400">{state.error}</p>
          )}

          <RoutingBlock />

          {state.agents.length > 0 && (
            <div>
              {state.agents.map((a) => (
                <AgentCard key={a.name} agent={a} />
              ))}
            </div>
          )}

          <FinalAnswer />

          {state.phase === "idle" && (
            <p className="pt-8 text-center text-sm text-zinc-600">
              Describe a trip to see the agents plan it.
            </p>
          )}
        </div>
      </main>

      <HistoryPanel
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        onView={onView}
        currentRunId={state.runId}
      />
    </div>
  );
}
