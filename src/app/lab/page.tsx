import type { Metadata } from "next";
import { LabRunner } from "@/components/lab-runner";
import {
  allDefaultModelIds,
  defaultSelectionsByMode,
} from "@/lib/model-catalog";
import { labProviderStatus, availableLabModels } from "@/server/model-lab";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Model lab | Polyvise",
  description: "Send one prompt to every configured model and compare the answers side by side."
};

const defaultRoles = [
  {
    mode: "hybrid_council",
    slot: "quick",
    label: "Debate · opening",
    tone: "neutral"
  },
  {
    mode: "hybrid_council",
    slot: "deep",
    label: "Debate · claims",
    tone: "neutral"
  },
  {
    mode: "hybrid_council",
    slot: "judge",
    label: "Debate · judge",
    tone: "judge"
  },
  {
    mode: "consensus",
    slot: "quick",
    label: "Consensus · designer",
    tone: "neutral"
  },
  {
    mode: "consensus",
    slot: "deep",
    label: "Consensus · perspectives",
    tone: "neutral"
  },
  {
    mode: "consensus",
    slot: "judge",
    label: "Consensus · summary",
    tone: "judge"
  },
  {
    mode: "advisory_panel",
    slot: "deep",
    label: "Advisory · advisors",
    tone: "neutral"
  },
  {
    mode: "advisory_panel",
    slot: "judge",
    label: "Advisory · chair",
    tone: "judge"
  }
] as const;

export default async function LabPage() {
  const availableModels = await availableLabModels();
  const { configured, mock } = labProviderStatus();
  // Defaults are mode-specific, so the roster names both the mode and role.
  const defaultRolesFor = new Map<string, (typeof defaultRoles)[number][]>();
  for (const role of defaultRoles) {
    const model = defaultSelectionsByMode[role.mode][role.slot];
    defaultRolesFor.set(model, [...(defaultRolesFor.get(model) ?? []), role]);
  }

  return (
    <section className="page">
      <h1 className="display page-title">Compare models on the same prompt</h1>
      <p className="lede mt10 mw620">
        Send one prompt to every configured model and compare the answers side by side, along with what each one cost
        and how long it took.
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
                  Model comparisons are unavailable until the server’s OpenRouter connection is configured.
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
            OpenRouter · {availableModels.length} models
          </span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Model</th>
                <th>Provider</th>
                <th>Default seats</th>
                <th>Speed</th>
                <th>Tier</th>
                <th>State</th>
              </tr>
            </thead>
            <tbody>
              {availableModels.length === 0 ? (
                <tr>
                  <td colSpan={6} className="tbl-empty">
                    No models to list yet. The roster fills in once the server can reach OpenRouter.
                  </td>
                </tr>
              ) : null}
              {availableModels.map((model) => {
                const roles = defaultRolesFor.get(model.id) ?? [];
                const experimental = model.compatibility === "experimental";
                return (
                  <tr key={model.id} className={experimental ? "dim" : undefined}>
                    <td>
                      <code>{model.id}</code>
                    </td>
                    <td>{model.provider}</td>
                    <td>
                      {roles.length ? (
                        <span className="row gap6 wrap">
                          {roles.map((role) => (
                            <span
                              className={`chip ${role.tone}`}
                              key={`${role.mode}-${role.slot}`}
                            >
                              {role.label}
                            </span>
                          ))}
                        </span>
                      ) : (
                        <span className="meta">—</span>
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

      <LabRunner availableModels={availableModels} defaultModels={allDefaultModelIds()} />
    </section>
  );
}
