import { describe, expect, it } from "vitest";
import { startDebate } from "@/server/debate-store";
import { runBrief } from "@/lib/run-export";
import {
  asConsensusRun,
  asAdvisoryPanelRun,
  asDebateRun,
} from "@/lib/run-record";
import { modeOrder } from "@/lib/mode-guide";

describe("portable run briefs", () => {
  it.each(modeOrder)(
    "exports the actual %s result with context and source status",
    async (mode) => {
      const { completion } = await startDebate({
        subject: "Should our team move to a four-day workweek?",
        context: "Keep weekday support coverage.",
        mode,
      });
      const record = await completion;
      const text = runBrief(record);
      expect(text).toContain(record.subject);
      expect(text).toContain(record.context);
      expect(text).toContain("## Sources");
      expect(text).toContain("Simulated development run");
      expect(text).not.toContain("undefined");
      const run = record.latestRun!;
      const consensus = asConsensusRun(run),
        panel = asAdvisoryPanelRun(run),
        debate = asDebateRun(run);
      if (consensus) {
        expect(text).toContain(consensus.result.convergence.finalAnswer);
        expect(text).toContain("Stance agreement:");
        expect(text).not.toContain("## Verdict");
      }
      if (panel) {
        expect(text).toContain(panel.result.chair.decisionGuidance);
        expect(text).toContain(panel.result.advice[0].lensName);
        expect(text).not.toContain("## Verdict");
      }
      if (debate) {
        expect(text).toContain(debate.summary!.recommendation);
        expect(text).toContain("## Verdict");
      }
    },
  );
  it("does not invent an outcome for a queued run", async () => {
    const { debate, completion } = await startDebate({
      subject: "Should we migrate our database?",
    });
    expect(runBrief(debate)).toContain("No result is available yet.");
    expect(runBrief(debate)).not.toContain("## Verdict");
    await completion;
  });
});
