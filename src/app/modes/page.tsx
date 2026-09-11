import type { Metadata, Route } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { modeGuide, modeOrder } from "@/lib/mode-guide";
import { ModeDiagram } from "@/components/mode-diagram";

export const metadata: Metadata = {
  title: "Choose a mode | Polyvise",
  description:
    "Choose a debate for a decision, consensus for agreement, or an advisory panel for strategy.",
};

export default function ModesPage() {
  return (
    <section className="page mode-guide-page">
      <h1 className="display d2 mt10">Mode guide</h1>
      <p className="lede mt10 mw640">
        Compare how debate, consensus, and advisory panels process a question.
      </p>
      <div className="mode-guide-grid">
        {modeOrder.map((id) => {
          const guide = modeGuide[id];
          return (
            <article key={id} className="guide-card">
              <span className="eyebrow">{guide.goal}</span>
              <h2 className="display">{guide.name}</h2>
              <ModeDiagram mode={id} />
              <p>{guide.description}</p>
              <ul className="output-checklist">
                {guide.outputs.map((output) => (
                  <li key={output}>
                    <Check size={14} />
                    {output}
                  </li>
                ))}
              </ul>
              <details>
                <summary>How it works</summary>
                <p>{guide.rule}</p>
                <Link href={guide.href as Route}>Read the full guide →</Link>
              </details>
              <Link
                className="btn btn-primary"
                href={`/?mode=${id}#ask` as Route}
              >
                Use {guide.name.toLowerCase()} <ArrowRight size={15} />
              </Link>
            </article>
          );
        })}
      </div>
      <div className="lab-callout">
        <div>
          <h2 className="display d3">Compare models</h2>
          <p>
            Send one prompt to configured models and compare their answers,
            timing and cost. This is a separate comparison tool, with its own
            results.
          </p>
        </div>
        <Link href="/lab" className="btn">
          Open the lab <ArrowRight size={15} />
        </Link>
      </div>
    </section>
  );
}
