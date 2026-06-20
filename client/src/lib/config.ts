// Base URL of the backend. Empty in dev -> relative "/api" via the Vite proxy.
export const API_BASE = import.meta.env.VITE_API_URL ?? "";

const SESSION_KEY = "trip-advisor-session";

/** Stable per-browser session id, persisted across refreshes in localStorage. */
export function getSessionId(): string {
  let id = localStorage.getItem(SESSION_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(SESSION_KEY, id);
  }
  return id;
}

/** HH:MM:SS clock stamp for terminal lines (computed outside the reducer). */
export function nowHHMMSS(): string {
  return new Date().toTimeString().slice(0, 8);
}
