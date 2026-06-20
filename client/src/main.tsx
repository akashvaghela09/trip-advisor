import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { RunProvider } from "./state/RunProvider";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RunProvider>
      <App />
    </RunProvider>
  </React.StrictMode>,
);
