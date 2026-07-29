import Link from "next/link";
import type { Route } from "next";
import { MODEL_COUNT, PROVIDER_COUNT } from "@/lib/build-info";
import { getPublicStats } from "@/server/stats";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const modes = [
  {
    href: "/debate" as Route,
    corner: { label: "Live", tone: "pro" as const },
    glyph: <path d="M2 5h5v4H4l-2 2V5zM9 7h5v4h-3l-2 2V7z" strokeLinejoin="round" />,
    glyphTone: "s-pro",
    title: "Hybrid Council",
    body: "Two agents argue for, two argue against, and a neutral judge scores the result. Six rounds, ending in a verdict with a confidence figure.",
    tags: ["Adversarial", "5 agents"],
    soon: false
  },
  {
    href: "/consensus" as Route,
    corner: { label: "Next", tone: "neutral" as const },
    glyph: (
      <>
        <circle cx="6" cy="8" r="3.4" />
        <circle cx="10" cy="8" r="3.4" />
      </>
    ),
    glyphTone: "s-muted",
    title: "Consensus",
    body: "Agents answer independently, then revise over several rounds. Reports the range they settle into and which agents held their original position.",
    tags: ["Convergent", "N agents"],
    soon: true
  },
  {
    href: "/panel" as Route,
    corner: { label: "Next", tone: "neutral" as const },
    glyph: (
      <>
        <circle cx="8" cy="5" r="2.2" />
        <path d="M3.2 13a4.8 4.8 0 019.6 0" strokeLinecap="round" />
      </>
    ),
    glyphTone: "s-muted",
    title: "Advisory Panel",
    body: "Four named perspectives — economist, ethicist, operator, skeptic — each give advice separately. A chair writes up where they agree and where they conflict.",
    tags: ["Additive", "Lens-based"],
    soon: true
  },
  {
    href: "/lab" as Route,
    corner: { label: "Live", tone: "neutral" as const },
    glyph: (
      <path
        d="M6.5 2v4.2L3 12.2a1.4 1.4 0 001.2 2.1h7.6a1.4 1.4 0 001.2-2.1L9.5 6.2V2M5.5 2h5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    glyphTone: "s-muted",
    title: "Model Lab",
    body: "The same prompt sent to every configured model, with the answers side by side and the latency, cost and token count for each.",
    tags: ["Comparative", "Benchmark"],
    soon: false
  }
];

const pipeline = [
  {
    n: "01",
    title: "Frame",
    detail:
      "Turns your question into a resolution the agents can argue for or against, and classifies the topic and its stakes.",
    bar: "bar-judge"
  },
  {
    n: "02",
    title: "Scout",
    detail:
      "Agents stake out positions and list their assumptions independently, before any of them see each other's work.",
    bar: "bar-split"
  },
  {
    n: "03",
    title: "Evidence",
    detail:
      "Retrieves sources, grades each one primary, expert or methodology, and screens out anything promotional or undated.",
    bar: "bar-pro"
  },
  {
    n: "04",
    title: "Deliberate",
    detail:
      "Opening, cross-examination, rebuttal and closing rounds. Each turn records which claims and sources it rests on.",
    bar: "bar-split"
  },
  {
    n: "05",
    title: "Judge",
    detail:
      "A neutral model scores five dimensions, writes the verdict, and lists the evidence that would change it.",
    bar: "bar-judge"
  }
];

export default async function OverviewPage() {
  let runsRecorded: number | null = null;
  try {
    runsRecorded = (await getPublicStats()).totalDebates;
  } catch (error) {
    console.error("Unable to load Polyvise stats", error);
  }

  return (
    <section className="page">
      <div className="hero">
        <div className="hero-grid" />
        <div className="hero-inner">
          <span className="eyebrow">Multi-agent deliberation engine</span>
          <h1 className="display d1">
            Put a question to several models and get an answer you can <em>audit</em>.
          </h1>
          <p className="lede">
            Polyvise runs a question through a structured format — adversarial debate, consensus finding, or an
            advisory panel — using several independent models at once. What comes back is a verdict where every claim
            links to the source behind it and every step names the model that produced it.
          </p>
          <div className="hero-cta">
            <Link href={"/compose" as Route} className="btn btn-primary">
              Start a run →
            </Link>
            <Link href={"/runs" as Route} className="btn">
              See past runs
            </Link>
          </div>
        </div>

        <div className="stat-strip">
          <Stat value="4" label="deliberation modes" />
          <Stat value={String(MODEL_COUNT)} label={`models across ${PROVIDER_COUNT} providers`} />
          <Stat value="6" label="rounds per debate" />
          <Stat
            value={runsRecorded === null ? "—" : String(runsRecorded)}
            label={
              runsRecorded === null
                ? "runs recorded (unavailable)"
                : runsRecorded === 1
                  ? "run recorded"
                  : "runs recorded"
            }
          />
        </div>
      </div>

      <div className="mt44">
        <div className="section-head">
          <div>
            <span className="eyebrow">Mode registry</span>
            <h3 className="display d3 mt6">Choose how the models deliberate</h3>
          </div>
          <span className="small">Every mode renders into the same run surface.</span>
        </div>

        <div className="grid g4">
          {modes.map((mode) => (
            <Link key={mode.title} href={mode.href} className={`mode-card${mode.soon ? " soon" : ""}`}>
              <span className={`chip corner${mode.corner.tone === "pro" ? " pro" : ""}`}>
                {mode.corner.tone === "pro" ? <span className="dot" /> : null}
                {mode.corner.label}
              </span>
              <div className="mode-glyph">
                <svg
                  width="17"
                  height="17"
                  viewBox="0 0 16 16"
                  fill="none"
                  className={mode.glyphTone}
                  strokeWidth={1.4}
                  aria-hidden="true"
                >
                  {mode.glyph}
                </svg>
              </div>
              <h4>{mode.title}</h4>
              <p>{mode.body}</p>
              <div className="mode-foot">
                {mode.tags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt44">
        <div className="section-head">
          <div>
            <span className="eyebrow">Engine pipeline</span>
            <h3 className="display d3 mt6">What happens after you start a run</h3>
          </div>
        </div>
        <div className="pipeline">
          {pipeline.map((step) => (
            <div className="pipe-step" key={step.n}>
              <div className="pipe-n">{step.n}</div>
              <div className="pipe-t">{step.title}</div>
              <div className="pipe-d">{step.detail}</div>
              <div className={`pipe-bar ${step.bar}`} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="stat">
      <div className="stat-v">{value}</div>
      <div className="stat-k meta">{label}</div>
    </div>
  );
}
