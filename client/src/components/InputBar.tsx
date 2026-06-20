import { useState, type KeyboardEvent } from "react";
import { useRunStream } from "../hooks/useRunStream";

const EXAMPLES = [
  "5 days somewhere warm in Europe under £1500",
  "Plan a 4-day cultural trip to Lisbon",
  "Is £800 enough for a 3-day foodie weekend in Rome?",
];

export function InputBar() {
  const { submit, isRunning } = useRunStream();
  const [value, setValue] = useState("");

  const send = () => {
    if (value.trim() && !isRunning) submit(value);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div>
      <div className="flex items-stretch gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Describe your trip…"
          className="min-h-[3rem] flex-1 resize-none rounded-lg bg-zinc-900 px-4 py-3 text-[15px] text-zinc-100 outline-none ring-1 ring-zinc-800 transition placeholder:text-zinc-600 focus:ring-zinc-600"
        />
        <button
          onClick={send}
          disabled={isRunning || !value.trim()}
          className="shrink-0 rounded-lg bg-indigo-500 px-6 text-[15px] font-medium text-white transition hover:bg-indigo-400 disabled:bg-zinc-800 disabled:text-zinc-600"
        >
          {isRunning ? "Planning…" : "Plan"}
        </button>
      </div>
      <div className="mt-3 flex flex-col gap-1 text-[13px] text-zinc-600 sm:flex-row sm:flex-wrap sm:gap-x-4">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            onClick={() => setValue(ex)}
            disabled={isRunning}
            className="text-left transition hover:text-zinc-400 disabled:opacity-50"
          >
            {ex}
          </button>
        ))}
      </div>
    </div>
  );
}
