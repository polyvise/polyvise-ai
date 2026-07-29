import type {
  ArgumentEdge,
  ArgumentNode,
  Claim,
  DebateLiveEvent,
  DebateRecord,
  DebateRound,
  DebateRun,
  DebateStatus,
  DebateSummary,
  DebateTeam,
  EvidenceSource,
  HighStakesNotice,
  ModelSnapshot,
  PlaceholderInfo,
  RoundTurn,
  Scorecard,
  StanceScout,
  TopicKind
} from "@polyvise/core/debate/types";

export type StepId = "scouts" | "claims" | "turns" | "scorecard" | "summary";

export const stepLabels: Record<StepId, string> = {
  scouts: "Stance scouts",
  claims: "Pro and con arguments",
  turns: "Debate turns",
  scorecard: "Judge scorecard",
  summary: "Final verdict"
};

export const roundOrder: DebateRound[] = [
  "opening",
  "cross_examination",
  "rebuttal",
  "closing",
  "judge_review",
  "synthesis"
];

export const roundLabels: Record<DebateRound, string> = {
  opening: "Opening",
  cross_examination: "Cross-examination",
  rebuttal: "Rebuttal",
  closing: "Closing",
  judge_review: "Judge review",
  synthesis: "Synthesis"
};

export type RunViewState = {
  debateId: string;
  subject: string;
  status: DebateStatus;
  resolution?: string;
  topicKind?: TopicKind;
  highStakes: HighStakesNotice | null;
  scouts: StanceScout[];
  teams: DebateTeam | null;
  sources: EvidenceSource[];
  claims: Claim[];
  argumentNodes: ArgumentNode[];
  argumentEdges: ArgumentEdge[];
  turns: RoundTurn[];
  scorecard: Scorecard | null;
  summary: DebateSummary | null;
  snapshots: ModelSnapshot[];
  /**
   * Steps that fell back to deterministic placeholder content. When a step is
   * in here, the corresponding data on this state IS the fallback — the UI
   * must NOT render it as a real answer.
   */
  fallbacks: Partial<Record<StepId, PlaceholderInfo>>;
  /** Per-round turn failures, so one bad round doesn't hide the good ones. */
  turnFailuresByRound: Partial<Record<DebateRound, PlaceholderInfo>>;
  errorMessage: string | null;
  done: boolean;
};

export type RunViewAction =
  | { type: "event"; event: DebateLiveEvent }
  | { type: "hydrate"; record: DebateRecord };

/** Role fragments the engine uses when asking a model to produce each step. */
const roundRoleFragments: Array<[DebateRound, string]> = [
  ["opening", "opening round"],
  ["cross_examination", "cross-examination round"],
  ["rebuttal", "rebuttal round"],
  ["closing", "closing round"],
  ["judge_review", "judge review round"],
  ["synthesis", "synthesis round"]
];

/**
 * The engine seeds every run with one snapshot per configured slot before any
 * call is made. They share the model roster's fixed ids, and counting them as
 * calls would inflate every "N model calls" figure in the app.
 */
const rosterSnapshotIds = new Set(["polyvise-quick", "polyvise-deep", "polyvise-yes", "polyvise-no", "polyvise-judge"]);

export function isRosterSnapshot(snapshot: ModelSnapshot): boolean {
  return rosterSnapshotIds.has(snapshot.id);
}

/**
 * Maps a recorded model call back to the pipeline step that made it.
 *
 * Fallback ids are matched by prefix: core 0.3.3 emitted a bare
 * `fallback-<schemaName>`, and 0.3.4 appends the role to keep them unique.
 */
export function stepForSnapshot(snapshot: ModelSnapshot): { step: StepId; round?: DebateRound } | null {
  const role = snapshot.role?.toLowerCase() ?? "";
  const id = snapshot.id ?? "";

  if (role.includes("stance scout") || id.startsWith("fallback-scoutOutput")) {
    return { step: "scouts" };
  }
  if (role.includes("claim builder") || id.startsWith("fallback-claimOutput")) {
    return { step: "claims" };
  }
  if (role.includes("scorecard") || id.startsWith("fallback-judgeScorecardOutput")) {
    return { step: "scorecard" };
  }
  if (role.includes("final summary") || id.startsWith("fallback-finalSummaryOutput")) {
    return { step: "summary" };
  }
  for (const [round, fragment] of roundRoleFragments) {
    if (role.includes(fragment)) {
      return { step: "turns", round };
    }
  }
  if (id.startsWith("fallback-debateTurnOutput")) {
    return { step: "turns" };
  }
  return null;
}

