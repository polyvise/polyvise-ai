import { Composer } from "@/components/composer";

/**
 * The question box is the home page. What follows it answers the two things
 * a first-time visitor wants to know before pressing start: what happens,
 * and what comes back.
 */
const pipeline = [
  {
    title: "Frame",
    detail: "Turns your question into a resolution the council can argue, and notes how much is at stake.",
    tone: "judge"
  },
  {
    title: "Scout",
    detail: "Each model stakes out a position on its own, before it sees anyone else's.",
    tone: "split"
  },
  {
    title: "Gather evidence",
    detail: "Sources are pulled and graded. Anything promotional or undated is set aside.",
    tone: "pro"
  },
  {
    title: "Debate",
    detail: "Opening, cross-examination, rebuttal, closing. Every turn says which sources it leans on.",
    tone: "split"
  },
  {
    title: "Judge",
    detail: "A neutral model scores both sides, writes the verdict, and says what would change its mind.",
    tone: "judge"
  }
];

export default function HomePage() {
  return (
    <div className="home">
      <div className="home-glow" />

      <section className="hero">
        <span className="hero-kicker">Several models. One structured argument. An answer you can check.</span>
        <h1 className="display d1">
          Ask a hard question.
          <br />
          Several AI models argue it out.
          <br />
          A neutral judge gives you the verdict.
        </h1>
        <p className="lede">
          Every claim links to the source behind it, and every step names the model that produced it.
        </p>
      </section>

      <section className="home-section" style={{ paddingTop: 20 }}>
        <Composer />
      </section>

      <section className="home-section" id="how-it-works">
        <div className="section-head">
          <h2 className="display">What happens after you press start</h2>
          <span className="small">Every step names the model that did it.</span>
        </div>
        <div className="pipeline">
          {pipeline.map((step, index) => (
            <div className="pipe-step" key={step.title}>
              <div className="pipe-rail">
                <span className={`pipe-node ${step.tone}`} />
                {index < pipeline.length - 1 ? <span className="pipe-line" /> : null}
              </div>
              <div className="pipe-t">{step.title}</div>
              <div className="pipe-d">{step.detail}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="home-section" style={{ paddingTop: 88 }}>
        <div className="grid g3" style={{ gap: 20 }}>
          <div className="promise">
            <div className="promise-figure">
              <span className="big">
                72<span>%</span>
              </span>
              <div className="balance-bar" style={{ flex: 1, marginBottom: 10, height: 8 }}>
                <div className="balance-pro" style={{ width: "58%" }} />
                <div className="balance-con" style={{ width: "42%" }} />
              </div>
            </div>
            <h3>A verdict with a confidence figure</h3>
            <p>Not a paragraph that hedges. A call, a number, and the five dimensions it rests on.</p>
          </div>

          <div className="promise">
            <div className="promise-figure" style={{ alignItems: "center" }}>
              <div className="row gap8 wrap">
                <span className="cite" style={{ background: "var(--pro-dim)", color: "var(--pro-ink)" }}>
                  S1 · primary
                </span>
                <span className="cite" style={{ background: "var(--pro-dim)", color: "var(--pro-ink)" }}>
                  S4 · expert
                </span>
                <span className="cite cite-strike">S7 · vendor blog</span>
              </div>
            </div>
            <h3>Every claim links to a source</h3>
            <p>Sources are graded primary, expert or context. The ones that were rejected stay visible, crossed out.</p>
          </div>

          <div className="promise">
            <div className="promise-figure" style={{ alignItems: "center" }}>
              <div className="stack-av">
                <span className="av pro">P1</span>
                <span className="av pro">P2</span>
                <span className="av con">C1</span>
                <span className="av con">C2</span>
                <span className="av judge">J</span>
              </div>
            </div>
            <h3>Every step names its model</h3>
            <p>Latency, tokens and cost for each call, on every run. When a model fails, the gap is reported, never filled in.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
