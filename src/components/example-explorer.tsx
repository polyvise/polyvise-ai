"use client";

import { useState } from "react";
import { ArrowRight, Check, ChevronDown } from "lucide-react";
import { modeGuide, modeOrder } from "@/lib/mode-guide";
import type { DebateMode } from "@polyvise/core/debate/types";

type Sample = {
  tag: string;
  title: string;
  body: string;
  opinions: Array<{
    label: string;
    body: string;
    tone: "for" | "against" | "advisor";
  }>;
  detail: string;
  detailBody: string;
};

const samples: Record<DebateMode, Sample> = {
  hybrid_council: {
    tag: "Conditional yes",
    title: "Try a pilot before making a promise.",
    body: "A shorter week could improve focus and retention. Make the decision reversible: pilot it for one quarter, with explicit customer coverage and delivery measures.",
    opinions: [
      {
        label: "The case for",
        body: "Fewer meetings and clearer priorities could protect focused work. A shorter week may also make the team easier to recruit for.",
        tone: "for",
      },
      {
        label: "The case against",
        body: "Support coverage may become harder. Compressing the same workload into fewer days could increase stress.",
        tone: "against",
      },
    ],
    detail: "What would change this verdict?",
    detailBody:
      "Evidence of slower incident response, sustained delivery slippage, or higher workload stress would count against continuing the pilot.",
  },
  consensus: {
    tag: "Partial agreement",
    title: "Agreement on the experiment. Less on the outcome.",
    body: "The perspectives find common ground on a reversible trial. They remain split on whether fewer hours will improve productivity for this particular team.",
    opinions: [
      {
        label: "Common ground",
        body: "Define success before starting, protect customer coverage, and compare results with the team’s own baseline.",
        tone: "for",
      },
      {
        label: "A view that holds out",
        body: "The cautious perspective wants evidence that workload can actually shrink before reducing working hours.",
        tone: "against",
      },
    ],
    detail: "What does agreement tell you?",
    detailBody:
      "It shows that perspectives landed near one another. Agreement between AI agents is not independent verification or a guarantee that a prediction is right.",
  },
  advisory_panel: {
    tag: "Chair’s synthesis",
    title: "Design the conditions for a fair trial.",
    body: "The advisors point to different prerequisites: a sustainable cost, equitable access, reliable coverage, and a clear way to recognize failure.",
    opinions: [
      {
        label: "Economist",
        body: "Compare the cost of extra coverage with the expected retention and productivity gains.",
        tone: "advisor",
      },
      {
        label: "Operator",
        body: "Reduce meeting load first, then assign one owner for scheduling and incident handoffs.",
        tone: "advisor",
      },
      {
        label: "Ethicist",
        body: "Make sure customer-facing roles can benefit too, without shifting hidden overtime onto them.",
        tone: "advisor",
      },
      {
        label: "Skeptic",
        body: "Set failure measures and rollback criteria before the pilot begins.",
        tone: "advisor",
      },
    ],
    detail: "What should happen next?",
    detailBody:
      "Name an owner for the pilot, ask the team where the workload can shrink, and agree on both success and stop conditions. The chair offers guidance rather than choosing a winning side.",
  },
};

export function ExampleExplorer() {
  const [mode, setMode] = useState<DebateMode>("hybrid_council");
  const sample = samples[mode];
  return (
    <section
      className="example-explorer"
      id="example"
      aria-labelledby="example-title"
    >
      <div className="example-intro">
        <span className="eyebrow">A little less abstract</span>
        <h2 className="display" id="example-title">
          Same question. <br />
          <em>Three useful angles.</em>
        </h2>
        <p>“Should our engineering team adopt a four-day workweek?”</p>
        <div className="example-mode-picker" aria-label="Example mode">
          {modeOrder.map((id) => (
            <button
              type="button"
              key={id}
              aria-pressed={mode === id}
              onClick={() => setMode(id)}
            >
              <span>{modeGuide[id].name}</span>
              <ArrowRight size={16} />
            </button>
          ))}
        </div>
        <p className="example-disclaimer">
          Illustrative, hand-written examples. These are not live model results
          or sourced recommendations.
        </p>
      </div>
      <div className="sample-brief" aria-live="polite">
        <div className="sample-topline">
          <span className="eyebrow">Example / {modeGuide[mode].name}</span>
          <span className="chip pro">
            <Check size={12} />
            {sample.tag}
          </span>
        </div>
        <h3 className="display">{sample.title}</h3>
        <p>{sample.body}</p>
        <div className="sample-arguments">
          {sample.opinions.map((opinion) => (
            <div key={opinion.label}>
              <span className={`sample-label ${opinion.tone}`}>
                {opinion.label}
              </span>
              <p>{opinion.body}</p>
            </div>
          ))}
        </div>
        <details key={mode}>
          <summary>
            {sample.detail}
            <ChevronDown size={15} />
          </summary>
          <p>{sample.detailBody}</p>
        </details>
        <div className="sample-footer">
          <span>
            In a real run: sources, reasoning and model-call telemetry.
          </span>
          <a href="#ask">
            Ask your own <ArrowRight size={14} />
          </a>
        </div>
      </div>
    </section>
  );
}