/**
 * Reconstructs which steps fell back from the model snapshots alone.
 *
 * Only needed for runs stored before polyvise-core 0.3.4, which recorded no
 * `placeholders` on the run. Without it a reloaded page would render the
 * engine's deterministic filler as if a model had written it. Snapshots are
 * the surviving evidence: one only carries `failure` when its step fell back.
 *
 * It is lossy — pre-0.3.4 fallback snapshots for repeated steps shared an id
 * and collapsed on merge — so prefer `run.placeholders` when it exists.
 */
export function deriveFallbacks(snapshots: ModelSnapshot[]): {
  fallbacks: RunViewState["fallbacks"];
  turnFailuresByRound: RunViewState["turnFailuresByRound"];
} {
  const fallbacks: RunViewState["fallbacks"] = {};
  const turnFailuresByRound: RunViewState["turnFailuresByRound"] = {};

  for (const snapshot of snapshots) {
    if (!snapshot.failure) continue;
    const match = stepForSnapshot(snapshot);
    if (!match) continue;

    const info: PlaceholderInfo = { requestedModel: snapshot.model, reason: snapshot.failure };
    fallbacks[match.step] = info;
    if (match.step === "turns" && match.round) {
      turnFailuresByRound[match.round] = info;
    }
  }

  return { fallbacks, turnFailuresByRound };
}

/**
 * The engine's own account of what fell back, when it recorded one. Absent on
 * runs stored before polyvise-core 0.3.4 — those fall back to snapshot
 * archaeology.
 */
function fallbacksFromRun(run: DebateRun | undefined): {
  fallbacks: RunViewState["fallbacks"];
  turnFailuresByRound: RunViewState["turnFailuresByRound"];
} | null {
  const recorded = run?.placeholders;
  if (!recorded) return null;

  const fallbacks: RunViewState["fallbacks"] = {};
  if (recorded.scouts) fallbacks.scouts = recorded.scouts;
  if (recorded.claims) fallbacks.claims = recorded.claims;
  if (recorded.scorecard) fallbacks.scorecard = recorded.scorecard;
  if (recorded.summary) fallbacks.summary = recorded.summary;

  const turnFailuresByRound: RunViewState["turnFailuresByRound"] = { ...recorded.turns };
  const firstRound = Object.values(turnFailuresByRound)[0];
  if (firstRound) fallbacks.turns = firstRound;

  return { fallbacks, turnFailuresByRound };
}

export function initialStateFromRecord(record: DebateRecord): RunViewState {
  const run = record.latestRun;
  const snapshots = run?.modelSnapshots ?? [];
  const { fallbacks, turnFailuresByRound } =
    fallbacksFromRun(run) ?? deriveFallbacks(snapshots);

  return {
    debateId: record.id,
    subject: record.subject,
    status: record.status,
    resolution: record.resolution,
    topicKind: record.topicKind,
    highStakes: record.highStakes,
    scouts: run?.scouts ?? [],
    teams: run?.teams ?? null,
    sources: run?.sources ?? [],
    claims: run?.claims ?? [],
    argumentNodes: run?.argumentNodes ?? [],
    argumentEdges: run?.argumentEdges ?? [],
    turns: run?.turns ?? [],
    scorecard: run?.scorecard ?? null,
    summary: run?.summary ?? null,
    snapshots,
    fallbacks,
    turnFailuresByRound,
    errorMessage: null,
    done: record.status === "complete" || record.status === "failed"
  };
}

function mergeFallback(
  current: RunViewState["fallbacks"],
  step: StepId,
  placeholder: PlaceholderInfo | undefined
): RunViewState["fallbacks"] {
  if (!placeholder) return current;
  return { ...current, [step]: placeholder };
}

