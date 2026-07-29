"use client";

/**
 * "Your runs" is kept in the browser, not on the server.
 *
 * The app has no accounts, so the only honest way to show someone their own
 * history is to remember it client-side. The upside is that the server never
 * needs an identifier for an anonymous visitor: nothing links a stored debate
 * back to a person. The trade-off is that clearing site data loses the list,
 * and it doesn't follow you to another browser.
 */
const KEY = "polyvise-runs";
const LIMIT = 50;

export function readLocalRunIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function rememberLocalRun(id: string): void {
  if (typeof window === "undefined") return;
  try {
    const next = [id, ...readLocalRunIds().filter((existing) => existing !== id)].slice(0, LIMIT);
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // A full or blocked localStorage shouldn't stop the run from starting.
  }
}

export function forgetLocalRuns(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}
