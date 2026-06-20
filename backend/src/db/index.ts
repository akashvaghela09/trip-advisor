import { config } from "../config.js";
import { SqliteRunRepository } from "./sqlite.js";
import type { RunRepository } from "./repository.js";

/** Single repository instance. Swap the implementation here to change the DB. */
export const repository: RunRepository = new SqliteRunRepository(config.dbPath);

export * from "./repository.js";
