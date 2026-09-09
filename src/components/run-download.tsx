"use client";

import { Download } from "lucide-react";
import type { PolyviseRecord } from "@/lib/run-record";
import { runBrief } from "@/lib/run-export";

export function RunDownload({ record }: { record: PolyviseRecord }) {
  if (record.status !== "complete" || !record.latestRun) return null;
  function download() {
    const url = URL.createObjectURL(
      new Blob([runBrief(record)], { type: "text/markdown;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `polyvise-${record.id.replace(/[^a-zA-Z0-9_-]/g, "")}.md`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button type="button" onClick={download} className="btn btn-sm">
      <Download size={14} />
      Download brief
    </button>
  );
}
