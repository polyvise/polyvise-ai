import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

export const ADMIN_COOKIE = "polyvise_admin";

/**
 * Admin access is a single shared token held in the environment — enough for a
 * one-operator view, and swappable for Cloud IAP later without touching the
 * pages themselves.
 *
 * When no token is configured the admin surface does not exist at all: every
 * check returns false and the routes 404. Failing closed matters more here
 * than a helpful error, because the alternative is an unguarded page that
 * lists every visitor's question.
 */
function configuredToken(): string | null {
  const token = process.env.POLYVISE_ADMIN_TOKEN?.trim();
  return token ? token : null;
}

export function adminEnabled(): boolean {
  return configuredToken() !== null;
}

/** Length-independent constant-time comparison. */
function matches(candidate: string, expected: string): boolean {
  const a = createHash("sha256").update(candidate).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export function isAdminToken(candidate: string): boolean {
  const expected = configuredToken();
  return expected !== null && matches(candidate, expected);
}

export async function isAdmin(): Promise<boolean> {
  const expected = configuredToken();
  if (!expected) return false;

  const cookie = (await cookies()).get(ADMIN_COOKIE)?.value;
  return typeof cookie === "string" && matches(cookie, expected);
}
