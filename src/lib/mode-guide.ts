import type {
  CouncilSize,
  DebateMode,
  DebateRequest,
} from "@polyvise/core/debate/types";
import type { SlotId } from "./model-catalog";

export const modeOrder: DebateMode[] = [
  "hybrid_council",
  "consensus",
  "advisory_panel",
];

export const defaultQuestion = "Should cities make public transit free?";
export const exampleQuestions = [
  defaultQuestion,
  "Should our engineering team adopt a four-day workweek?",
  "Should a startup build its own authentication system?",
];

export const modeGuide = {
  hybrid_council: {
    name: "Debate",
    goal: "Make a decision",
    prompt: "Should we do it?",
    description:
      "Debaters present cases for and against the decision. A neutral judge reviews both sides.",
    outcome: "Judge’s recommendation",
    start: "Start the debate",
    href: "/debate",
    placeholder: defaultQuestion,
    examples: exampleQuestions,
    steps: [
      "Frame the question and gather evidence",
      "Hear both sides across four debate rounds",
      "Read the judge’s review and final synthesis",
    ],
    outputs: [
      "Recommendation & confidence",
      "Strongest case on each side",
      "What would change the verdict",
    ],
    rule: "The judge weighs evidence, practicality, risk, fairness and reversibility. Confidence is the model’s assessment, not a measured probability.",
  },
  consensus: {
    name: "Consensus",
    goal: "Find common ground",
    prompt: "Where do views converge?",
    description:
      "Independent perspectives answer, compare their reasoning, then revise or retain their positions.",
    outcome: "Agreement and remaining differences",
    start: "Find common ground",
    href: "/consensus",
    placeholder: defaultQuestion,
    examples: exampleQuestions,
    steps: [
      "Gather evidence and assign independent perspectives",
      "Answer alone, then revise after seeing other views",
      "Measure stance agreement and preserve holdouts",
    ],
    outputs: [
      "Shared answer & remaining range",
      "How positions changed each round",
      "Holdouts and their reasoning",
    ],
    rule: "Every selected round runs. Agreement is calculated from stance spread; it does not establish that the answer is correct. There is no judge or winning side.",
  },
  advisory_panel: {
    name: "Advisory panel",
    goal: "Explore a strategy",
    prompt: "What am I missing?",
    description:
      "Four advisors assess the plan. A chair summarizes their advice and disagreements.",
    outcome: "Panel summary and guidance",
    start: "Convene the panel",
    href: "/panel",
    placeholder: defaultQuestion,
    examples: exampleQuestions,
    steps: [
      "Frame the strategy and gather evidence",
      "Get independent advice from all four lenses",
      "Let the chair surface agreements, conflicts and guidance",
    ],
    outputs: [
      "Advice, risks & conditions by lens",
      "Where the advisors agree or clash",
      "Practical decision guidance",
    ],
    rule: "The economist, ethicist, operator and skeptic advise independently. The chair synthesizes their views without declaring a winner. These are AI perspectives, not human experts.",
  },
} satisfies Record<
  DebateMode,
  {
    name: string;
    goal: string;
    prompt: string;
    description: string;
    outcome: string;
    start: string;
    href: string;
    placeholder: string;
    examples: string[];
    steps: string[];
    outputs: string[];
    rule: string;
  }
>;

export function parseMode(value: string | undefined): DebateMode {
  return modeOrder.find((mode) => mode === value) ?? "hybrid_council";
}

export function modelSlotsForMode(
  mode: DebateMode,
  councilSize: CouncilSize = "quartet",
): { id: SlotId; title: string; description: string }[] {
  const judge = {
    id: "judge" as const,
    title: "Neutral judge",
    description:
      "Reviews the arguments, scores both sides and writes the verdict.",
  };
  if (mode === "hybrid_council")
    return councilSize === "duo"
      ? [
          {
            id: "yes",
            title: "For the decision",
            description:
              "Builds the supporting claims and speaks for this side in every debate round.",
          },
          {
            id: "no",
            title: "Against the decision",
            description:
              "Builds the opposing claims and speaks against the decision in every debate round.",
          },
          judge,
        ]
      : [
          {
            id: "quick",
            title: "Opening, questions & closing",
            description:
              "Creates the initial perspectives and writes both sides in these rounds.",
          },
          {
            id: "deep",
            title: "Claims & rebuttals",
            description:
              "Builds the evidence-linked claims and writes both sides’ rebuttals.",
          },
          judge,
        ];
  return [
    {
      id: "deep",
      title:
        mode === "consensus" ? "Independent perspectives" : "All four advisors",
      description: "Each perspective gets a separate call using this model.",
    },
    {
      id: "judge",
      title: mode === "consensus" ? "Summary writer" : "Panel chair",
      description: "Synthesizes the answers while preserving disagreements.",
    },
    ...(mode === "consensus"
      ? [
          {
            id: "quick" as const,
            title: "Perspective designer",
            description:
              "Creates the distinct analytical lenses before the first round.",
          },
        ]
      : []),
  ];
}

export interface ComposerSettings {
  subject: string;
  context: string;
  mode: DebateMode;
  councilSize: CouncilSize;
  agentCount: number;
  rounds: number;
  models: Record<SlotId, string>;
}

/** Only send settings that the selected engine actually consumes. */
export function buildRunRequest(settings: ComposerSettings): DebateRequest {
  const { subject, context, mode, councilSize, agentCount, rounds, models } =
    settings;
  return {
    subject: subject.trim(),
    context: context.trim() || undefined,
    mode,
    evidence: "cited",
    models: Object.fromEntries(
      modelSlotsForMode(mode, councilSize).map(({ id }) => [id, models[id]]),
    ),
    ...(mode === "hybrid_council" ? { councilSize } : {}),
    ...(mode === "consensus" ? { consensus: { agentCount, rounds } } : {}),
  };
}
