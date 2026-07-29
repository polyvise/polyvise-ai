import type { Metadata } from "next";
import { LabRunner } from "@/components/lab-runner";
import { PROVIDER_COUNT } from "@/lib/build-info";
import { defaultSelections, modelCatalog, type SlotId } from "@/lib/model-catalog";
import { labProviderStatus } from "@/server/model-lab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Model lab | Polyvise",
  description: "Send one prompt to every configured model and compare the answers side by side."
};

const slotLabels: Record<SlotId, { label: string; tone: string }> = {
  quick: { label: "quick", tone: "pro" },
  deep: { label: "deep", tone: "con" },
  judge: { label: "judge", tone: "judge" }
};

export default function LabPage() {
  const { configured, mock } = labProviderStatus();
  const defaultSlotFor = new Map<string, SlotId>();
  for (const [slot, model] of Object.entries(defaultSelections) as [SlotId, string][]) {
    if (!defaultSlotFor.has(model)) defaultSlotFor.set(model, slot);
  }

  return (
    <section className="page">
      <span className="eyebrow">Model lab</span>
      <h2 className="display d2 mt10">Compare models on the same prompt</h2>
      <p className="lede mt10 mw620">
        Send one prompt to every configured model and compare the answers side by side, along with what each one cost
        and how long it took. Models that fail or have no API key stay in the table rather than disappearing from it.
      </p>

      {configured && !mock ? null : (
        <div className="callout note mt18">
          <svg
            className="ci"
            width="15"
            height="15"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.4}
            style={{ color: "var(--muted)" }}
            aria-hidden="true"
          >
            <circle cx="8" cy="8" r="6.2" />
            <path d="M8 7.4v3.4M8 5.2v.6" strokeLinecap="round" />
          </svg>
          <div>
            <h5>{mock ? "The engine is running against the mock provider" : "No provider key is configured"}</h5>
            <p>
              {mock ? (
                <>
                  Every model below will return the same deterministic template rather than its own answer, so a
                  comparison run tells you nothing about the models. Set <code>POLYVISE_ENABLE_MOCK_LLM=false</code>{" "}
                  and <code>OPENROUTER_API_KEY</code> to compare real output.
                </>
              ) : (
                <>
                  Set <code>OPENROUTER_API_KEY</code> to run live comparisons. Without it the roster below still lists
                  what the engine knows about, but every call will report as unconfigured.
                </>
              )}
            </p>
          </div>
        </div>
      )}

      <div className="card mt24">
        <div className="card-head">
          <span className="card-title">Roster</span>
          <span className="meta push">
            {PROVIDER_COUNT} providers · {modelCatalog.length} models
          </span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th>Default slot</th>
                <th>Speed</th>
                <th>Tier</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {modelCatalog.map((model) => {
                const slot = defaultSlotFor.get(model.id);
                const experimental = model.compatibility === "experimental";
                return (
                  <tr key={model.id} className={experimental ? "dim" : undefined}>
                    <td>
                      <code>{model.id}</code>
                    </td>
                    <td>{model.provider}</td>
                    <td>
                      {slot ? (
                        <span className={`chip ${slotLabels[slot].tone}`}>{slotLabels[slot].label}</span>
                      ) : (
                        <span className="chip">—</span>
                      )}
                    </td>
                    <td>{model.speed}</td>
                    <td>{model.tier}</td>
                    <td>
                      {!configured ? (
                        <span className="chip">
                          <span className="dot" />
                          no key
                        </span>
                      ) : mock ? (
                        <span className="chip">
                          <span className="dot" />
                          mock
                        </span>
                      ) : experimental ? (
                        <span className="chip con" title={model.compatibilityNote}>
                          <span className="dot" />
                          experimental
                        </span>
                      ) : (
                        <span className="chip pro">
                          <span className="dot" />
                          ready
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <LabRunner defaultModels={Array.from(new Set(Object.values(defaultSelections)))} />
    </section>
  );
}
