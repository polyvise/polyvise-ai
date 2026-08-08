import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";
import { roundLabels, roundOrder } from "@/lib/run-view";

export const metadata: Metadata = {
  title: "Debate | Polyvise",
  description: "Hybrid Council — two agents for, two against, and a neutral judge."
};

const roundDetail: Record<string, string> = {
  opening: "Each side states its case from its own evidence, without having seen the other's.",
  cross_examination: "Each side puts the question its opponent has to answer to keep its case standing.",
  rebuttal: "Direct replies. Concessions here are what the judge weighs most heavily.",
  closing: "Each side states what it thinks survived, and on what condition.",
  judge_review: "The neutral model reads the transcript and marks what was actually settled.",
  synthesis: "The verdict, its confidence, and the evidence that would overturn it."
};

const roster = [
  { tone: "pro" as const, initials: "P1", name: "Opening case", meta: "quick slot" },
  { tone: "pro" as const, initials: "P2", name: "Implementation rebuttal", meta: "quick slot" },
  { tone: "con" as const, initials: "C1", name: "Risk case", meta: "deep slot" },
  { tone: "con" as const, initials: "C2", name: "Stakeholder rebuttal", meta: "deep slot" },
  { tone: "judge" as const, initials: "J", name: "Neutral judge", meta: "judge slot" }
];

export default function DebateModePage() {
  return (
    <section className="page">
      <div className="row gap8 wrap">
        <span className="eyebrow">Deliberation mode</span>
        <span className="chip pro">
          <span className="dot" />
          Live
        </span>
      </div>
      <h2 className="display d2 mt10">Hybrid Council</h2>
      <p className="lede mt10 mw640">
        Two agents argue for the resolution, two argue against it, and a neutral judge scores the result across
        evidence, practicality, risk, fairness and reversibility. Six rounds, ending in a verdict with a confidence
        figure and the evidence that would change it.
      </p>

      <div className="hero-cta">
        <Link href={"/compose" as Route} className="btn btn-primary">
          Start a run →
        </Link>
        <Link href={"/runs" as Route} className="btn">
          Your past runs
        </Link>
      </div>

      <div className="mt44">
        <div className="section-head">
          <div>
            <span className="eyebrow">Round sequence</span>
            <h3 className="display d3 mt6">Six rounds, then a verdict</h3>
          </div>
          <span className="small">Every turn records the claims and sources it rests on.</span>
        </div>
        <div className="pipeline">
          {roundOrder.map((round, index) => (
            <div className="pipe-step" key={round}>
              <div className="pipe-rail">
                <span
                  className={`pipe-node ${round === "judge_review" || round === "synthesis" ? "judge" : "split"}`}
                />
                <span className="pipe-n">{String(index + 1).padStart(2, "0")}</span>
                <span className="pipe-line" />
              </div>
              <div className="pipe-t">{roundLabels[round]}</div>
              <div className="pipe-d">{roundDetail[round]}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="grid g2 mt44">
        <div className="card">
          <div className="card-head">
            <span className="card-title">The lineup</span>
            <span className="meta push">quartet · 5 agents</span>
          </div>
          <div className="card-pad" style={{ paddingTop: 2, paddingBottom: 8 }}>
            {roster.map((agent) => (
              <div className="agent" key={agent.initials}>
                <span className={`av ${agent.tone}`}>{agent.initials}</span>
                <div style={{ minWidth: 0 }}>
                  <div className="agent-n">{agent.name}</div>
                  <div className="agent-m">{agent.meta}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad">
          <span className="eyebrow">Duo</span>
          <h4 className="display d4 mt10">One agent a side</h4>
          <p className="small mt10">
            The duo size runs a single pro agent against a single con agent, with the same judge and the same six
            rounds. Each speaks in every round, which makes the transcript easier to follow. Pick it on the composer
            before starting a run.
          </p>
          <p className="small mt14">
            Model routing is per slot, so the pro side, the con side and the judge can each run a different model — and
            the telemetry tab shows what each one cost.
          </p>
        </div>
      </div>
    </section>
  );
}
