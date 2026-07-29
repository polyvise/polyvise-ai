"use client";

import { FormEvent, useState } from "react";
import { modelCatalog } from "@/lib/model-catalog";
import { formatCost, formatLatency, formatTokens } from "@/lib/run-view";

const MAX_MODELS = 3;

type LabAnswer = {
  model: string;
  answer: string | null;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  failure?: string;
};

export function LabRunner({ defaultModels }: { defaultModels: string[] }) {
  const [prompt, setPrompt] = useState("");
  const [selected, setSelected] = useState<string[]>(defaultModels.slice(0, MAX_MODELS));
  const [answers, setAnswers] = useState<LabAnswer[] | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((current) =>
      current.includes(id)
        ? current.filter((model) => model !== id)
        : current.length >= MAX_MODELS
          ? current
          : [...current, id]
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (prompt.trim().length < 4 || selected.length === 0 || isRunning) return;

    setIsRunning(true);
    setError(null);
    setAnswers(null);

    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, models: selected })
      });
      const payload = (await response.json()) as { answers?: LabAnswer[]; error?: string };
      if (!response.ok || !payload.answers) {
        throw new Error(payload.error ?? "Unable to run the lab.");
      }
      setAnswers(payload.answers);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to run the lab.");
    } finally {
      setIsRunning(false);
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div className="composer mt24">
          <div className="composer-top">
            <textarea
              className="q-input"
              rows={2}
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Should a 40-person company adopt AI customer support this year?"
              aria-label="Prompt"
            />
          </div>
          <div className="composer-bar">
            <span className="meta">
              {selected.length} of {MAX_MODELS} models selected
            </span>
            <button
              type="submit"
              className="btn btn-primary btn-sm push"
              disabled={prompt.trim().length < 4 || selected.length === 0 || isRunning}
            >
              {isRunning ? <span className="spin sm" /> : null}
              {isRunning ? "Running…" : "Send to all →"}
            </button>
          </div>
          <div className="slot-grid">
            <div className="row gap6 wrap">
              {modelCatalog.map((model) => {
                const on = selected.includes(model.id);
                return (
                  <button
                    type="button"
                    key={model.id}
                    className={`example${on ? "" : ""}`}
                    onClick={() => toggle(model.id)}
                    style={
                      on
                        ? { borderColor: "var(--pro-line)", color: "var(--pro)", background: "var(--pro-dim)" }
                        : undefined
                    }
                    aria-pressed={on}
                  >
                    {model.id}
                  </button>
                );
              })}
            </div>
            <p className="meta mt14">
              Every selected model gets the identical prompt. Models that fail stay in the results with the reason
              rather than disappearing from them.
            </p>
          </div>
        </div>
      </form>

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
            <h5>The lab run failed</h5>
            <p>{error}</p>
          </div>
        </div>
      ) : null}

      {answers ? (
        <div className="grid g2 mt18">
          {answers.map((answer) => {
            const tokens = (answer.promptTokens ?? 0) + (answer.completionTokens ?? 0);
            return (
              <div className="card" key={answer.model}>
                <div className="card-head">
                  <span className={`chip ${answer.failure ? "alert" : "pro"}`}>
                    <span className="dot" />
                    {answer.model}
                  </span>
                  <span className="meta push">
                    {formatLatency(answer.latencyMs)} · {formatTokens(tokens)} tok ·{" "}
                    {answer.estimatedCostUsd ? formatCost(answer.estimatedCostUsd) : "—"}
                  </span>
                </div>
                <div className="card-pad">
                  {answer.failure ? (
                    <p className="small">
                      No usable answer came back. <span className="meta">{answer.failure}</span>
                    </p>
                  ) : (
                    <p style={{ fontSize: 13, lineHeight: 1.62 }}>{answer.answer}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
