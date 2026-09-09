import { describe, expect, it } from "vitest";
import { currentDebateTerminology, normalizeDebateOutput } from "@/lib/debate-terminology";

describe("legacy debate terminology", () => {
  it("adapts the judge review from legacy runs", () => {
    expect(currentDebateTerminology("the green frog argues for it; the pink frog argues against it."))
      .toBe("the supporting debater argues for it; the opposing debater argues against it.");
    expect(currentDebateTerminology("Yes Frog, NO FROG, Judge Frog and neutral frogs"))
      .toBe("supporting debater, opposing debater, judge and judges");
  });

  it("normalizes generated prose without altering evidence, inputs, links, or IDs", () => {
    const record = {
      subject: "Should we protect the green frog?",
      context: "The pink frog is a fictional species.",
      latestRun: {
        turns: [{ id: "yes-frog", agentName: "Yes Frog", content: "The pink frog disagrees.", sourceIds: ["green frog"] }],
        summary: { strongestPro: ["The green frog supports this."], headline: "The judge frog agrees." },
        sources: [{ title: "Green frog habitat", snippet: "The green frog lives here.", url: "https://example.org/green-frog" }],
      },
      followups: [{ question: "What is a green frog?", answer: "The judge frog recommends a pilot." }],
    };
    const result = normalizeDebateOutput(record);
    expect(result.latestRun.turns[0].content).toBe("The opposing debater disagrees.");
    expect(result.latestRun.turns[0].agentName).toBe("supporting debater");
    expect(result.latestRun.turns[0].id).toBe("yes-frog");
    expect(result.latestRun.turns[0].sourceIds).toEqual(["green frog"]);
    expect(result.latestRun.summary.strongestPro).toEqual(["The supporting debater supports this."]);
    expect(result.latestRun.sources).toEqual(record.latestRun.sources);
    expect(result.subject).toBe(record.subject);
    expect(result.context).toBe(record.context);
    expect(result.followups[0].question).toBe(record.followups[0].question);
    expect(result.followups[0].answer).toBe("The judge recommends a pilot.");
    expect(record.latestRun.turns[0].content).toBe("The pink frog disagrees.");
    expect(normalizeDebateOutput(result)).toEqual(result);
  });

  it("leaves ordinary frog references and current terminology alone", () => {
    const text = "Frogs need wetlands. The supporting debater agrees with the judge.";
    expect(currentDebateTerminology(text)).toBe(text);
  });
});
