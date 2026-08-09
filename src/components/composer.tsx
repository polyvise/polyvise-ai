"use client";

import { useRouter } from "next/navigation";
import type { Route } from "next";
import { FormEvent, useState } from "react";
import { rememberLocalRun } from "@/lib/local-runs";
import { defaultSelections, modelCatalog, slots, type SlotId } from "@/lib/model-catalog";
import type { CouncilSize, DebateRecord } from "@polyvise/core/debate/types";

type ModelSelections = Record<SlotId, string>;

const examples = [
  "Should cities ban private cars downtown?",
  "Is nuclear power a good climate strategy?",
  "Remote job or higher-paying hybrid offer?",
  "Should schools allow phones during the day?"
];

const slotTone: Record<SlotId, "pro" | "con" | "judge"> = {
  quick: "pro",
  deep: "con",
  judge: "judge"
};

const slotLabel: Record<SlotId, string> = {
  quick: "Pro",
  deep: "Con",
  judge: "Judge"
};

export function Composer() {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [councilSize, setCouncilSize] = useState<CouncilSize>("quartet");
  const [models, setModels] = useState<ModelSelections>(defaultSelections);
  const [showRouting, setShowRouting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * The size names count debaters, but the roster the run actually spins up
   * includes the neutral judge — so duo is three agents and quartet is five.
   * The lineup rider spells that out; without it the count reads as a
   * contradiction of the name next to it.
   */
  const agentCount = councilSize === "duo" ? 3 : 5;
  const lineup = councilSize === "duo" ? "1v1 + judge" : "2v2 + judge";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (subject.trim().length < 4 || isSubmitting) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          context: context.trim() || undefined,
          mode: "hybrid_council",
          evidence: "cited",
          councilSize,
          models
        })
      });

      const payload = (await response.json()) as { debate?: DebateRecord; error?: string };
      if (!response.ok || !payload.debate) {
        throw new Error(payload.error ?? "Unable to start the debate.");
      }

      rememberLocalRun(payload.debate.id);
      router.push(`/runs/${payload.debate.id}` as Route);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to start the debate.");
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="composer mt24">
        <div className="composer-top">
          <textarea
            className="q-input"
            rows={2}
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            placeholder="Should a 40-person company adopt AI customer support this year?"
            aria-label="Question"
          />
        </div>

        <div className="composer-mid">
          <span className="chip">
            <span className="dot" style={{ background: "var(--judge)" }} />
            Hybrid Council
          </span>
          <span className="chip">Cited evidence</span>
          <span className="chip">6 rounds</span>
          <span className="chip">
            {agentCount} agents · {lineup}
          </span>
        </div>

        <div className="composer-bar">
          <span className="meta">Mode</span>
          <div className="seg">
            <button type="button" className="on">
              Hybrid Council
            </button>
            <button type="button" disabled title="Not yet available in polyvise-core">
              Consensus
            </button>
            <button type="button" disabled title="Not yet available in polyvise-core">
              Advisory Panel
            </button>
          </div>

          <span className="meta" style={{ marginLeft: 8 }}>
            Size
          </span>
          <div className="seg">
            <button
              type="button"
              className={councilSize === "duo" ? "on" : undefined}
              onClick={() => setCouncilSize("duo")}
            >
              Duo
            </button>
            <button
              type="button"
              className={councilSize === "quartet" ? "on" : undefined}
              onClick={() => setCouncilSize("quartet")}
            >
              Quartet
            </button>
          </div>

          <button
            type="button"
            className="btn btn-sm btn-ghost push"
            onClick={() => setShowRouting((open) => !open)}
            aria-expanded={showRouting}
          >
            Model routing {showRouting ? "▴" : "▾"}
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={subject.trim().length < 4 || isSubmitting}>
            {isSubmitting ? <span className="spin sm" /> : null}
            {isSubmitting ? "Starting…" : "Start run →"}
          </button>
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
                  </div>
                  <select
                    className="select"
                    value={models[slot.id]}
                    onChange={(event) => setModels({ ...models, [slot.id]: event.target.value })}
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
              Routing is set per slot, so you can put a cheap model against an expensive one and compare them in the
              telemetry afterwards.
            </p>

            <div className="mt18" style={{ paddingTop: 14, borderTop: "1px solid var(--line)" }}>
              <label htmlFor="context" className="lbl" style={{ fontSize: 12, fontWeight: 600, color: "var(--ivory)" }}>
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
                placeholder="Optional. Anything the agents should treat as given."
              />
            </div>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="callout alert mt18">
          <svg
            className="ci"
            width="15"
            height="15"
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

      <div className="mt24">
        <span className="eyebrow">Try one</span>
        <div className="example-row">
          {examples.map((example) => (
            <button key={example} type="button" className="example" onClick={() => setSubject(example)}>
              {example}
            </button>
          ))}
        </div>
      </div>

      <div className="callout note mt24">
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
          <h5>Medical, legal, financial and safety topics are flagged</h5>
          <p>
            The framing step classifies the stakes and attaches a disclaimer to the verdict instead of refusing the
            question. You&apos;ll see the notice on the run once framing completes.
          </p>
        </div>
      </div>
    </form>
  );
}
