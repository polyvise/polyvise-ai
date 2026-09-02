import Link from "next/link";
import type { Route } from "next";
import { formatCost } from "@/lib/run-view";
import type { RunSummary } from "@/lib/run-summary";

/** Pure presentation, shared by the public "your runs" list and the admin list. */
export function RunsTable({ runs }: { runs: RunSummary[] }) {
  return (
    <div className="card">
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Resolution</th>
              <th>Mode</th>
              <th>Verdict</th>
              <th className="num">Conf.</th>
              <th className="num">Cost</th>
              <th>When</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id} className={run.status === "failed" ? "dim" : undefined}>
                <td className="mw340">
                  <Link href={`/runs/${run.id}` as Route}>{run.title}</Link>
                </td>
                <td>
                  <span className="chip pro">{run.mode}</span>
                </td>
                <td>
                  {run.status === "failed" ? (
                    <span className="chip alert">
                      <span className="dot" />
                      {run.failedStep ? `Failed at ${run.failedStep}` : "Failed"}
                    </span>
                  ) : run.verdict ? (
                    <span className="row gap6 wrap">
                      <span className={`chip ${run.verdictTone}`}>
                        <span className="dot" />
                        {run.verdict}
                      </span>
                      {/* The mode's own footnote — "2 dissenting" changes how
                          a converged verdict should be read. */}
                      {run.detail ? <span className="meta">{run.detail}</span> : null}
                    </span>
                  ) : (
                    <span className="chip">
                      <span className="dot" />
                      {run.status}
                    </span>
                  )}
                </td>
                <td className="num">{run.confidence === null ? "—" : `${run.confidence}%`}</td>
                <td className="num">{run.costUsd > 0 ? formatCost(run.costUsd) : "—"}</td>
                <td className="meta">{relativeTime(run.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days === 1 ? "yesterday" : `${days} days ago`;
}
