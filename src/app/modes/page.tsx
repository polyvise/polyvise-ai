import type { Metadata } from "next";
import Link from "next/link";
import type { Route } from "next";

export const metadata: Metadata = {
  title: "Modes | Polyvise",
  description: "Debate, consensus, an advisory panel, and a lab for comparing models on one prompt."
};

const modes = [
  {
    href: "/debate" as Route,
    title: "Debate",
    body: "Two models argue for, two against, and a neutral judge scores the result. Six rounds, ending in a verdict with a confidence figure.",
    best: "Best for yes-or-no decisions",
    dots: (
      <>
        <span className="d pro" />
        <span className="d pro" />
        <span className="vs">vs</span>
        <span className="d con" />
        <span className="d con" />
        <span className="bar" />
        <span className="d judge" />
      </>
    )
  },
  {
    href: "/consensus" as Route,
    title: "Consensus",
    body: "Several models answer alone, then see each other's positions and either revise or defend holding. Reports where they settled and who held out.",
    best: "Best for estimates and forecasts",
    dots: (
      <>
        <span className="d grey" />
        <span className="d grey" style={{ opacity: 0.8 }} />
        <span className="d grey" style={{ opacity: 0.6 }} />
        <span className="d grey" style={{ opacity: 0.45 }} />
        <span className="d grey" style={{ opacity: 0.3 }} />
        <svg width="16" height="12" viewBox="0 0 16 12" fill="none" className="s-muted" strokeWidth={1.5} strokeLinecap="round" aria-hidden="true">
          <path d="M1 6h13M10 2l4 4-4 4" />
        </svg>
        <span className="d pro" />
      </>
    )
  },
  {
    href: "/panel" as Route,
    title: "Advisory panel",
    body: "An economist, an ethicist, an operator and a skeptic each advise in their own voice. A chair writes up where they agree and where they clash.",
    best: "Best for strategy questions",
    dots: (
      <>
        <span className="d lens1" />
        <span className="d lens2" />
        <span className="d lens3" />
        <span className="d lens4" />
        <span className="bar" />
        <span className="d judge" />
      </>
    )
  },
  {
    href: "/lab" as Route,
    title: "Model lab",
    body: "One prompt sent to every configured model, with the answers side by side and the latency, cost and token count for each.",
    best: "Best for choosing which models to seat",
    dots: (
      <>
        <span className="d grey" />
        <span className="d grey" />
        <span className="d grey" />
      </>
    )
  }
];

export default function ModesPage() {
  return (
    <section className="page">
      <span className="eyebrow">Modes</span>
      <h2 className="display d2 mt10">Four ways to work a question</h2>
      <p className="lede mt10 mw640">
        Every mode runs the same engine and lands on the same run page: a result up top, the transcript underneath,
        every source graded, and every model call on the record.
      </p>

      <div className="grid g2 mt34" style={{ gap: 20 }}>
        {modes.map((mode) => (
          <Link key={mode.title} href={mode.href} className="mode-card">
            <div className="mode-top">
              <span className="dots" aria-hidden="true">
                {mode.dots}
              </span>
            </div>
            <h4>{mode.title}</h4>
            <p>{mode.body}</p>
            <div className="mode-foot">
              <span className="chip neutral">{mode.best}</span>
              <span className="mode-go" aria-hidden="true">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>

      <div className="cta-band">
        <div className="cta-copy">
          <h3 className="display d3">Ask something worth arguing about</h3>
          <p className="small mt10">Pick a mode on the question box, choose your models if you like, and watch the transcript build.</p>
        </div>
        <Link href={"/" as Route} className="btn btn-primary btn-lg">
          Ask a question
        </Link>
      </div>
    </section>
  );
}
