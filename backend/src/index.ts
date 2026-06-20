import express from "express";
import cors from "cors";
import { config } from "./config.js";
import { planRouter } from "./routes/plan.js";
import { runsRouter } from "./routes/runs.js";

const app = express();
app.use(express.json());
app.use(
  cors({
    origin: config.allowedOrigins.length ? config.allowedOrigins : true,
  }),
);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api", planRouter);
app.use("/api", runsRouter);

app.listen(config.port, () =>
  console.log(
    `[api] listening on :${config.port} (origins: ${
      config.allowedOrigins.join(", ") || "*"
    })`,
  ),
);
