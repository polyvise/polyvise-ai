"use client";

import { ArrowUpRight, BarChart3, ShieldQuestion, Users, Lightbulb, SlidersHorizontal } from "lucide-react";
import type { CouncilSize, DebateMode } from "@polyvise/core/debate/types";
import { modeGuide } from "@/lib/mode-guide";

const icons = [BarChart3, ShieldQuestion, Users, Lightbulb];
const debate = [
  ["The case for", "Explore the upside.", "Build the strongest supporting case and connect the opportunities to evidence.", "Opportunity · Evidence"],
  ["The case against", "Put the risks in focus.", "Challenge assumptions, examine trade-offs, and test where the decision could fall short.", "Risk · Trade-offs"],
  ["Questions & rebuttals", "Give every claim a closer look.", "Both sides question each other and respond to the strongest opposing arguments.", "Challenge · Response"],
  ["The neutral judge", "Bring the whole picture together.", "Weigh both cases, explain the recommendation, and preserve what remains uncertain.", "Synthesis · Uncertainty"],
];
const panel = [
  ["The economist", "Understand the incentives.", "Examine costs, benefits, resource allocation, and the economics behind your strategy.", "Value · Incentives"],
  ["The skeptic", "Test the assumptions.", "Look for weak points, hidden risks, and conditions that could change the recommendation.", "Risk · Assumptions"],
  ["The operator", "Make it work in practice.", "Consider execution, capacity, dependencies, and what a practical next step looks like.", "Execution · Feasibility"],
  ["The ethicist", "Consider who is affected.", "Examine fairness, responsibilities, and the impact of the decision on different people.", "Fairness · Impact"],
];
const consensus = [
  ["Independent answers", "Start with different views.", "Each perspective answers on its own before seeing what the others think.", "Independence · Range"],
  ["Critical review", "Make space for disagreement.", "Perspectives compare reasoning and identify where their assumptions diverge.", "Comparison · Dissent"],
  ["Revised positions", "See what changes.", "Each perspective can revise its stance or hold its ground across your selected rounds.", "Reflection · Revision"],
  ["Shared synthesis", "Find the common ground.", "Inspect the shared answer, measured stance agreement, and the reasoning of holdouts.", "Agreement · Holdouts"],
];

export function PerspectivePreview({ mode, councilSize, agentCount, onSettings }: { mode: DebateMode; councilSize: CouncilSize; agentCount: number; onSettings: () => void }) {
  const cards = mode === "advisory_panel" ? panel : mode === "consensus" ? consensus : debate;
  return <section className="perspective-canvas" aria-label="What to expect">
    <header className="canvas-heading">
      <div><span className="eyebrow">A little perspective changes everything</span><h1>See the whole picture.</h1><p>Multiple perspectives. A sharper answer.</p></div>
      <button type="button" className="btn canvas-settings" onClick={onSettings}><SlidersHorizontal size={14} /> Model settings</button>
    </header>
    <div className="canvas-status"><span>{modeGuide[mode].name}</span><span>{mode === "consensus" ? `${agentCount} independent perspectives` : mode === "advisory_panel" ? "4 advisors + a chair" : `${councilSize === "duo" ? "2" : "4"} debaters + a judge`}</span></div>
    <div className="perspective-grid">
      {cards.map(([role, title, description, tags], i) => { const Icon = icons[i]; return <article className={`perspective-card perspective-${i}`} key={role}>
        <div className="perspective-label"><Icon size={24} strokeWidth={1.8} /><span>{role}</span><span className="perspective-number">0{i + 1}</span></div>
        <h2>{title}</h2><p>{description}</p><div className="perspective-tags">{tags.split(" · ").map(tag => <span key={tag}>{tag}</span>)}</div>
      </article>; })}
    </div>
    <div className="canvas-outcome"><div><span className="eyebrow">The outcome</span><h2>{modeGuide[mode].outcome}</h2><p>{modeGuide[mode].outputs.join(" · ")}</p></div><ArrowUpRight size={24} /></div>
    <p className="canvas-note">{modeGuide[mode].rule}</p>
    <a href="#example" className="text-action">Explore a completed example <ArrowUpRight size={14} /></a>
  </section>;
}
