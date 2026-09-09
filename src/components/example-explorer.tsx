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
    title: "Launch a limited free plan.",
    body: "Keep a clear upgrade path and measure support cost. A limited free plan could help people experience the product before committing to a paid subscription.",
    opinions: [
      {
        label: "The case for",
        body: "A free plan lowers the barrier to entry, encourages product discovery, and gives potential customers a reason to try the product.",
        tone: "for",
      },
      {
        label: "The case against",
        body: "Free accounts can increase support costs and attract users who never convert. Existing customers may also downgrade.",
        tone: "against",
      },
    ],
    detail: "What would change this verdict?",
    detailBody:
      "Rising support costs, low paid conversion, or substantial downgrades would count against expanding the free plan.",
  },
  consensus: {
    tag: "Partial agreement",
    title: "Agreement on the experiment. Less on the outcome.",
    body: "The perspectives agree on testing a limited free plan. They remain split on whether new paid conversions would cover the additional cost.",
    opinions: [
      {
        label: "Common ground",
        body: "Set clear usage limits, preserve a useful paid upgrade, and measure activation, conversion, and support cost.",
        tone: "for",
      },
      {
        label: "A view that holds out",
        body: "The cautious perspective wants evidence of paid demand before offering more of the product for free.",
        tone: "against",
      },
    ],
    detail: "What does agreement tell you?",
    detailBody:
      "It shows that perspectives landed near one another. Agreement between AI agents is not independent verification or a guarantee that a prediction is right.",
  },
  advisory_panel: {
    tag: "Chair’s synthesis",
    title: "Give the free plan clear guardrails.",
    body: "The advisors examine unit economics, transparent limits, support capacity, and the risk of replacing paid revenue with free usage.",
    opinions: [
      {
        label: "Economist",
        body: "Compare the cost of free accounts with the value of customers who upgrade.",
        tone: "advisor",
      },
      {
        label: "Operator",
        body: "Define usage limits and a support policy that the team can sustain.",
        tone: "advisor",
      },
      {
        label: "Ethicist",
        body: "Explain the limits clearly so users can make an informed choice before investing time in the product.",
        tone: "advisor",
      },
      {
        label: "Skeptic",
        body: "Watch for paid customers downgrading and free users who generate costs without converting.",
        tone: "advisor",
      },
    ],
    detail: "What should happen next?",
    detailBody:
      "Name an owner for the trial, set a review date, and agree on conversion and cost thresholds. The chair offers guidance rather than choosing a winning side.",
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
        <p>“Should we launch a free plan?”</p>
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
