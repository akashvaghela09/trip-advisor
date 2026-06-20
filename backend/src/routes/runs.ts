import { Router } from "express";
import { repository } from "../db/index.js";

export const runsRouter = Router();

/** GET /api/runs?sessionId=... -> recent runs for the session (history list). */
runsRouter.get("/runs", async (req, res) => {
  const sessionId =
    typeof req.query.sessionId === "string" ? req.query.sessionId : "";
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const runs = await repository.listRuns(sessionId);
  res.json({ runs });
});

/** GET /api/runs/:id -> a full run with its agent steps (audit view). */
runsRouter.get("/runs/:id", async (req, res) => {
  const run = await repository.getRun(req.params.id);
  if (!run) {
    res.status(404).json({ error: "run not found" });
    return;
  }
  res.json({ run });
});
