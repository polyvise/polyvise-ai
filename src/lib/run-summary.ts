import type { DebateRecord } from "@polyvise/core/debate/types";
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
  confidence: number | null;
  costUsd: number;
  createdAt: string;
}

export function toRunSummary(record: DebateRecord): RunSummary {
  const run = record.latestRun;
  const scorecard = run?.scorecard;
  const isComplete = record.status === "complete";

  return {
    id: record.id,
    title: record.resolution || record.subject,
    mode: run?.councilSize === "duo" ? "Duo" : "Council",
    status: record.status,
    verdict: isComplete && scorecard ? formatRecommendation(scorecard.recommendation) : null,
    verdictTone: isComplete && scorecard ? recommendationTone(scorecard.recommendation) : null,
    failedStep: run?.trace.find((entry) => entry.status === "failed")?.step ?? null,
    confidence: isComplete && scorecard ? Math.round(scorecard.confidence * 100) : null,
    costUsd: run?.modelSnapshots.reduce((sum, snapshot) => sum + (snapshot.estimatedCostUsd ?? 0), 0) ?? 0,
    createdAt: record.createdAt
  };
}
