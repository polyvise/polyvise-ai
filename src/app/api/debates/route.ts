import { NextRequest } from "next/server";
import { ZodError } from "zod";
import { startDebate } from "@/server/debate-store";
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
    const payload = await request.json();
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
    if (error instanceof ZodError) {
      return Response.json(
        {
          error: "Invalid debate request.",
          issues: error.issues
        },
        {
          status: 400
        }
      );
    }

    return Response.json(
      {
        error: error instanceof Error ? error.message : "Unable to start debate."
      },
      {
        status: 500
      }
    );
  }
}
