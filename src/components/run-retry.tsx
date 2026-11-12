"use client";

import { RotateCcw } from "lucide-react";
import type { PolyviseRecord } from "@/lib/run-record";

export function RunRetry({ record, retry, retrying, retryError }: {
  record: PolyviseRecord;
  retry: () => void;
  retrying: boolean;
  retryError: string | null;
}) {
  if (!record.recovery?.available) return <p className="small mt14">This older run has no saved checkpoints. Start a new run to try again.</p>;
  return <div className="mt14">
    <p className="small">Completed work is saved. Continue from the step that stopped.</p>
    <button type="button" className="btn btn-primary mt14" style={{ minHeight: 44 }} onClick={retry} disabled={retrying} aria-busy={retrying}>
      {retrying ? <span className="spin" aria-hidden="true" /> : <RotateCcw size={16} aria-hidden="true" />}
      {retrying ? "Reconnecting…" : "Retry failed step"}
    </button>
    {retryError ? <p className="small mt10" role="alert">{retryError}</p> : null}
  </div>;
}
