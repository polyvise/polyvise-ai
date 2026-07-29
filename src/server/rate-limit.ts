import type { NextRequest } from "next/server";

/**
 * A fixed-window limiter for the endpoints that cost money to serve.
 *
 * State is per-instance and in memory, so with several Cloud Run instances the
 * effective ceiling is this limit times the instance count, and a restart
 * forgets everything. That is genuinely weak against a determined attacker —
 * it exists to stop a casual scripted loop from draining the provider budget,
 * which is the realistic threat. Anything stronger belongs at the edge
 * (Cloud Armor) rather than in the app.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(request: NextRequest, name: string): string {
  // Cloud Run puts the caller first in X-Forwarded-For.
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return `${name}:${forwarded || "unknown"}`;
}

function sweep(now: number): void {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Returns a 429 response when the caller is over budget, or null to proceed.
 */
export function rateLimit(
  request: NextRequest,
  { name, limit, windowMs }: { name: string; limit: number; windowMs: number }
): Response | null {
  const now = Date.now();
  sweep(now);

  const key = clientKey(request, name);
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= limit) {
    return null;
  }

  const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  return Response.json(
    { error: `Too many requests. Try again in ${retryAfter}s.` },
    {
      status: 429,
      headers: { "Retry-After": String(retryAfter), "Cache-Control": "no-store" }
    }
  );
}
