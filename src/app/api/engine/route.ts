import { getEngineInfo } from "@/server/engine-info";

export const dynamic = "force-dynamic";

/** The model catalog and engine version, for the model pickers and the footer. */
export async function GET() {
  const info = await getEngineInfo();
  return Response.json(info, {
    headers: {
      // Only a complete answer is worth keeping; a partial one should be retried.
      "Cache-Control": info.models && info.version ? "public, max-age=300" : "no-store"
    }
  });
}
