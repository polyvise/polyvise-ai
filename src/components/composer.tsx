"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FormEvent, useState } from "react";
import { rememberLocalRun } from "@/lib/local-runs";
import { defaultSelections, modelCatalog, slots, type SlotId } from "@/lib/model-catalog";
import type { CouncilSize, DebateMode, DebateRecord } from "@polyvise/core/debate/types";
import { modeLabels } from "@/lib/run-record";

type ModelSelections = Record<SlotId, string>;

const examples = [
  "Should cities ban private cars downtown?",
  "Is nuclear power a good climate strategy?",
  "Remote job or higher-paying hybrid offer?",
  "Should schools allow phones during the day?"
];

const slotTone: Record<SlotId, "pro" | "con" | "judge" | "neutral"> = {
  yes: "pro",
  no: "con",
  deep: "neutral",
  judge: "judge",
  quick: "neutral"
};

const slotLabel: Record<SlotId, string> = {
  yes: "For",
  no: "Against",
  deep: "Both sides",
  judge: "Neutral",
  quick: "Setup"
};

/**
 * One card per way of deliberating, each with a diagram of who is in the
 * room. The names are the ones a newcomer can parse; the engine's own
 * labels stay in modeLabels for the run record.
 */
const modeOptions: { id: DebateMode; title: string; body: string; dots: React.ReactNode; start: string }[] = [
  {
    id: "hybrid_council",
    title: "Debate",
    body: "Two argue for, two against, a judge scores it. Best for yes-or-no decisions.",
    start: "Start the debate",
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
    id: "consensus",
    title: "Consensus",
    body: "Several models answer alone, then revise until they settle. Best for estimates.",
    start: "Start the consensus run",
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
    id: "advisory_panel",
    title: "Advisory panel",
    body: "An economist, an ethicist, an operator and a skeptic each advise. Best for strategy.",
    start: "Convene the panel",
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
  }
];

