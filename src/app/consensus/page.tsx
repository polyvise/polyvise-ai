import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Consensus | Polyvise",
  description: "A convergence mode where agents answer independently, then revise or hold."
};

const stages = [
  {
    eyebrow: "Round 1 — Blind",
    title: "Seven independent answers",
    body: "No agent sees another. Positions and confidence are recorded before any influence."
  },
  {
    eyebrow: "Round 2 — Exposed",
    title: "Revise or hold",
    body: "Each agent sees the spread and must either move or give a reason for holding."
  },
  {
    eyebrow: "Round 3 — Settle",
    title: "Final positions",
    body: "Reports the band they settled into, the holdouts, and whether movement looked reasoned or like herding."
  }
];

export default function ConsensusPage() {
  return (
    <section className="page">
      <div className="row gap8 wrap">
        <span className="eyebrow">Deliberation mode</span>
        <span className="chip pro">
          <span className="dot" />
          Live
        </span>
      </div>
      <h2 className="display d2 mt10">Consensus</h2>
      <p className="lede mt10 mw640">
        Agents answer independently, then see each other&apos;s positions and either revise or defend holding. The
        result reports where they landed, who held out, and whether the movement was reasoned.
      </p>

      <div className="grid g3 mt24">
        {stages.map((stage) => (
          <div className="card card-pad" key={stage.eyebrow}>
            <span className="eyebrow">{stage.eyebrow}</span>
            <h4 className="display d4 mt10">{stage.title}</h4>
            <p className="small mt10">{stage.body}</p>
          </div>
        ))}
      </div>

      <div className="card mt24">
        <div className="card-head">
          <span className="card-title">Convergence plot</span>
          <span className="meta push">the signature visual for this mode</span>
        </div>
        <div className="graph-wrap flush">
          <svg viewBox="0 0 880 300" style={{ width: "100%", display: "block" }} role="img" aria-label="Illustrative convergence plot: five agents converge into a lean-yes band while two hold their position.">
            <g className="s-line" strokeWidth={1}>
              <line x1="80" y1="40" x2="80" y2="250" />
              <line x1="360" y1="40" x2="360" y2="250" />
              <line x1="640" y1="40" x2="640" y2="250" />
              <line x1="80" y1="250" x2="820" y2="250" />
            </g>
            <g className="f-faint" fontFamily="var(--mono)" fontSize="9">
              <text x="80" y="270" textAnchor="middle">
                BLIND
              </text>
              <text x="360" y="270" textAnchor="middle">
                EXPOSED
              </text>
              <text x="640" y="270" textAnchor="middle">
                SETTLED
              </text>
              <text x="30" y="60">
                agree
              </text>
              <text x="26" y="248">
                reject
              </text>
            </g>
            <g fill="none" className="s-pro" strokeWidth={1.6}>
              <path d="M80 210 C220 200 260 120 360 110 C480 100 540 96 640 92" opacity=".85" />
              <path d="M80 70 C220 76 250 88 360 100 C480 108 540 100 640 96" opacity=".6" />
              <path d="M80 130 C220 128 260 112 360 104 C480 98 540 94 640 90" opacity=".6" />
              <path d="M80 96 C220 100 260 104 360 102 C480 100 540 96 640 94" opacity=".45" />
              <path d="M80 170 C220 168 260 150 360 140 C480 132 540 126 640 120" opacity=".45" />
            </g>
            <g fill="none" className="s-con" strokeWidth={1.8}>
              <path d="M80 236 C220 234 260 226 360 222 C480 220 540 218 640 216" />
              <path d="M80 46 C220 48 260 52 360 54 C480 56 540 58 640 58" opacity=".8" />
            </g>
            <rect x="640" y="80" width="180" height="48" rx="5" className="f-pro-dim s-pro-line" />
            <text x="656" y="99" className="f-pro" fontFamily="var(--mono)" fontSize="8.5" letterSpacing="1.3">
              CONVERGED BAND · 5
            </text>
            <text x="656" y="115" className="f-ivory" fontFamily="var(--ui)" fontSize="11.5">
              Lean yes, 68–74%
            </text>
            <rect x="640" y="196" width="180" height="38" rx="5" className="f-con-dim s-con-line" />
            <text x="656" y="213" className="f-con" fontFamily="var(--mono)" fontSize="8.5" letterSpacing="1.3">
              HOLDOUT · 2
            </text>
            <text x="656" y="227" className="f-text" fontFamily="var(--ui)" fontSize="10.5">
              Held position, gave reasons
            </text>
          </svg>
        </div>
      </div>

      <div className="callout note mt18">
        <svg
          className="ci"
          width="15"
          height="15"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.4}
          style={{ color: "var(--muted)" }}
          aria-hidden="true"
        >
          <circle cx="8" cy="8" r="6.2" />
          <path d="M8 7.4v3.4M8 5.2v.6" strokeLinecap="round" />
        </svg>
        <div>
          <h5>Why this reuses the debate shell</h5>
          <p>
            The run header, stepper, inspector rail, evidence ledger and telemetry are all mode-agnostic. A new mode
            supplies a stage sequence, a stream renderer and a result renderer, and inherits the rest.
          </p>
        </div>
      </div>

      <div className="hero-cta">
        <Link href={"/" as Route} className="btn btn-primary btn-lg">
          Ask a question
        </Link>
        <Link href={"/runs" as Route} className="btn">
          Your past runs
        </Link>
      </div>

      <p className="meta mt18">
        The plot above illustrates the shape of the output. Run one to see real positions.
      </p>
    </section>
  );
}
