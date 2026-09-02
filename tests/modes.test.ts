import { describe, expect, it } from "vitest";
import { startDebate } from "@/server/debate-store";
import { toRunSummary } from "@/lib/run-summary";
import {
  asAdvisoryPanelRun,
  asConsensusRun,
  asDebateRun,
  countAgentOutputs,
  recordMode,
  storedRunMode
} from "@/lib/run-record";
import type { PolyviseRecord } from "@/lib/run-record";

describe("running each mode through the app boundary", () => {
  it("stores a consensus run as an envelope the surface can narrow", async () => {
    const { completion } = await startDebate({
      subject: "Should we move billing off a single vendor?",
      mode: "consensus",
      consensus: { agentCount: 3, rounds: 2 }
    });
    const record = await completion;

    expect(record.status).toBe("complete");
    expect(recordMode(record)).toBe("consensus");

    const consensus = asConsensusRun(record.latestRun!);
    expect(consensus).not.toBeNull();
    expect(consensus!.result.agents).toHaveLength(3);
    expect(consensus!.result.rounds).toHaveLength(2);
    // A consensus run is not a debate, and asking for one must not invent it.
    expect(asDebateRun(record.latestRun!)).toBeNull();
  });

  it("stores an advisory panel run with one piece of advice per lens", async () => {
    const { completion } = await startDebate({
      subject: "Should we move billing off a single vendor?",
      mode: "advisory_panel"
    });
    const record = await completion;

    expect(recordMode(record)).toBe("advisory_panel");
    const panel = asAdvisoryPanelRun(record.latestRun!);
    expect(panel).not.toBeNull();
    expect(panel!.result.advice).toHaveLength(4);
    expect(asDebateRun(record.latestRun!)).toBeNull();
  });

  it("still stores a hybrid council run flat, so old records stay readable", async () => {
    const { completion } = await startDebate({
      subject: "Should schools have longer recess?"
    });
    const record = await completion;

    expect(recordMode(record)).toBe("hybrid_council");
    expect(storedRunMode(record.latestRun!)).toBe("hybrid_council");
    // Flat, not wrapped: the field is reachable without an envelope.
    expect(asDebateRun(record.latestRun!)?.turns.length).toBeGreaterThan(0);
    expect(asConsensusRun(record.latestRun!)).toBeNull();
  });
});

describe("run summaries across modes", () => {
  function baseRecord(): Omit<PolyviseRecord, "latestRun"> {
    return {
      id: "debate_x",
      subject: "Should we move billing off a single vendor?",
      mode: "consensus",
      evidence: "cited",
      status: "complete",
      resolution: "Should we move billing off a single vendor?",
      topicKind: "decision",
      highStakes: null,
      createdAt: "2026-08-09T00:00:00.000Z",
      updatedAt: "2026-08-09T00:00:00.000Z",
      productNotes: [],
      followups: []
    };
  }

  it("reports convergence rather than a recommendation for consensus", async () => {
    const { completion } = await startDebate({
      subject: "Should we move billing off a single vendor?",
      mode: "consensus",
      consensus: { agentCount: 3, rounds: 2 }
    });
    const record = await completion;
    const summary = toRunSummary(record);

    expect(summary.mode).toBe("Consensus");
    expect(["Converged", "No consensus"]).toContain(summary.verdict);
    expect(summary.confidence).not.toBeNull();
  });

  it("reports whether the panel split", async () => {
    const { completion } = await startDebate({
      subject: "Should we move billing off a single vendor?",
      mode: "advisory_panel"
    });
    const summary = toRunSummary(await completion);

    expect(summary.mode).toBe("Advisory panel");
    expect(["Aligned", "Split panel"]).toContain(summary.verdict);
    expect(summary.detail).toBe("4 lenses");
  });

  it("leaves a run with no verdict blank rather than guessing one", () => {
    const summary = toRunSummary({ ...baseRecord(), status: "queued" });

    expect(summary.verdict).toBeNull();
    expect(summary.confidence).toBeNull();
    expect(summary.costUsd).toBe(0);
  });
});

describe("telemetry counts work across modes", () => {
  it("counts positions for consensus and advice for the panel", async () => {
    const consensus = await (
      await startDebate({
        subject: "Should we move billing off a single vendor?",
        mode: "consensus",
        consensus: { agentCount: 3, rounds: 2 }
      })
    ).completion;
    const panel = await (
      await startDebate({
        subject: "Should we move billing off a single vendor?",
        mode: "advisory_panel"
      })
    ).completion;

    // 3 agents over 2 rounds.
    expect(countAgentOutputs(consensus.latestRun!)).toBe(6);
    expect(countAgentOutputs(panel.latestRun!)).toBe(4);
  });
});
