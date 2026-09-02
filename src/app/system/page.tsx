import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design system | Polyvise",
  description: "The tokens and rules every Polyvise surface is built from."
};

const swatches = [
  { token: "--void", name: "Paper — page", values: "#F6F3EC / #15140F" },
  { token: "--surface", name: "Card", values: "#FFFFFF / #1F1D17" },
  { token: "--sunken", name: "Well — inputs, bars", values: "#EEEAE1 / #0F0E0A" },
  { token: "--ivory", name: "Ink — headlines", values: "#1C1B17 / #F1EDE3" },
  { token: "--muted", name: "Ink — secondary", values: "#5E5A52 / #BDB7AA" },
  { token: "--pro", name: "For", values: "#2F7D4E / #5FC98A" },
  { token: "--con", name: "Against", values: "#C97418 / #F0A24A" },
  { token: "--judge", name: "Judge", values: "#6B5AC6 / #A997E6" }
];

const rules = [
  {
    title: "For and against columns are symmetrical",
    body: "The two columns share a width, a type size and a background. Colour marks the side; layout never suggests a winner before the judge has scored."
  },
  {
    title: "Serif type is used only for conclusions",
    body: "Display type appears on the question, verdict headlines and section titles. Never on interface chrome, and never on a model's turn."
  },
  {
    title: "Monospace marks what the engine measured",
    body: "Model ids, latency, tokens, cost and source refs are set in monospace. Labels and copy are sentence-case sans, never uppercase."
  },
  {
    title: "Every section has a failed state",
    body: "Each section is designed for empty, loading and failed. The failed state names both the model that was asked and why it didn't return anything usable."
  }
];

export default function SystemPage() {
  return (
    <section className="page">
      <span className="eyebrow">Design system</span>
      <h2 className="display d2 mt10">Paper</h2>
      <p className="lede mt10 mw640">
        Warm paper in the light, warm near-black in the dark. Serif type is reserved for the system&apos;s conclusions.
        Sans handles everything you read at length or click on. Monospace marks any value the engine measured. Colour
        is used only to distinguish for, against and neutral.
      </p>

      <h3 className="display d3 mt34">Palette</h3>
      <p className="small mt6">
        Light and dark are peers. Every swatch below is drawn from a CSS variable, so this page repaints when you
        switch themes — nothing here is a hardcoded hex.
      </p>
      <div className="grid g4 mt14">
        {swatches.map((swatch) => (
          <div className="sw" key={swatch.token}>
            <div className="sw-c" style={{ background: `var(${swatch.token})` }} />
            <div className="sw-m">
              <div className="small">{swatch.name}</div>
              <div className="meta mono">{swatch.values}</div>
            </div>
          </div>
        ))}
      </div>
      <p className="meta mt14">
        Each side also has a tint for chips and avatars, a hairline, a wash for backgrounds, and an ink for text on
        its tint. The sides get lighter on dark so they clear contrast; the tints become deep rather than translucent.
      </p>

      <h3 className="display d3 mt34">Type</h3>
      <div className="mt14">
        <div className="type-row">
          <span className="meta">Instrument Serif 72</span>
          <span className="display d1">Verdict</span>
        </div>
        <div className="type-row">
          <span className="meta">Instrument Serif 40</span>
          <span className="display d2">Verdict headlines</span>
        </div>
        <div className="type-row">
          <span className="meta">Instrument Serif 30</span>
          <span className="display d3">Section titles</span>
        </div>
        <div className="type-row">
          <span className="meta">Instrument Sans 15 / 1.55</span>
          <span>Body copy and model turns. Everything you read at length.</span>
        </div>
        <div className="type-row">
          <span className="meta">Instrument Sans 14</span>
          <span className="small">Secondary UI, card metadata, helper text.</span>
        </div>
        <div className="type-row">
          <span className="meta">JetBrains Mono 12</span>
          <code>anthropic/claude-opus-4.8 · 1.4s · $0.014</code>
        </div>
      </div>

      <h3 className="display d3 mt34">Components</h3>
      <p className="small mt6">Radii 10 / 14 / 22 and pills. Controls are 40 tall, the primary action 48. One soft warm shadow.</p>
      <div className="grid g3 mt14">
        <div className="card card-pad">
          <div className="eyebrow">Chips and seats</div>
          <div className="row gap8 wrap mt10">
            <span className="chip pro">
              <span className="dot" />
              The council leans yes
            </span>
            <span className="chip con">
              <span className="dot" />
              Leans no
            </span>
            <span className="chip judge">
              <span className="dot" />
              Chair
            </span>
            <span className="chip">Neutral</span>
            <span className="chip alert">
              <span className="dot" />
              Failed
            </span>
          </div>
          <div className="row gap8 wrap mt14">
            <span className="av lg pro">P1</span>
            <span className="av lg con">C1</span>
            <span className="av lg judge">J</span>
            <span className="cite">S4</span>
          </div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Buttons</div>
          <div className="row gap8 wrap mt10">
            <span className="btn btn-primary btn-lg">Start the debate</span>
            <span className="btn btn-ink">New question</span>
            <span className="btn">Export</span>
            <span className="btn btn-ghost">Choose models</span>
          </div>
        </div>
        <div className="card card-pad">
          <div className="eyebrow">Stages</div>
          <div className="stepper" style={{ marginTop: 12 }}>
            <div className="step done">
              <span className="step-i">✓</span>
              <span className="step-l">Frame</span>
            </div>
            <div className="step now">
              <span className="step-i">2</span>
              <span className="step-l">Debate</span>
            </div>
            <div className="step">
              <span className="step-i">3</span>
              <span className="step-l">Judge</span>
            </div>
          </div>
        </div>
      </div>

      <h3 className="display d3 mt34">Rules the system enforces</h3>
      <div className="grid g2 mt14">
        {rules.map((rule) => (
          <div className="card card-pad" key={rule.title}>
            <h4 className="card-title">{rule.title}</h4>
            <p className="small mt6">{rule.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