export function runViewReducer(state: RunViewState, action: RunViewAction): RunViewState {
  if (action.type === "hydrate") {
    // The persisted record is authoritative once the run is over, but it has
    // no memory of a stream-level error, so that message is carried across.
    return { ...initialStateFromRecord(action.record), errorMessage: state.errorMessage };
  }

  const event = action.event;
  switch (event.kind) {
    case "stage":
      return { ...state, status: event.status };
    case "framed":
      return {
        ...state,
        resolution: event.resolution,
        topicKind: event.topicKind,
        highStakes: event.highStakes
      };
    case "scouts":
      return {
        ...state,
        scouts: event.scouts,
        fallbacks: mergeFallback(state.fallbacks, "scouts", event.placeholder)
      };
    case "teams":
      return { ...state, teams: event.teams };
    case "sources":
      return { ...state, sources: event.sources };
    case "claims":
      return {
        ...state,
        claims: event.claims,
        fallbacks: mergeFallback(state.fallbacks, "claims", event.placeholder)
      };
    case "argument_map":
      return { ...state, argumentNodes: event.nodes, argumentEdges: event.edges };
    case "turns": {
      // Each turns event carries one round. A round that fell back contributes
      // an inline failure in its slot instead of its (placeholder) turns.
      const withoutRound = state.turns.filter((turn) => turn.round !== event.round);
      return {
        ...state,
        turns: event.placeholder ? withoutRound : [...withoutRound, ...event.turns],
        turnFailuresByRound: event.placeholder
          ? { ...state.turnFailuresByRound, [event.round]: event.placeholder }
          : state.turnFailuresByRound,
        fallbacks: mergeFallback(state.fallbacks, "turns", event.placeholder)
      };
    }
    case "scorecard":
      return {
        ...state,
        scorecard: event.scorecard,
        fallbacks: mergeFallback(state.fallbacks, "scorecard", event.placeholder)
      };
    case "summary":
      return {
        ...state,
        summary: event.summary,
        fallbacks: mergeFallback(state.fallbacks, "summary", event.placeholder)
      };
    case "model_snapshot":
      return { ...state, snapshots: [...state.snapshots, event.snapshot] };
    case "complete":
      return { ...state, status: "complete", done: true };
    case "error":
      return { ...state, status: "failed", done: true, errorMessage: event.message };
    default:
      return state;
  }
}

export function groupTurnsByRound(turns: RoundTurn[]): Partial<Record<DebateRound, RoundTurn[]>> {
  return turns.reduce<Partial<Record<DebateRound, RoundTurn[]>>>((groups, turn) => {
    (groups[turn.round] ??= []).push(turn);
    return groups;
  }, {});
}

export function formatRecommendation(recommendation: Scorecard["recommendation"]): string {
  switch (recommendation) {
    case "lean_yes":
      return "Lean yes";
    case "lean_no":
      return "Lean no";
    case "conditional_yes":
      return "Conditional yes";
    case "conditional_no":
      return "Conditional no";
    case "mixed":
    default:
      return "Mixed";
  }
}

export function recommendationTone(recommendation: Scorecard["recommendation"]): "pro" | "con" | "judge" {
  switch (recommendation) {
    case "lean_yes":
    case "conditional_yes":
      return "pro";
    case "lean_no":
    case "conditional_no":
      return "con";
    default:
      return "judge";
  }
}

export function stageLabel(status: DebateStatus): string {
  switch (status) {
    case "queued":
      return "queued";
    case "framing":
      return "framing the question";
    case "researching":
      return "gathering evidence";
    case "debating":
      return "agents are debating";
    case "judging":
      return "judge is synthesizing";
    case "complete":
      return "done";
    case "partial":
      return "finished with gaps";
    case "failed":
      return "failed";
    default:
      return status;
  }
}

/** Short source reference used on turn footers and in the evidence ledger. */
export function sourceRef(sources: EvidenceSource[], sourceId: string): string {
  const index = sources.findIndex((source) => source.id === sourceId);
  return index < 0 ? sourceId : `S-${String(index + 1).padStart(2, "0")}`;
}

export function formatCost(usd: number): string {
  if (usd <= 0) return "$0.00";
  return usd < 0.01 ? `$${usd.toFixed(4)}` : `$${usd.toFixed(2)}`;
}

export function formatTokens(tokens: number): string {
  if (tokens <= 0) return "—";
  return tokens >= 1000 ? `${(tokens / 1000).toFixed(1)}k` : String(tokens);
}

export function formatLatency(ms: number | undefined): string {
  if (!ms) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}
