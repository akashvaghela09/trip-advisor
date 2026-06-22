import { config } from "../config.js";
import { PostgresRunRepository } from "./postgres.js";
import type { RunRepository } from "./repository.js";

/** Single repository instance. Swap the implementation here to change the DB. */
export const repository: RunRepository = new PostgresRunRepository(
  config.databaseUrl,
);

export * from "./repository.js";
