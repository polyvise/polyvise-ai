"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Route } from "next";
import type { DebateStatus } from "@polyvise/core/debate/types";
import type { PolyviseRecord } from "@/lib/run-record";
import { modeGuide } from "@/lib/mode-guide";

/** In-flight consensus and panel runs must not masquerade as a debate. */
export function PendingModeRun({ record }: { record: PolyviseRecord }) {
  const router = useRouter();
  const [status, setStatus] = useState(record.status);
  const [connection, setConnection] = useState("");
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
    complete: "Your result is ready",
    failed: "This run could not finish",
  };
  useEffect(() => {
    if (record.status === "failed" || record.status === "complete") return;
    const source = new EventSource(`/api/debates/${record.id}/events`);
    source.addEventListener("open", () => setConnection(""));
    source.addEventListener("stage", (event) => {
      try {
        setStatus(
          (JSON.parse((event as MessageEvent).data) as { status: DebateStatus })
            .status,
        );
      } catch {
        /* wait for next valid event */
      }
    });
    const finish = () => {
      source.close();
      router.refresh();
    };
    source.addEventListener("complete", finish);
    source.addEventListener("closed", finish);
    source.addEventListener("error", (event) => {
      if (event instanceof MessageEvent && event.data) {
        setStatus("failed");
        finish();
      } else setConnection("Connection interrupted. Reconnecting to your run…");
    });
    return () => source.close();
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
          {!failed && <span className="spin" />}
          <h2 className="card-title">
            {stages[status] ?? "Working on your question"}
          </h2>
        </div>
        <p className="small mt14">
          {failed
            ? record.failureReason ?? "This older run did not retain its failure details. Try again with another model."
            : "You can leave this page and return from Your runs. The result will appear here when the work is complete."}
        </p>
        {connection && <p className="small mt10">{connection}</p>}
      </div>
      <div className="grid g3 mt24">
        {guide.steps.map((step, i) => (
          <div className="card card-pad" key={step}>
            <span className="eyebrow">Step {i + 1}</span>
            <p className="small mt10">{step}</p>
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
