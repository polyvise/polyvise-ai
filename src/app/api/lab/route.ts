import { NextRequest } from "next/server";
import { z } from "zod";
import { LAB_MAX_MODELS, runModelLab } from "@/server/model-lab";
import { rateLimit } from "@/server/rate-limit";

export const dynamic = "force-dynamic";

const labRequestSchema = z.object({
  prompt: z.string().trim().min(4, "Ask something longer than that.").max(2000),
  models: z.array(z.string()).min(1, "Pick at least one model.").max(LAB_MAX_MODELS)
});

export async function POST(request: NextRequest) {
  // Each lab call fans out to several models at once, so it gets a tighter
  // budget than starting a single debate.
  const limited = rateLimit(request, { name: "lab", limit: 3, windowMs: 60_000 });
  if (limited) {
    return limited;
  }

  try {
    const { prompt, models } = labRequestSchema.parse(await request.json());
    return Response.json({ answers: await runModelLab(prompt, models) }, {
      headers: { "Cache-Control": "no-store" }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json({ error: error.issues[0]?.message ?? "Invalid lab request." }, { status: 400 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Unable to run the lab." },
      { status: 500 }
    );
  }
}
