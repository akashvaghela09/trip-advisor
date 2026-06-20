import {
  createContext,
  useContext,
  useReducer,
  type ReactNode,
  type Dispatch,
} from "react";
import {
  runReducer,
  initialRunState,
  type RunViewState,
  type RunAction,
} from "./runReducer";

interface RunContextValue {
  state: RunViewState;
  dispatch: Dispatch<RunAction>;
}

const RunContext = createContext<RunContextValue | null>(null);

export function RunProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(runReducer, initialRunState);
  return (
    <RunContext.Provider value={{ state, dispatch }}>
      {children}
    </RunContext.Provider>
  );
}

export function useRunContext(): RunContextValue {
  const ctx = useContext(RunContext);
  if (!ctx) throw new Error("useRunContext must be used within RunProvider");
  return ctx;
}
