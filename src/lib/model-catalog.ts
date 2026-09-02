import {
  getAvailableModels,
  type ModelCompatibility,
  type ModelProvider,
  type ModelSpeed,
  type ModelTier
} from "@polyvise/core/models/catalog";

/**
 * The five seats the engine routes model calls to. Each maps to a field of
 * core's DebateModelSelection; the engine picks the seat from the step's role.
 *
 * - yes:   the pro scouts and the pro debaters
 * - no:    the con scouts and the con debaters
 * - deep:  claim building (the argument inventory both sides draw on)
 * - judge: the neutral scout, the scorecard and the verdict
 * - quick: framing, team building and evidence grading
 */
export type SlotId = "yes" | "no" | "deep" | "judge" | "quick";

export interface ModelOption {
  id: string;
  label: string;
  provider: ModelProvider;
  speed: ModelSpeed;
  tier: ModelTier;
  reasoning: boolean;
  compatibility: ModelCompatibility;
  compatibilityNote?: string;
  notes?: string;
}

export interface SlotMeta {
  id: SlotId;
  title: string;
  description: string;
  envVar: string;
}

export const slots: SlotMeta[] = [
  {
    id: "yes",
    title: "Pro side",
    description: "The two pro scouts and the debaters arguing for, across all four rounds.",
    envVar: "POLYVISE_YES_MODEL"
  },
  {
    id: "no",
    title: "Con side",
    description: "The two con scouts and the debaters arguing against. Same as the pro side unless you change it.",
    envVar: "POLYVISE_NO_MODEL"
  },
  {
    id: "deep",
    title: "Claims",
    description: "Writes the pro and con claims both sides argue from, each tied to its sources. Worth a stronger model.",
    envVar: "POLYVISE_DEEP_MODEL"
  },
  {
    id: "judge",
    title: "Judge",
    description: "The neutral scout, the scorecard and the verdict. Kept independent of both sides.",
    envVar: "POLYVISE_JUDGE_MODEL"
  },
  {
    id: "quick",
    title: "Framing & evidence",
    description: "Turns the question into a resolution, builds the teams and grades sources. Fast and cheap is fine here.",
    envVar: "POLYVISE_QUICK_MODEL"
  }
];

export const modelCatalog: ModelOption[] = getAvailableModels().map((model) => ({
  id: model.id,
  label: model.label,
  provider: model.provider,
  speed: model.speed,
  tier: model.tier,
  reasoning: model.reasoning,
  compatibility: model.compatibility,
  compatibilityNote: model.compatibilityNote,
  notes: model.notes
}));

/** Pro and con start on the same model so neither side has a head start. */
export const defaultSelections: Record<SlotId, string> = {
  yes: "google/gemini-2.5-flash",
  no: "google/gemini-2.5-flash",
  deep: "openai/gpt-5.5",
  judge: "google/gemini-2.5-flash",
  quick: "google/gemini-2.5-flash"
};

export function isKnownModel(id: string): boolean {
  return modelCatalog.some((entry) => entry.id === id);
}
