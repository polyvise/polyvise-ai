import { loadDebateRuntimeConfig } from "@polyvise/core/debate/config";
import {
  LlmProviderFailure,
  OpenRouterLlmProvider
} from "@polyvise/core/providers/llm";
import { modelCatalog } from "@/lib/model-catalog";
import type { ModelSnapshot } from "@polyvise/core/debate/types";

/** Every selected model is a paid call, so the fan-out stays deliberately small. */
export const LAB_MAX_MODELS = 3;

export interface LabAnswer {
  model: string;
  answer: string | null;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  failure?: string;
}

/**
 * The lab asks every model the same thing, so the response shape is fixed and
 * deliberately small — one direct answer, no scaffolding to compare across.
 */
const answerSchema = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: {
    answer: {
      type: "string",
      description: "A direct answer to the question in at most four sentences."
    }
  }
} as const;

/**
 * The lab addresses each model directly via `LlmRequest.model` (polyvise-core
 * 0.3.4+). The slot overrides below are belt and braces: on an older core the
 * per-call field is ignored, and role routing would quietly answer every entry
 * with the same model under different labels.
 */
function providerForModel(model: string) {
  const base = loadDebateRuntimeConfig();
  const config = {
    ...base,
    quickModel: model,
    deepModel: model,
    yesModel: model,
    noModel: model,
    judgeModel: model,
    // A lab answer is worth nothing if it's the engine's deterministic filler.
    allowDeterministicFallbacks: false
  };

  return new OpenRouterLlmProvider({ ...config, enableMockLlm: false });
}

export interface LabProviderStatus {
  configured: boolean;
  /**
   * True when the engine is answering from deterministic templates. The lab has
   * to say so — a mock answer next to a real one is worse than no answer.
   */
  mock: boolean;
}

export function labProviderStatus(): LabProviderStatus {
  const provider = providerForModel(modelCatalog[0].id);
  return { configured: provider.configured, mock: false };
}

export async function availableLabModels() {
  if (!labProviderStatus().configured) return [];
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10000)
  });
  if (!response.ok) throw new Error("Unable to check OpenRouter model availability.");
  const catalog = await response.json() as { data: { id: string; supported_parameters?: string[] }[] };
  const available = new Set(catalog.data.filter(model => model.supported_parameters?.includes("structured_outputs")).map(model => model.id));
  return modelCatalog.filter(model => available.has(model.id) && model.compatibility !== "experimental");
}

export async function runModelLab(prompt: string, models: string[]): Promise<LabAnswer[]> {
  const available = await availableLabModels();
  if (models.some(id => !available.some(model => model.id === id))) {
    throw new Error("A selected model is unavailable through OpenRouter. Refresh the model list and try again.");
  }
  const targets = [...new Set(models)].slice(0, LAB_MAX_MODELS);

  return Promise.all(
    targets.map(async (model): Promise<LabAnswer> => {
      try {
        const { data, snapshot } = await providerForModel(model).generateStructured<{ answer: string }>({
          role: "model lab",
          model,
          schemaName: "labAnswerOutput",
          prompt,
          jsonSchema: answerSchema as unknown as Record<string, unknown>,
          fallback: { answer: "" }
        });

        const answer = data.answer?.trim() ?? "";

        return {
          model,
          // An empty string is the fallback shape coming back untouched, not an
          // answer — report it as a miss rather than rendering a blank card.
          answer: answer || null,
          latencyMs: snapshot.latencyMs,
          promptTokens: snapshot.promptTokens,
          completionTokens: snapshot.completionTokens,
          estimatedCostUsd: snapshot.estimatedCostUsd,
          ...(answer ? {} : { failure: "The model returned an empty answer." })
        };
      } catch (error) {
        const snapshot = error instanceof LlmProviderFailure ? (error.snapshot as ModelSnapshot) : null;
        return {
          model,
          answer: null,
          latencyMs: snapshot?.latencyMs,
          failure: error instanceof Error ? error.message : "The model didn't return a usable answer."
        };
      }
    })
  );
}
