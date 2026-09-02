"use client";

import Link from "next/link";
import type { Route } from "next";
import { useEffect, useState } from "react";
import { RunsTable } from "@/components/runs-table";
import { forgetLocalRuns, readLocalRunIds } from "@/lib/local-runs";
import type { RunSummary } from "@/lib/run-summary";

export function YourRuns() {
  const [runs, setRuns] = useState<RunSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = readLocalRunIds();
    if (ids.length === 0) {
      setRuns([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/runs/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids })
        });
        const payload = (await response.json()) as { runs?: RunSummary[]; error?: string };
        if (!response.ok || !payload.runs) throw new Error(payload.error ?? "Unable to load your runs.");
        if (!cancelled) setRuns(payload.runs);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : "Unable to load your runs.");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  function clear() {
    forgetLocalRuns();
    setRuns([]);
  }

  if (error) {
    return (
      <div className="card card-pad mt18">
        <h4 className="card-title">Couldn&apos;t load your runs.</h4>
        <p className="small mt6">{error}</p>
      </div>
    );
  }

  if (runs === null) {
    return (
      <div className="card card-pad mt18">
        <div className="row gap8">
          <span className="spin" />
          <span className="small">Looking up your runs…</span>
        </div>
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <div className="card card-pad mt18">
        <h4 className="card-title">No runs from this browser yet.</h4>
        <p className="small mt6">
          <Link href={"/" as Route} className="link">
            Start one
          </Link>{" "}
          and it will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="mt18">
      <RunsTable runs={runs} />
      <div className="row gap8 wrap mt14">
        <span className="meta">
          Kept in this browser only — never linked to you on the server.
        </span>
        <button type="button" className="btn btn-sm btn-ghost push" onClick={clear}>
          Clear this list
        </button>
      </div>
    </div>
  );
}
