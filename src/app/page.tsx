import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  Braces,
  GitBranch,
  ScanLine,
} from "lucide-react";
import { Composer } from "@/components/composer";
import { ExampleExplorer } from "@/components/example-explorer";
import { parseMode } from "@/lib/mode-guide";

type Props = { searchParams: Promise<{ mode?: string | string[] }> };

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const initialMode = parseMode(
    typeof params.mode === "string" ? params.mode : undefined,
  );
  return (
    <div className="decision-home">
      <section className="decision-hero">
        <div>
          <span className="eyebrow">
            <span className="hero-mini-mark" />A workspace for better questions
          </span>
          <h1 className="display">
            One question.
            <br />
            <em>A room full of perspectives.</em>
          </h1>
          <p>
            Think beyond the first answer. Let AI perspectives debate a
            decision, find common ground, or examine your next move.
          </p>
        </div>
        <a href="#example" className="hero-example">
          Curious? See an example
          <ArrowDown size={16} />
        </a>
      </section>
      <Composer key={initialMode} initialMode={initialMode} />
      <div className="workspace-footnote">
        <span>Three ways to think. One place to inspect the reasoning.</span>
        <Link href="/modes">
          Help me choose a mode <ArrowUpRight size={14} />
        </Link>
      </div>
      <ExampleExplorer />
      <section className="build-section" aria-labelledby="build-title">
        <div className="build-heading">
          <span className="eyebrow">Built to show its work</span>
          <h2 id="build-title" className="display">
            The answer is only the beginning.
          </h2>
          <p>
            Follow the evidence, inspect disagreements, and see what each model
            call contributed.
          </p>
        </div>
        <div className="build-pillars">
          <div>
            <ScanLine size={20} />
            <h3>Inspect the evidence</h3>
            <p>
              Explore accepted and rejected sources, their quality labels, and
              the claims they support. Check the sources before relying on a
              result.
            </p>
          </div>
          <div>
            <GitBranch size={20} />
            <h3>Follow the reasoning</h3>
            <p>
              Read the debate, track changing positions, or compare advice by
              lens. Uncertainty and disagreement belong in the result.
            </p>
          </div>
          <div>
            <Braces size={20} />
            <h3>Look under the hood</h3>
            <p>
              Per-call models, latency, tokens and cost make the work
              inspectable. A framework-neutral TypeScript engine powers all
              three modes.
            </p>
            <Link href="/telemetry">
              Explore telemetry <ArrowUpRight size={13} />
            </Link>
          </div>
        </div>
        <details className="architecture-note">
          <summary>
            How Polyvise is built <span>Product + engineering</span>
          </summary>
          <div>
            <p>
              <strong>polyvise-ai</strong> owns the Next.js interface, API
              routes, live event delivery and persistence.{" "}
              <strong>polyvise-core</strong> owns the typed contracts,
              deliberation workflows and model and evidence providers. The
              boundary lets the engine serve multiple applications.
            </p>
            <p>
              Structured outputs are validated with Zod. Runs preserve traces
              and artifacts so a result can be inspected beyond its final
              paragraph. Consensus agreement is computed from agent stances
              rather than self-reported by a model.
            </p>
            <div className="row gap24 wrap">
              <a
                href="https://github.com/polyvise/polyvise-ai"
                target="_blank"
                rel="noreferrer"
              >
                Application repository ↗
              </a>
              <a
                href="https://github.com/polyvise/polyvise-core"
                target="_blank"
                rel="noreferrer"
              >
                Core repository ↗
              </a>
            </div>
          </div>
        </details>
      </section>
    </div>
  );
}
