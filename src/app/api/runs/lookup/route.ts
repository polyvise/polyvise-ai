import { NextRequest } from "next/server";
import { z } from "zod";
import { getDebate } from "@/server/debate-store";
import { toRunSummary } from "@/lib/run-summary";

export const dynamic = "force-dynamic";

const lookupSchema = z.object({
  ids: z.array(z.string().trim().min(1).max(80)).max(50)
});

/**
 * Resolves a caller's own run ids into summaries.
 *
 * POST rather than GET so the ids stay out of URLs and access logs, and it
 * only ever returns records that were asked for by id — there is no way to
 * enumerate other people's runs through it.
 */
export async function POST(request: NextRequest) {
  try {
    const { ids } = lookupSchema.parse(await request.json());
    const records = await Promise.all(ids.map((id) => getDebate(id).catch(() => null)));

    return Response.json(
      { runs: records.flatMap((record) => (record ? [toRunSummary(record)] : [])) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: "Invalid lookup request." }, { status: 400 });
    }
    return Response.json({ error: "Unable to load runs." }, { status: 500 });
  }
}
