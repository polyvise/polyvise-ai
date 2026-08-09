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
  const [mode, setMode] = useState<DebateMode>("hybrid_council");
  const [councilSize, setCouncilSize] = useState<CouncilSize>("quartet");
  const [agentCountChoice, setAgentCountChoice] = useState(5);
  const [models, setModels] = useState<ModelSelections>(defaultSelections);
  const [showRouting, setShowRouting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * What the selected mode will actually run, as summary chips.
   *
   * For the council, the size names count debaters while the roster includes
   * the neutral judge — so duo is three agents and quartet is five. The lineup
   * rider spells that out; without it the count reads as a contradiction of
   * the name next to it. The other modes have no judge, so they say what they
   * do have.
   */
  const shape =
    mode === "consensus"
      ? [`${agentCountChoice} agents`, "3 rounds", "no judge"]
      : mode === "advisory_panel"
        ? ["4 lenses", "advise separately", "chair synthesis"]
        : [
            "6 rounds",
            councilSize === "duo" ? "3 agents · 1v1 + judge" : "5 agents · 2v2 + judge"
          ];

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
          mode,
          ...(mode === "consensus" ? { consensus: { agentCount: agentCountChoice, rounds: 3 } } : {}),
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
            {modeLabels[mode]}
          </span>
          <span className="chip">Cited evidence</span>
          {shape.map((label) => (
            <span className="chip" key={label}>
              {label}
            </span>
          ))}
        </div>

        <div className="composer-bar">
          <span className="meta">Mode</span>
          <div className="seg">
            {(["hybrid_council", "consensus", "advisory_panel"] as const).map((option) => (
              <button
                key={option}
                type="button"
                className={mode === option ? "on" : undefined}
                onClick={() => setMode(option)}
              >
                {modeLabels[option]}
              </button>
            ))}
          </div>

          {mode === "hybrid_council" ? (
            <>
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
            </>
          ) : null}

          {mode === "consensus" ? (
            <>
              <span className="meta" style={{ marginLeft: 8 }}>
                Agents
              </span>
              <div className="seg">
                {[3, 5, 7].map((count) => (
                  <button
                    key={count}
                    type="button"
                    className={agentCountChoice === count ? "on" : undefined}
                    onClick={() => setAgentCountChoice(count)}
                  >
                    {count}
                  </button>
                ))}
              </div>
            </>
          ) : null}

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
