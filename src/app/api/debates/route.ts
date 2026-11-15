import { NextRequest } from "next/server";
import { DEBATE_UNAVAILABLE_MESSAGE, startDebate } from "@/server/debate-store";
import { PolyviseApiError } from "@/server/polyvise-api";
import { rateLimit } from "@/server/rate-limit";

/**
 * Listing every debate is an admin concern. This endpoint used to return the
 * whole collection unauthenticated, which handed one visitor's question to the
 * next. Callers wanting their own runs use POST /api/runs/lookup; the admin
 * view reads the repository directly, behind its token.
 */
export async function GET() {
  return Response.json({ error: "Not found." }, { status: 404 });
}

export async function POST(request: NextRequest) {
  const limited = rateLimit(request, { name: "debates", limit: 5, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  try {
    const payload = await request.json().catch(() => null);
    const { debate } = await startDebate(payload);

    return Response.json(
      {
        debate
      },
      {
        status: 202,
        headers: {
          "Cache-Control": "no-store"
        }
      }
    );
  } catch (error) {
    if (error instanceof PolyviseApiError && error.invalidRequest) {
      return Response.json(
        {
          error: "Invalid debate request.",
          issues: error.issues ?? []
        },
        {
          status: 400
        }
      );
    }

    // The visitor can't act on an engine outage or a misconfigured key, so the
    // detail goes to the log and they get something they can act on.
    console.error("[polyvise.run.start_failed]", {
      status: error instanceof PolyviseApiError ? error.status : undefined,
      reason: error instanceof Error ? error.message.slice(0, 500) : "Unknown error"
    });
    return Response.json(
      {
        error: DEBATE_UNAVAILABLE_MESSAGE
      },
      {
        status: 502
      }
    );
  }
}
