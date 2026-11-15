import { withSupplementalModels, type ModelOption } from "@/lib/model-catalog";
import { getHealth, listModels } from "./polyvise-api";

/** What the interface shows about the engine behind it. Either part is null when the API can't be reached. */
export interface EngineInfo {
  /** The Polyvise API's version. */
  version: string | null;
  models: ModelOption[] | null;
}

const TTL_MS = 5 * 60 * 1000;

let catalog: { models: ModelOption[]; fetchedAt: number } | null = null;

/**
 * The model catalog, from the Polyvise API. Cached briefly because it changes
 * only when the API is redeployed; a stale copy is served if a refresh fails.
 */
export async function getModelCatalog(): Promise<ModelOption[]> {
  if (catalog && Date.now() - catalog.fetchedAt < TTL_MS) {
    return catalog.models;
  }
  try {
    catalog = { models: withSupplementalModels(await listModels()), fetchedAt: Date.now() };
  } catch (error) {
    if (!catalog) throw error;
  }
  return catalog.models;
}

export async function getEngineInfo(): Promise<EngineInfo> {
  const [models, health] = await Promise.all([
    getModelCatalog().catch(() => null),
    getHealth().catch(() => null)
  ]);
  return { models, version: health?.version ?? null };
}
