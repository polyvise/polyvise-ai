import { getModelCatalog } from "./engine-info";
import { askLab, getRuntime, type LabAnswer } from "./polyvise-api";

export type { LabAnswer };

/** Every selected model is a paid call, so the fan-out stays deliberately small. */
export const LAB_MAX_MODELS = 3;

export interface LabProviderStatus {
  configured: boolean;
  /**
   * True when the engine is answering from deterministic templates. The lab has
   * to say so — a mock answer next to a real one is worse than no answer.
   */
  mock: boolean;
}

/**
 * Whether the Polyvise API can reach real models. The lab always asks them
 * directly, never the engine's deterministic templates, so `mock` stays false.
 */
export async function labProviderStatus(): Promise<LabProviderStatus> {
  const runtime = await getRuntime().catch(() => null);
  return { configured: Boolean(runtime?.providers.openrouter), mock: false };
}

export async function availableLabModels() {
  if (!(await labProviderStatus()).configured) return [];
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Unable to check OpenRouter model availability.");
  const catalog = await response.json() as { data: { id: string; supported_parameters?: string[] }[] };
  const available = new Set(catalog.data.filter(model => model.supported_parameters?.includes("structured_outputs")).map(model => model.id));
  return (await getModelCatalog()).filter(model => available.has(model.id) && model.compatibility !== "experimental");
}

/**
 * Asks each model the same question through the Polyvise API, which addresses
 * every model directly and never substitutes a deterministic answer.
 */
export async function runModelLab(prompt: string, models: string[]): Promise<LabAnswer[]> {
  const available = await availableLabModels();
  if (models.some(id => !available.some(model => model.id === id))) {
    throw new Error("A selected model is unavailable through OpenRouter. Refresh the model list and try again.");
  }
  return askLab(prompt, [...new Set(models)].slice(0, LAB_MAX_MODELS));
}
