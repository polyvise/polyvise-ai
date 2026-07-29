import { afterEach, describe, expect, it } from "vitest";
import type { NextRequest } from "next/server";
import { isAdminToken, adminEnabled } from "@/server/admin";
import { rateLimit } from "@/server/rate-limit";

const ORIGINAL_TOKEN = process.env.POLYVISE_ADMIN_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) {
    delete process.env.POLYVISE_ADMIN_TOKEN;
  } else {
    process.env.POLYVISE_ADMIN_TOKEN = ORIGINAL_TOKEN;
  }
});

/** Minimal stand-in — rateLimit only reads one header. */
function requestFrom(ip: string): NextRequest {
  return { headers: new Headers({ "x-forwarded-for": ip }) } as unknown as NextRequest;
}

describe("admin gate", () => {
  it("is disabled when no token is configured", () => {
    delete process.env.POLYVISE_ADMIN_TOKEN;
    expect(adminEnabled()).toBe(false);
    // Critically, an empty candidate must not authenticate against an unset token.
    expect(isAdminToken("")).toBe(false);
    expect(isAdminToken("anything")).toBe(false);
  });

  it("treats a blank configured token as no token at all", () => {
    process.env.POLYVISE_ADMIN_TOKEN = "   ";
    expect(adminEnabled()).toBe(false);
    expect(isAdminToken("   ")).toBe(false);
  });

  it("accepts only the exact token", () => {
    process.env.POLYVISE_ADMIN_TOKEN = "s3cret-token";
    expect(isAdminToken("s3cret-token")).toBe(true);
    expect(isAdminToken("s3cret-toke")).toBe(false);
    expect(isAdminToken("s3cret-token ")).toBe(false);
    expect(isAdminToken("")).toBe(false);
  });
});

describe("rate limit", () => {
  it("allows up to the limit, then rejects", () => {
    const options = { name: `t${Math.random()}`, limit: 3, windowMs: 60_000 };
    const request = requestFrom("203.0.113.9");

    expect(rateLimit(request, options)).toBeNull();
    expect(rateLimit(request, options)).toBeNull();
    expect(rateLimit(request, options)).toBeNull();

    const blocked = rateLimit(request, options);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
  });

  it("counts each caller separately", () => {
    const options = { name: `t${Math.random()}`, limit: 1, windowMs: 60_000 };

    expect(rateLimit(requestFrom("198.51.100.1"), options)).toBeNull();
    expect(rateLimit(requestFrom("198.51.100.1"), options)?.status).toBe(429);
    // A different caller is unaffected by the first one's spending.
    expect(rateLimit(requestFrom("198.51.100.2"), options)).toBeNull();
  });

  it("starts a fresh window once the old one expires", async () => {
    const options = { name: `t${Math.random()}`, limit: 1, windowMs: 20 };
    const request = requestFrom("192.0.2.7");

    expect(rateLimit(request, options)).toBeNull();
    expect(rateLimit(request, options)?.status).toBe(429);

    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(rateLimit(request, options)).toBeNull();
  });
});
