"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Check, TriangleAlert } from "lucide-react";
import type { DebateStatus } from "@polyvise/core/debate/types";
import type { PolyviseRecord } from "@/lib/run-record";
import { RunRetry } from "./run-retry";
import { useRunRecovery } from "@/lib/use-run-recovery";
import { modeGuide } from "@/lib/mode-guide";

/** In-flight consensus and panel runs must not masquerade as a debate. */
export function PendingModeRun({ record }: { record: PolyviseRecord }) {
  const router = useRouter();
  const [status, setStatus] = useState(record.status);
  const [lastWorkingStatus, setLastWorkingStatus] = useState<DebateStatus>(
    record.status === "complete" || record.status === "failed" ? "queued" : record.status,
  );
  const [connection, setConnection] = useState("");
  const [progress, setProgress] = useState({ participants: 0, sources: 0, rounds: 0, advice: 0 });
  const adviceIds = useRef(new Set<string>());
  const guide = modeGuide[record.mode];
  const failed = status === "failed" || status === "partial";
  const stages: Partial<Record<DebateStatus, string>> = {
    queued: "Preparing your thinking room",
    framing: "Framing your question",
    researching: "Gathering evidence",
    debating:
      record.mode === "consensus"
        ? "Comparing independent perspectives"
        : "Gathering advice from each lens",
    judging:
      record.mode === "consensus"
        ? "Measuring agreement and writing the summary"
        : "The chair is bringing the advice together",
    complete: "Finalizing your result",
    failed: "This run could not finish",
  };
  const activity = activityFor(status, record.mode, progress);
  const activeStep = stepForStatus(failed ? lastWorkingStatus : status);

  const refreshed = useRef(false);
  const recovery = useRunRecovery(record, {
    onEvent: event => {
      if (event.kind === "stage") {
        setStatus(event.status);
        if (!["complete", "failed", "partial"].includes(event.status)) setLastWorkingStatus(event.status);
      }
      if (event.kind === "agents") setProgress(value => ({ ...value, participants: event.agents.length }));
      if (event.kind === "lenses") setProgress(value => ({ ...value, participants: event.lenses.length }));
      if (event.kind === "sources") setProgress(value => ({ ...value, sources: event.sources.length }));
      if (event.kind === "round") setProgress(value => ({ ...value, rounds: Math.max(value.rounds, event.round.round) }));
      if (event.kind === "advice") {
        adviceIds.current.add(event.advice.lensId);
        setProgress(value => ({ ...value, advice: adviceIds.current.size }));
      }
      if (event.kind === "complete") { setStatus("complete"); setConnection("The analysis is complete. Loading the saved result…"); }
      if (event.kind === "error") { setStatus("failed"); setConnection(""); }
    },
    onRecord: saved => {
      setStatus(saved.status);
      setConnection("");
      if (!["complete", "failed", "partial"].includes(saved.status)) setLastWorkingStatus(saved.status);
      const lastStage = [...(saved.liveEvents ?? [])].reverse().find(event => event.kind === "stage" && !["complete", "failed", "partial"].includes(event.status));
      if (lastStage?.kind === "stage") setLastWorkingStatus(lastStage.status);
      for (const event of saved.liveEvents ?? []) {
        if (event.kind === "agents") setProgress(value => ({ ...value, participants: event.agents.length }));
        if (event.kind === "lenses") setProgress(value => ({ ...value, participants: event.lenses.length }));
        if (event.kind === "sources") setProgress(value => ({ ...value, sources: event.sources.length }));
        if (event.kind === "round") setProgress(value => ({ ...value, rounds: Math.max(value.rounds, event.round.round) }));
        if (event.kind === "advice") {
          adviceIds.current.add(event.advice.lensId);
          setProgress(value => ({ ...value, advice: adviceIds.current.size }));
        }
      }
      if (saved.latestRun && !refreshed.current) { refreshed.current = true; router.refresh(); }
    }
  });

  return (
    <section className="page">
      <div className="row gap8">
        <span className="chip judge">{guide.name}</span>
        <span className="meta">{record.id}</span>
      </div>
      <h1 className="display d2 mt18">{record.subject}</h1>
      <div className="card card-pad mt24" role="status">
        <div className="row gap10">
          {!failed ? <span className="spin" /> : <TriangleAlert size={16} aria-hidden="true" />}
          <h2 className="card-title">
            {stages[status] ?? "Working on your question"}
          </h2>
        </div>
        <p className="small mt14">
          {failed
            ? recovery.record.failureReason ?? "The current step could not finish."
            : activity}
        </p>
        {failed ? <RunRetry {...recovery} /> : null}
        {connection && <p className="small mt10">{connection}</p>}
      </div>
      <div className="grid g3 mt24">
        {guide.steps.map((step, i) => (
          <div
            className={`card card-pad pending-step ${stepState(i, activeStep, status, failed)}`}
            key={step}
            aria-current={i === activeStep && !failed && status !== "complete" ? "step" : undefined}
          >
            <div className="row gap8">
              <span className="eyebrow">Step {i + 1}</span>
              <StepStatus state={stepState(i, activeStep, status, failed)} />
            </div>
            <p className="small mt10">{step}</p>
            {i === activeStep && !failed && status !== "complete" ? (
              <div className="step-progress mt14" role="progressbar" aria-label={`Step ${i + 1} in progress`}>
                <span />
              </div>
            ) : null}
          </div>
        ))}
      </div>
      <div className="row gap10 mt24">
        <Link className="btn" href="/runs">
          Your runs
        </Link>
        {failed && (
          <Link
            className="btn btn-primary"
            href={`/?mode=${record.mode}#ask` as Route}
          >
            Start another {guide.name.toLowerCase()}
          </Link>
        )}
      </div>
    </section>
  );
}

