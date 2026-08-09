import type { DebateRecord, DebateRun, DebateMode } from "@polyvise/core/debate/types";
import type { AdvisoryPanelRunEnvelope, ConsensusRunEnvelope } from "@polyvise/core/runs/types";

/**
 * What a completed run looks like in storage, across all three modes.
 *
 * The hybrid council still stores the flat `DebateRun` it always has — records
 * written before the other modes existed are exactly that shape, and rewriting
 * them to gain an envelope would buy nothing. Consensus and the advisory panel
 * store the envelope, because they have no flat equivalent.
 */
export type StoredRun = DebateRun | ConsensusRunEnvelope | AdvisoryPanelRunEnvelope;

/**
 * A debate record whose `latestRun` may be any mode.
 *
 * Core's `DebateRecord` types `latestRun` as `DebateRun`, which was right when
 * one mode existed. Widening it there would break every consumer that reads
 * `record.latestRun.summary`, so the wider type lives here instead — the whole
 * record is persisted as one jsonb blob, so this is purely a type-level
 * distinction and needs no migration.
 */
export type PolyviseRecord = Omit<DebateRecord, "latestRun"> & {
  latestRun?: StoredRun;
};

/**
 * An envelope has a `result`; the flat debate run does not.
 *
 * Only the two newer modes are ever stored as envelopes — the hybrid council
 * is written flat — so narrowing away an envelope leaves a `DebateRun`.
 */
export function isEnvelope(run: StoredRun): run is ConsensusRunEnvelope | AdvisoryPanelRunEnvelope {
  return "result" in run;
}

/**
 * The mode a stored run was produced by.
 *
 * A run stored without an envelope can only be a hybrid council, so that is a
 * fact about the shape rather than a guess.
 */
export function storedRunMode(run: StoredRun): DebateMode {
  return isEnvelope(run) ? run.result.mode : "hybrid_council";
}

/**
 * The mode a record should be rendered as.
 *
 * Prefers the run's own mode over the record's requested mode: if a run
 * completed, what it actually produced is the truth. The requested mode only
 * decides the view while the run is still in flight.
 */
export function recordMode(record: PolyviseRecord): DebateMode {
  return record.latestRun ? storedRunMode(record.latestRun) : record.mode;
}

export function asConsensusRun(run: StoredRun): ConsensusRunEnvelope | null {
  if (!isEnvelope(run) || run.result.mode !== "consensus") {
    return null;
  }
  return run as ConsensusRunEnvelope;
}

export function asAdvisoryPanelRun(run: StoredRun): AdvisoryPanelRunEnvelope | null {
  if (!isEnvelope(run) || run.result.mode !== "advisory_panel") {
    return null;
  }
  return run as AdvisoryPanelRunEnvelope;
}

/** The flat debate run, or null when this run came from another mode. */
export function asDebateRun(run: StoredRun): DebateRun | null {
  return isEnvelope(run) ? null : run;
}

/**
 * A record narrowed to the hybrid council, for the surfaces and summaries that
 * only know how to read a debate.
 */
export function asDebateRecord(record: PolyviseRecord): DebateRecord {
  const run = record.latestRun ? asDebateRun(record.latestRun) : null;
  return { ...record, ...(run ? { latestRun: run } : { latestRun: undefined }) };
}

/**
 * How many model-authored contributions a run produced.
 *
 * Each mode calls them something different — debate turns, consensus positions,
 * panel advice — but they are the same quantity for telemetry: one unit of
 * work a model was asked to do and did.
 */
export function countAgentOutputs(run: StoredRun): number {
  if (!isEnvelope(run)) {
    return run.turns.length;
  }
  if (run.result.mode === "consensus") {
    return run.result.rounds.reduce((total, round) => total + round.positions.length, 0);
  }
  return run.result.advice.length;
}

export const modeLabels: Record<DebateMode, string> = {
  hybrid_council: "Hybrid Council",
  consensus: "Consensus",
  advisory_panel: "Advisory Panel"
};
