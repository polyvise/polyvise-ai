"use client";

import { BarChart3, ShieldQuestion, Users, Lightbulb, SlidersHorizontal } from "lucide-react";
import type { CouncilSize, DebateMode } from "@polyvise/core/debate/types";
import { modeGuide } from "@/lib/mode-guide";

const icons = [BarChart3, ShieldQuestion, Users, Lightbulb];
const debate = [
  ["The case for", "Supporting arguments", "Build the strongest supporting case and connect the opportunities to evidence.", "Opportunity · Evidence"],
  ["The case against", "Opposing arguments", "Challenge assumptions, examine trade-offs, and test where the decision could fall short.", "Risk · Trade-offs"],
  ["Questions & rebuttals", "Questions and responses", "Both sides question each other and respond to the strongest opposing arguments.", "Challenge · Response"],
  ["The neutral judge", "Review and recommendation", "Weigh both cases, explain the recommendation, and preserve what remains uncertain.", "Synthesis · Uncertainty"],
];
const panel = [
  ["The economist", "Costs and incentives", "Examine costs, benefits, resource allocation, and the economics behind your strategy.", "Value · Incentives"],
  ["The skeptic", "Assumptions and risks", "Look for weak points, hidden risks, and conditions that could change the recommendation.", "Risk · Assumptions"],
  ["The operator", "Implementation and capacity", "Consider execution, capacity, dependencies, and what a practical next step looks like.", "Execution · Feasibility"],
  ["The ethicist", "Fairness and impact", "Examine fairness, responsibilities, and the impact of the decision on different people.", "Fairness · Impact"],
];
const consensus = [
  ["Independent answers", "Initial positions", "Each perspective answers on its own before seeing what the others think.", "Independence · Range"],
  ["Critical review", "Comparison of reasoning", "Perspectives compare reasoning and identify where their assumptions diverge.", "Comparison · Dissent"],
  ["Revised positions", "Position updates", "Each perspective can revise its stance or hold its ground across your selected rounds.", "Reflection · Revision"],
  ["Shared synthesis", "Agreement and disagreements", "Inspect the shared answer, measured stance agreement, and the reasoning of holdouts.", "Agreement · Holdouts"],
];

export function PerspectivePreview({ mode, councilSize, agentCount, onSettings }: { mode: DebateMode; councilSize: CouncilSize; agentCount: number; onSettings: () => void }) {
  const cards = mode === "advisory_panel" ? panel : mode === "consensus" ? consensus : debate;
  return <section className="perspective-canvas" aria-label="What to expect">
    <header className="canvas-heading">
      <div>
        <h1>How {modeGuide[mode].name.toLowerCase()} works</h1>
        <p>{mode === "consensus" ? `${agentCount} independent perspectives` : mode === "advisory_panel" ? "4 advisors and a chair" : `${councilSize === "duo" ? "2" : "4"} debaters and a neutral judge`}</p>
      </div>
      <button type="button" className="btn canvas-settings" onClick={onSettings}><SlidersHorizontal size={14} /> Model settings</button>
    </header>
    <div className="perspective-grid">
      {cards.map(([role, title, description, tags], i) => { const Icon = icons[i]; return <article className={`perspective-card perspective-${i}`} key={role}>
        <h2><Icon size={22} strokeWidth={1.8} aria-hidden="true" />{role}</h2>
        <p className="perspective-focus">{title}</p>
        <p>{description}</p><div className="perspective-tags">{tags.split(" · ").map(tag => <span key={tag}>{tag}</span>)}</div>
      </article>; })}
    </div>
    <div className="canvas-outcome">
      <h2>{modeGuide[mode].outcome}</h2>
      <ul>{modeGuide[mode].outputs.map(output => <li key={output}>{output}</li>)}</ul>
    </div>
    <p className="canvas-note">{modeGuide[mode].rule}</p>
  </section>;
}
