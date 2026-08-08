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
    body: "Two agents argue for, two against, one neutral judge scores it. Six rounds, ending in a verdict with a confidence figure.",
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
    body: "Agents answer alone, then revise across rounds. Reports the range they settle into — and which ones never moved.",
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
    body: "An economist, an ethicist, an operator and a skeptic advise separately. A chair maps where they agree and where they clash.",
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
    body: "One prompt, every configured model, answers side by side — with the latency, cost and token count for each.",
    tags: ["Comparative", "Benchmark"],
    soon: false
  }
];

const pipeline = [
  {
    n: "01",
    title: "Frame",
    detail: "Your question becomes a resolution agents can argue, tagged by topic and by what's at stake.",
    tone: "judge"
  },
  {
    n: "02",
    title: "Scout",
    detail: "Each agent stakes out a position and lists its assumptions — before seeing anyone else's.",
    tone: "split"
  },
  {
    n: "03",
    title: "Evidence",
    detail: "Sources are retrieved and graded primary, expert or methodology. Promotional and undated get cut.",
    tone: "pro"
  },
  {
    n: "04",
    title: "Deliberate",
    detail: "Opening, cross-examination, rebuttal, closing. Every turn records the claims and sources it rests on.",
    tone: "split"
  },
  {
    n: "05",
    title: "Judge",
    detail: "A neutral model scores five dimensions, writes the verdict, and names the evidence that would overturn it.",
    tone: "judge"
  }
];

/**
 * Who holds the floor in each of the six rounds: both sides trade through
 * opening, cross-examination, rebuttal and closing, then the judge takes
 * review and synthesis. Drives the specimen lane chart in the hero — the
 * page's one picture of what a run actually looks like.
 */
const traceLanes = [
  { name: "For", tone: "pro", rounds: [1, 1, 1, 1, 0, 0] },
  { name: "Against", tone: "con", rounds: [1, 1, 1, 1, 0, 0] },
  { name: "Judge", tone: "judge", rounds: [0, 0, 0, 0, 1, 1] }
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

        <div className="hero-body">
          <div className="hero-inner">
            <span className="eyebrow">Multi-model deliberation</span>
            <h1 className="display d1">
              Several models argue it out. You get a verdict you can <em>audit</em>.
            </h1>
            <p className="lede">
              Put a question through a structured format — adversarial debate, consensus, or an advisory panel — run by
              independent models. Every claim links to its source, and every step names the model behind it.
            </p>
            <div className="hero-cta">
              <Link href={"/compose" as Route} className="btn btn-primary">
                Start a run →
              </Link>
              <Link href={"/runs" as Route} className="btn">
                Browse past runs
              </Link>
            </div>
          </div>

          <RunSpecimen />
        </div>

        <div className="stat-strip">
          <Stat value="4" label="deliberation modes" />
          <Stat value={String(MODEL_COUNT)} label={`models · ${PROVIDER_COUNT} providers`} />
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
        <div className="section-head ruled">
          <div>
            <span className="eyebrow">Modes</span>
            <h3 className="display d3 mt6">Four ways to work a question</h3>
          </div>
          <span className="small">Every mode renders into the same run surface.</span>
        </div>

        <div className="grid g4">
          {modes.map((mode) => (
            <Link key={mode.title} href={mode.href} className={`mode-card${mode.soon ? " soon" : ""}`}>
              <div className="mode-top">
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
                <span className={`chip push${mode.corner.tone === "pro" ? " pro" : ""}`}>
                  {mode.corner.tone === "pro" ? <span className="dot" /> : null}
                  {mode.corner.label}
                </span>
              </div>
              <h4>{mode.title}</h4>
              <p>{mode.body}</p>
              <div className="mode-foot">
                {mode.tags.map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
                <span className="mode-go" aria-hidden="true">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      <div className="mt44">
        <div className="section-head ruled">
          <div>
            <span className="eyebrow">Pipeline</span>
            <h3 className="display d3 mt6">What happens after you hit start</h3>
          </div>
          <span className="small">Five stages, every one of them on the record.</span>
        </div>
        <div className="pipeline">
          {pipeline.map((step) => (
            <div className="pipe-step" key={step.n}>
              <div className="pipe-rail">
                <span className={`pipe-node ${step.tone}`} />
                <span className="pipe-n">{step.n}</span>
                <span className="pipe-line" />
              </div>
              <div className="pipe-t">{step.title}</div>
              <div className="pipe-d">{step.detail}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="cta-band">
        <div className="cta-copy">
          <span className="eyebrow">Ready when you are</span>
          <h3 className="display d3 mt6">Ask something worth arguing about</h3>
          <p className="small mt10">
            Pick a mode, pick your models, and watch the transcript build. Nothing is hidden behind the verdict.
          </p>
        </div>
        <div className="row gap8 wrap">
          <Link href={"/compose" as Route} className="btn btn-primary">
            Start a run →
          </Link>
          <Link href={"/lab" as Route} className="btn">
            Compare models first
          </Link>
        </div>
      </div>
    </section>
  );
}

function RunSpecimen() {
  return (
    <div className="trace" aria-hidden="true">
      <div className="trace-head">
        <span className="chip pro">
          <span className="dot" />
          Live
        </span>
        <span className="meta push">debate_8f2c41</span>
      </div>

      <div className="trace-q">Should we move our billing stack off a single vendor?</div>

      <div className="trace-lanes">
        <div className="trace-row">
          <span />
          {[1, 2, 3, 4, 5, 6].map((round) => (
            <span className="trace-num" key={round}>
              R{round}
            </span>
          ))}
        </div>
        {traceLanes.map((lane) => (
          <div className="trace-row" key={lane.name}>
            <span className="trace-name">{lane.name}</span>
            {lane.rounds.map((active, index) => (
              <span className={`trace-cell${active ? ` ${lane.tone}` : ""}`} key={index} />
            ))}
          </div>
        ))}
      </div>

      <div className="trace-foot">
        <span className="trace-verdict">Affirmative</span>
        <span className="trace-meter">
          <i style={{ width: "78%" }} />
        </span>
        <span className="meta">78% confidence</span>
      </div>
    </div>
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
