import type { PolyviseRecord } from "@/lib/run-record";
import { isSimulatedRun } from "@/lib/run-export";

export function RunQualityNote({ record }: { record: PolyviseRecord }) {
  if (!isSimulatedRun(record)) return null;
  return (
    <div className="callout note mt18" role="note">
      <div>
        <h5>Simulated run · development preview</h5>
        <p>
          This run uses deterministic test responses. It demonstrates the
          workflow; findings, agreement and sources are not live research.
        </p>
      </div>
    </div>
  );
}