export function Composer() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [mode, setMode] = useState<DebateMode>("hybrid_council");
  const [councilSize, setCouncilSize] = useState<CouncilSize>("quartet");
  const [agentCountChoice, setAgentCountChoice] = useState(5);
  const [models, setModels] = useState<ModelSelections>(defaultSelections);
  // The con side mirrors the pro side until it is changed on its own, so
  // picking one model for "the debaters" is a single choice.
  const [conFollowsPro, setConFollowsPro] = useState(true);
  const [showRouting, setShowRouting] = useState(false);

  function chooseModel(slot: SlotId, model: string) {
    if (slot === "yes") {
      setModels((current) => ({ ...current, yes: model, ...(conFollowsPro ? { no: model } : {}) }));
      return;
    }
    if (slot === "no") {
      setConFollowsPro(false);
    }
    setModels((current) => ({ ...current, [slot]: model }));
  }

  function matchConToPro() {
    setConFollowsPro(true);
    setModels((current) => ({ ...current, no: current.yes }));
  }
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * What the selected mode will actually run, in plain words.
   *
   * For the council, the size names count debaters while the roster includes
   * the neutral judge — so duo is three agents and quartet is five. The other
   * modes have no judge, so they say what they do have.
   */
  const facts =
    mode === "consensus"
      ? ["Cited evidence", `${agentCountChoice} agents`, "3 rounds", "no judge"]
      : mode === "advisory_panel"
        ? ["Cited evidence", "4 lenses", "a chair writes it up"]
        : ["Cited evidence", "6 rounds", councilSize === "duo" ? "1 vs 1 with a judge" : "2 vs 2 with a judge"];

  const selected = modeOptions.find((option) => option.id === mode) ?? modeOptions[0];
  const ready = subject.trim().length >= 4 && !isSubmitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          context: context.trim() || undefined,
          mode,
          ...(mode === "consensus" ? { consensus: { agentCount: agentCountChoice, rounds: 3 } } : {}),
          evidence: "cited",
          councilSize,
          models
        })
      });

      const payload = (await response.json()) as { debate?: DebateRecord; error?: string };
      if (!response.ok || !payload.debate) {
        throw new Error(payload.error ?? "Unable to start the run.");
      }

      rememberLocalRun(payload.debate.id);
      router.push(`/runs/${payload.debate.id}` as Route);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start the run.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="composer">
        <div className="composer-top">
          <label className="q-field-label" htmlFor="subject">
            <svg
              width="13"
              height="13"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10.5 2.5a1.5 1.5 0 0 1 2 2L4.5 12.5l-3 .8.8-3z" />
            </svg>
            Type your question
          </label>
          <div className="q-field">
            <textarea
              id="subject"
              className="q-input"
              rows={2}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Should a 40-person company move customer support to AI-first this year?"
            />
          </div>
        </div>

        <div className="composer-mid">
          <div className="mode-pick" role="radiogroup" aria-label="How the models deliberate">
            {modeOptions.map((option) => {
              const on = option.id === mode;
              return (
                <button
                  type="button"
                  key={option.id}
                  role="radio"
                  aria-checked={on}
                  className={`mode-opt${on ? " on" : ""}`}
                  onClick={() => setMode(option.id)}
                >
                  <span className="dots" aria-hidden="true">
                    {option.dots}
                  </span>
                  <h4>{option.title}</h4>
                  <p>{option.body}</p>
                </button>
              );
            })}
          </div>

          {mode === "hybrid_council" ? (
            <div className="row gap10 wrap mt14">
              <span className="small">Council size</span>
              <div className="seg" role="radiogroup" aria-label="Council size">
                <button
                  type="button"
                  role="radio"
                  aria-checked={councilSize === "duo"}
                  className={councilSize === "duo" ? "on" : undefined}
                  onClick={() => setCouncilSize("duo")}
                >
                  Duo · 1 vs 1
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={councilSize === "quartet"}
                  className={councilSize === "quartet" ? "on" : undefined}
                  onClick={() => setCouncilSize("quartet")}
                >
                  Quartet · 2 vs 2
                </button>
              </div>
            </div>
          ) : null}

          {mode === "consensus" ? (
            <div className="row gap10 wrap mt14">
              <span className="small">How many models</span>
              <div className="seg" role="radiogroup" aria-label="Number of agents">
                {[3, 5, 7].map((count) => (
                  <button
                    key={count}
                    type="button"
                    role="radio"
                    aria-checked={agentCountChoice === count}
                    className={agentCountChoice === count ? "on" : undefined}
                    onClick={() => setAgentCountChoice(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="composer-bar">
          <div className="composer-facts">
            {facts.map((fact, index) => (
              <span className="row gap10" key={fact}>
                {index > 0 ? <span className="sep" /> : null}
                {fact}
              </span>
            ))}
          </div>
          <div className="composer-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setShowRouting((open) => !open)}
              aria-expanded={showRouting}
            >
              {showRouting ? "Hide model choices" : "Choose models"}
            </button>
            <button type="submit" className="btn btn-primary btn-lg" disabled={!ready}>
              {isSubmitting ? <span className="spin sm" /> : null}
              {isSubmitting ? "Starting…" : selected.start}
              {isSubmitting ? null : (
                <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 10h13M11 5l5 5-5 5" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {showRouting ? (
          <div className="slot-grid">
            <div className="grid g3">
              {slots.map((slot) => (
                <div className="slot" key={slot.id}>
                  <div className="slot-h">
                    <span className={`chip ${slotTone[slot.id]}`}>
                      <span className="dot" />
                      {slotLabel[slot.id]}
                    </span>
                    <span className="lbl">{slot.title}</span>
                    {slot.id === "no" ? (
                      conFollowsPro ? (
                        <span className="meta push">same as pro</span>
                      ) : (
                        <button type="button" className="link push" style={{ fontSize: 13 }} onClick={matchConToPro}>
                          Match pro
                        </button>
                      )
                    ) : null}
                  </div>
                  <select
                    className="select"
                    value={models[slot.id]}
                    onChange={(event) => chooseModel(slot.id, event.target.value)}
                    aria-label={slot.title}
                  >
                    {modelCatalog.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.id}
                      </option>
                    ))}
                  </select>
                  <p>{slot.description}</p>
                </div>
              ))}
            </div>
            <p className="meta mt14">
              Each seat can run a different model. The telemetry tab on every run shows what each seat cost and how
              long it took.
            </p>

            <div className="mt18" style={{ paddingTop: 18, borderTop: "1px solid var(--line)" }}>
              <label htmlFor="context" className="lbl">
                Context
              </label>
              <p className="meta mt6">
                Constraints, audience, time horizon, or what you already believe. Passed to the framing step.
              </p>
              <textarea
                id="context"
                className="ctx-input mt10"
                value={context}
                onChange={(event) => setContext(event.target.value)}
                placeholder="Optional. Anything the models should treat as given."
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="callout alert mt18" style={{ maxWidth: 920, margin: "18px auto 0" }}>
          <svg
            className="ci"
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            style={{ color: "var(--alert)" }}
            aria-hidden="true"
          >
            <path d="M8 2.4L14.6 13.6H1.4z" strokeLinejoin="round" />
            <path d="M8 6.6v3M8 11.4v.5" strokeLinecap="round" />
          </svg>
          <div>
            <h5>The run didn&apos;t start</h5>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      <div className="example-row">
        <span className="meta" style={{ alignSelf: "center", marginRight: 4 }}>
          Or try
        </span>
        {examples.map((example) => (
          <button key={example} type="button" className="example" onClick={() => setSubject(example)}>
            {example}
          </button>
        ))}
      </div>

      <p className="meta mt18" style={{ textAlign: "center", maxWidth: 620, margin: "18px auto 0" }}>
        Medical, legal, financial and safety questions run as normal. The framing step notes the stakes and the verdict
        carries a disclaimer.
      </p>
    </form>
  );
}
