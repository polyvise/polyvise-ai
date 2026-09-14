"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import { Check, TriangleAlert } from "lucide-react";
import type { DebateStatus } from "@polyvise/core/debate/types";
import type { PolyviseRecord } from "@/lib/run-record";
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
  const failed = status === "failed";
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

  useEffect(() => {
    if (record.status === "failed") return;

    let source: EventSource | null = null;
    let refreshRequested = false;
    let finalizing = false;
    let cancelled = false;

    const readEvent = (event: Event): Record<string, unknown> | null => {
      try {
        return JSON.parse((event as MessageEvent).data) as Record<string, unknown>;
      } catch {
        return null;
      }
    };

    const refreshWhenStored = async () => {
      if (refreshRequested || cancelled) return;
      try {
        const response = await fetch(`/api/debates/${record.id}`, { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { debate?: PolyviseRecord };
        const latest = payload.debate;
        if (latest?.latestRun || latest?.status === "failed") {
          refreshRequested = true;
          source?.close();
          router.refresh();
        }
      } catch {
        /* The event stream remains primary; the next poll will retry. */
      }
    };

    const poll = window.setInterval(() => void refreshWhenStored(), 1200);

    if (record.status !== "complete") {
      source = new EventSource(`/api/debates/${record.id}/events`);
      source.addEventListener("open", () => setConnection(""));
      source.addEventListener("stage", (event) => {
        const next = readEvent(event)?.status;
        if (typeof next !== "string") return;
        const nextStatus = next as DebateStatus;
        setStatus(nextStatus);
        if (nextStatus !== "complete" && nextStatus !== "failed") {
          setLastWorkingStatus(nextStatus);
        }
        if (nextStatus === "complete") {
          setConnection("The analysis is complete. Saving the result…");
          void refreshWhenStored();
        }
      });
      source.addEventListener("agents", (event) => {
        const agents = readEvent(event)?.agents;
        if (Array.isArray(agents)) setProgress((value) => ({ ...value, participants: agents.length }));
      });
      source.addEventListener("lenses", (event) => {
        const lenses = readEvent(event)?.lenses;
        if (Array.isArray(lenses)) setProgress((value) => ({ ...value, participants: lenses.length }));
      });
      source.addEventListener("sources", (event) => {
        const sources = readEvent(event)?.sources;
        if (Array.isArray(sources)) setProgress((value) => ({ ...value, sources: sources.length }));
      });
      source.addEventListener("round", (event) => {
        const round = readEvent(event)?.round;
        if (round && typeof round === "object" && "round" in round && typeof round.round === "number") {
          const roundNumber = round.round;
          setProgress((value) => ({ ...value, rounds: Math.max(value.rounds, roundNumber) }));
        }
      });
      source.addEventListener("advice", (event) => {
        const advice = readEvent(event)?.advice;
        if (advice && typeof advice === "object" && "lensId" in advice && typeof advice.lensId === "string") {
          adviceIds.current.add(advice.lensId);
          setProgress((value) => ({ ...value, advice: adviceIds.current.size }));
        }
      });
      const finish = () => {
        if (finalizing) return;
        finalizing = true;
        source?.close();
        setStatus("complete");
        setConnection("The analysis is complete. Saving the result…");
        void refreshWhenStored();
      };
      source.addEventListener("complete", finish);
      source.addEventListener("closed", finish);
      source.addEventListener("error", (event) => {
        if (event instanceof MessageEvent && event.data) {
          setStatus("failed");
          source?.close();
          void refreshWhenStored();
        } else {
          setConnection("Connection interrupted. Reconnecting to your run…");
        }
      });
    } else {
      setConnection("The analysis is complete. Saving the result…");
      void refreshWhenStored();
    }

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      source?.close();
    };
  }, [record.id, record.status, router]);
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
            ? record.failureReason ?? "The run failed, but no diagnostic was recorded. Try again with another model."
            : activity}
        </p>
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