type StepState = "is-complete" | "is-active" | "is-pending" | "is-failed";

function stepForStatus(status: DebateStatus): number {
  if (status === "debating") return 1;
  if (status === "judging" || status === "complete") return 2;
  return 0;
}

function stepState(index: number, activeStep: number, status: DebateStatus, failed: boolean): StepState {
  if (status === "complete") return "is-complete";
  if (index < activeStep) return "is-complete";
  if (index === activeStep) return failed ? "is-failed" : "is-active";
  return "is-pending";
}

function StepStatus({ state }: { state: StepState }) {
  if (state === "is-complete") {
    return (
      <span className="step-state complete">
        <Check size={12} aria-hidden="true" /> Complete
      </span>
    );
  }
  if (state === "is-active") return <span className="step-state active">In progress</span>;
  if (state === "is-failed") return <span className="step-state failed">Stopped here</span>;
  return <span className="step-state">Waiting</span>;
}

function activityFor(
  status: DebateStatus,
  mode: PolyviseRecord["mode"],
  progress: { participants: number; sources: number; rounds: number; advice: number },
): string {
  switch (status) {
    case "queued":
      return "Starting the run and reserving the selected models.";
    case "framing":
      return progress.participants
        ? `${progress.participants} independent ${mode === "consensus" ? "perspectives" : "advisors"} are ready.`
        : `Defining the question and assigning independent ${mode === "consensus" ? "perspectives" : "advisors"}.`;
    case "researching":
      return progress.sources
        ? `${progress.sources} sources are ready. Each participant receives the same evidence.`
        : "Searching for relevant evidence and checking source quality.";
    case "debating":
      if (mode === "consensus") {
        return progress.rounds
          ? `Round ${progress.rounds} is complete. Perspectives are reconsidering their answers independently.`
          : "Each perspective is answering independently before seeing the other responses.";
      }
      return progress.advice
        ? `${progress.advice} of 4 advisors have completed their independent analysis.`
        : "Each advisor is analyzing the question without seeing the other advisors’ answers.";
    case "judging":
      return mode === "consensus"
        ? "Computing how far the final stances differ and recording any holdouts."
        : "The chair is identifying agreements, conflicts, and practical next steps.";
    case "complete":
      return "The analysis is complete. The result page will replace this progress view as soon as the saved record is available.";
    case "failed":
      return "The run could not finish.";
    default:
      return "Working on your question.";
  }
}
