"use client";

import type { Route } from "next";
import { useRouter } from "next/navigation";
import { FormEvent, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  SlidersHorizontal,
  Plus,
  X,
} from "lucide-react";
import { rememberLocalRun } from "@/lib/local-runs";
import { defaultSelections, modelCatalog } from "@/lib/model-catalog";
import type { CouncilSize, DebateMode } from "@polyvise/core/debate/types";
import {
  buildRunRequest,
  modeGuide,
  modeOrder,
  modelSlotsForMode,
} from "@/lib/mode-guide";
import { PerspectivePreview } from "./perspective-preview";

export function Composer({
  initialMode = "hybrid_council",
}: {
  initialMode?: DebateMode;
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");
  const [context, setContext] = useState("");
  const [mode, setMode] = useState(initialMode);
  const [councilSize, setCouncilSize] = useState<CouncilSize>("quartet");
  const [agentCount, setAgentCount] = useState(5);
  const [rounds, setRounds] = useState(3);
  const [models, setModels] = useState(defaultSelections);
  const [showContext, setShowContext] = useState(false);
  const [showRouting, setShowRouting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitting = useRef(false);
  const subjectRef = useRef<HTMLTextAreaElement>(null);
  const guide = modeGuide[mode];
  const ready =
    subject.trim().length >= 4 &&
    subject.length <= 600 &&
    context.length <= 1600 &&
    !isSubmitting;
  const customModels = modelSlotsForMode(mode, councilSize).some(
    ({ id }) => models[id] !== defaultSelections[id],
  );
  const settingsSummary =
    mode === "hybrid_council"
      ? `${councilSize === "duo" ? "1 vs 1" : "2 vs 2"} + judge · 6 rounds`
      : mode === "consensus"
        ? `${agentCount} perspectives · ${rounds} rounds`
        : "4 advisors + chair";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const response = await fetch("/api/debates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          buildRunRequest({
            subject,
            context,
            mode,
            councilSize,
            agentCount,
            rounds,
            models,
          }),
        ),
      });
      const payload = (await response.json()) as {
        debate?: { id: string };
        error?: string;
        issues?: { message: string }[];
      };
      if (!response.ok || !payload.debate?.id) {
        throw new Error(
          response.status === 429
            ? "You’ve started several runs recently. Wait a minute, then try again. Your question is still here."
            : (payload.issues?.[0]?.message ??
              payload.error ??
              "Unable to start the run. Please try again."),
        );
      }
      rememberLocalRun(payload.debate.id);
      router.push(`/runs/${payload.debate.id}` as Route);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to start the run. Please try again.",
      );
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <div className="decision-workspace" id="ask">
      <form
        className="question-workbench"
        onSubmit={handleSubmit}
        aria-label="Create a run"
        aria-busy={isSubmitting}
      >
        <fieldset disabled={isSubmitting} className="workbench-fields">
          <div className="workbench-section">
            <div className="step-heading">
              <span className="step-number">01</span>
              <h2>Your question</h2>

            </div>
            <label htmlFor="subject" className="sr-only">
              Your question
            </label>
            <textarea
              ref={subjectRef}
              id="subject"
              className="decision-input"
              rows={2}
              maxLength={600}
              required
              minLength={4}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder={guide.placeholder}
              aria-describedby="question-hint"
            />
            <div className="question-tools">
              <button
                type="button"
                className="text-action"
                onClick={() => setShowContext(!showContext)}
                aria-expanded={showContext}
                aria-controls="question-context"
              >
                {showContext ? <X size={14} /> : <Plus size={14} />}{" "}
                {showContext
                  ? "Hide context"
                  : context
                    ? "Edit context"
                    : "Add context"}
                <span className="optional-note">optional</span>
              </button>
              <span id="question-hint" className="input-count">
                {subject.length > 0 && subject.trim().length < 4
                  ? "At least 4 characters · "
                  : ""}
                {subject.length}/600
              </span>
            </div>
            {showContext && (
              <div id="question-context" className="context-well">
                <label htmlFor="context">What should the models know?</label>
                <p>
                  Include your constraints, audience, time horizon or what
                  success looks like.
                </p>
                <textarea
                  id="context"
                  rows={3}
                  maxLength={1600}
                  value={context}
                  onChange={(event) => setContext(event.target.value)}
                  placeholder="For example: We’re a team of 12, with a six-month runway and customers in three time zones."
                />
                <span className="input-count">{context.length}/1600</span>
              </div>
            )}
            <details className="question-examples"><summary>Try a question</summary>

              {guide.examples.map((example) => (
                <button
                  type="button"
                  key={example}
                  onClick={() => {
                    setSubject(example);
                    subjectRef.current?.focus();
                  }}
                >
                  {example}
                  <ArrowRight size={13} />
                </button>
              ))}
            </details>
          </div>

          <div className="workbench-section mode-section">
            <div className="step-heading">
              <span className="step-number">02</span>
              <h2>Mode</h2>
            </div>
            <fieldset className="goal-picker">
              <legend className="sr-only">How the models deliberate</legend>
              {modeOrder.map((id) => (
                <label
                  key={id}
                  className={`goal-option ${mode === id ? "selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="mode"
                    value={id}
                    checked={mode === id}
                    onChange={() => {
                      setMode(id);
                      setError(null);
                    }}
                  />
                  <span className={`goal-symbol ${id}`} aria-hidden="true">
                    {id === "hybrid_council"
                      ? "⇄"
                      : id === "consensus"
                        ? "≋"
                        : "✳"}
                  </span>
                  <span className="goal-name">{modeGuide[id].name}</span>
                  <span className="goal-mode">{modeGuide[id].goal}</span>
                  <span className="goal-question">{modeGuide[id].prompt}</span>
                  <span className="goal-check" aria-hidden="true">
                    <Check size={11} />
                  </span>
                </label>
              ))}
            </fieldset>
            <p className="mode-description" aria-live="polite">
              {guide.description}
            </p>
            <div className="mode-configuration"><div className="step-heading"><span className="step-number">03</span><h2>Perspectives</h2></div>
              {mode === "hybrid_council" && (
                <fieldset className="inline-choice">
                  <legend>
                    Debaters <span>+ a neutral judge</span>
                  </legend>
                  <div className="choice-options">
                    {(["duo", "quartet"] as const).map((size) => (
                      <label
                        key={size}
                        className={councilSize === size ? "selected" : ""}
                      >
                        <input
                          type="radio"
                          name="size"
                          value={size}
                          checked={councilSize === size}
                          onChange={() => setCouncilSize(size)}
                        />
                        {size === "duo"
                          ? "1 vs 1 · focused"
                          : "2 vs 2 · more perspectives"}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              {mode === "consensus" && (
                <div className="consensus-settings">
                  <fieldset className="inline-choice">
                    <legend>Perspectives</legend>
                    <div className="choice-options">
                      {[3, 5, 7].map((count) => (
                        <label
                          key={count}
                          className={agentCount === count ? "selected" : ""}
                        >
                          <input
                            type="radio"
                            name="agents"
                            checked={agentCount === count}
                            onChange={() => setAgentCount(count)}
                          />
                          {count}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <label className="rounds-choice">
                    Rounds
                    <select
                      value={rounds}
                      onChange={(event) =>
                        setRounds(Number(event.target.value))
                      }
                    >
                      {[2, 3, 4, 5].map((count) => (
                        <option key={count} value={count}>
                          {count}
                          {count === 3 ? " · default" : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <p>
                    More perspectives and rounds mean more model calls. All
                    perspectives use the selected reasoning model.
                  </p>
                </div>
              )}
              {mode === "advisory_panel" && (
                <div className="lens-roster">
                  {["Economist", "Ethicist", "Operator", "Skeptic"].map(
                    (lens, index) => (
                      <span key={lens}>
                        <i style={{ background: `var(--lens-${index + 1})` }} />
                        {lens}
                      </span>
                    ),
                  )}
                  <p>
                    Four distinct lenses. One model for the advisors; a separate
                    model choice for the chair.
                  </p>
                </div>
              )}
            </div>
            <button
              className="routing-toggle"
              type="button"
              aria-expanded={showRouting}
              aria-controls="model-settings"
              onClick={() => setShowRouting(!showRouting)}
            >
              <SlidersHorizontal size={15} />
              Model settings
              <span>{customModels ? "Customized" : "Defaults selected"}</span>
              <ChevronDown size={14} className={showRouting ? "rotated" : ""} />
            </button>
            {showRouting && (
              <div id="model-settings" className="routing-settings">
                <div className="row gap10 wrap">
                  <p>
                    Choose models by role. Multiple perspectives can use the
                    same model.
                  </p>
                  <button
                    type="button"
                    className="text-action"
                    onClick={() => setModels({ ...defaultSelections })}
                  >
                    Reset defaults
                  </button>
                </div>
                {modelSlotsForMode(mode, councilSize).map((slot) => (
                  <div className="routing-row" key={slot.id}>
                    <label htmlFor={`model-${slot.id}`}>
                      {slot.title}
                      <span>{slot.description}</span>
                    </label>
                    <select
                      id={`model-${slot.id}`}
                      value={models[slot.id]}
                      onChange={(event) =>
                        setModels((current) => ({
                          ...current,
                          [slot.id]: event.target.value,
                        }))
                      }
                    >
                      {modelCatalog.map((option) => (
                        <option key={option.id} value={option.id}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="workbench-submit">
            <div>
              <span className="submit-mode">{guide.name}</span>
              <span className="submit-summary">{settingsSummary}</span>
            </div>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={!ready}
            >
              {isSubmitting ? (
                <>
                  <span className="spin sm" />
                  Starting your run…
                </>
              ) : (
                <>
                  {guide.start}
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </div>
        </fieldset>
        {error && (
          <div className="composer-error" role="alert">
            <strong>Your run didn’t start.</strong>
            <p>{error}</p>
          </div>
        )}
        <div className="run-expectations">
          <span className="status-dot" />
          <p>
            {isSubmitting
              ? "Preparing your workspace. You’ll be taken to the run when it’s ready."
              : "Watch the reasoning unfold live. Runs can take several minutes; timing and cost depend on your models and settings."}
          </p>
        </div>
      </form>

      <PerspectivePreview mode={mode} councilSize={councilSize} agentCount={agentCount} onSettings={() => setShowRouting(!showRouting)} />
    </div>
  );
}
