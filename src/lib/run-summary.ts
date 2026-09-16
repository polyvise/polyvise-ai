import type { DebateRecord } from "@polyvise/core/debate/types";
import type { ConsensusStance } from "@polyvise/core/runs/types";
import { asAdvisoryPanelRun, asConsensusRun, asDebateRun, type PolyviseRecord } from "@/lib/run-record";
import { formatRecommendation, recommendationTone } from "./run-view";

/**
 * The row shape both run lists render. Deliberately narrow: enough to identify
 * and rank a run, without shipping transcripts or context around.
 */
export interface RunSummary {
  id: string;
  title: string;
  mode: string;
  status: DebateRecord["status"];
  verdict: string | null;
  verdictTone: "pro" | "con" | "judge" | null;
  failedStep: string | null;
  failureReason: string | null;
  confidence: number | null;
  confidenceKind: "confidence" | "agreement" | null;
  /** One extra fact the mode wants surfaced, such as its final stance distribution. */
  detail: string | null;
  costUsd: number;
  createdAt: string;
}

/**
 * Every mode reports an outcome, but not the same one: the council returns a
 * recommendation, consensus returns whether the panel converged, and the
 * advisory panel returns whether its advisors lined up. Each is reduced to a
 * verdict and a percentage so one table can rank all three.
 */
export function toRunSummary(record: PolyviseRecord): RunSummary {
  const run = record.latestRun;
  const isComplete = record.status === "complete";

  const shared = {
    id: record.id,
    title: record.resolution || record.subject,
    status: record.status,
    failedStep: record.failedStep ?? run?.trace.find((entry) => entry.status === "failed")?.step ?? null,
    failureReason: record.failureReason ?? null,
    costUsd: run?.modelSnapshots.reduce((sum, snapshot) => sum + (snapshot.estimatedCostUsd ?? 0), 0) ?? 0,
    createdAt: record.createdAt
  };

  if (!run && record.mode !== "hybrid_council") {
    return {
      ...shared,
      mode: record.mode === "consensus" ? "Consensus" : "Advisory panel",
      verdict: null,
      verdictTone: null,
      confidence: null,
      confidenceKind: null,
      detail: null
    };
  }

  const consensus = run ? asConsensusRun(run) : null;
  if (consensus) {
    const { convergence, rounds } = consensus.result;
    return {
      ...shared,
      mode: "Consensus",
      verdict: isComplete ? (convergence.converged ? "Converged" : "Panel remained split") : null,
      // Convergence is agreement, not endorsement, so a converged panel is
      // teal and a split one is amber — never the judge's violet.
      verdictTone: isComplete ? (convergence.converged ? "pro" : "con") : null,
      confidence: isComplete ? Math.round(convergence.agreementLevel * 100) : null,
      confidenceKind: isComplete ? "agreement" : null,
      detail: isComplete ? consensusStanceBreakdown(rounds.at(-1)?.positions ?? []) : null
    };
  }

  const panel = run ? asAdvisoryPanelRun(run) : null;
  if (panel) {
    const { chair, advice } = panel.result;
    return {
      ...shared,
      mode: "Advisory panel",
      verdict: isComplete ? (chair.conflicts.length ? "Split panel" : "Aligned") : null,
      verdictTone: isComplete ? (chair.conflicts.length ? "con" : "pro") : null,
      confidence: isComplete ? Math.round(chair.confidence) : null,
      confidenceKind: isComplete ? "confidence" : null,
      detail: isComplete ? `${advice.length} lenses` : null
    };
  }

  const debate = run ? asDebateRun(run) : null;
  const scorecard = debate?.scorecard;
  return {
    ...shared,
    mode: debate?.councilSize === "duo" ? "Debate · 1 vs 1" : "Debate · 2 vs 2",
    verdict: isComplete && scorecard ? formatRecommendation(scorecard.recommendation) : null,
    verdictTone: isComplete && scorecard ? recommendationTone(scorecard.recommendation) : null,
    confidence: isComplete && scorecard ? Math.round(scorecard.confidence * 100) : null,
    confidenceKind: isComplete && scorecard ? "confidence" : null,
    detail: null
  };
}

export function consensusStanceBreakdown(positions: Array<{ stance: ConsensusStance }>): string | null {
  if (!positions.length) return null;
  const counts = positions.reduce(
    (total, position) => {
      if (position.stance === "agree" || position.stance === "strongly_agree") total.agree += 1;
      else if (position.stance === "neutral") total.neutral += 1;
      else total.disagree += 1;
      return total;
    },
    { agree: 0, neutral: 0, disagree: 0 },
  );

  return (["agree", "neutral", "disagree"] as const)
    .filter((stance) => counts[stance] > 0)
    .map((stance) => `${counts[stance]} ${stance}`)
    .join(" · ");
}
