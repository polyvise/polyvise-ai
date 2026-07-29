import {
  getAvailableModels,
  type ModelCompatibility,
  type ModelProvider,
  type ModelSpeed,
  type ModelTier
} from "@polyvise/core/models/catalog";

export type SlotId = "quick" | "deep" | "judge";

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
    id: "quick",
    title: "Pro agents & scouts",
    description: "Fast turns: stance scouts and opening pro statements.",
    envVar: "POLYVISE_QUICK_MODEL"
  },
  {
    id: "deep",
    title: "Con agents & claims",
    description: "Heavier reasoning: claim building and rebuttals.",
    envVar: "POLYVISE_DEEP_MODEL"
  },
  {
    id: "judge",
    title: "Judge",
    description: "Neutral synthesis: scorecard and final summary.",
    envVar: "POLYVISE_JUDGE_MODEL"
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

export const defaultSelections: Record<SlotId, string> = {
  quick: "google/gemini-2.5-flash",
  deep: "openai/gpt-5.5",
  judge: "google/gemini-2.5-flash"
};

export function isKnownModel(id: string): boolean {
  return modelCatalog.some((entry) => entry.id === id);
}
