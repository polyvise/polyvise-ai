import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PendingModeRun } from "@/components/pending-mode-run";
import { RunSurface } from "@/components/run-surface";
import { asDebateRecord, type PolyviseRecord } from "@/lib/run-record";
import { initialStateFromRecord, runViewReducer } from "@/lib/run-view";
import type { RoundTurn } from "@polyvise/core/debate/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
let host: HTMLDivElement;
let root: Root;
let stream: EventTarget;
const turn: RoundTurn = { id: "pro", round: "opening", side: "pro", agentId: "pro", agentName: "Supporting debater", content: "Keep this completed argument.", sourceIds: [], claimIds: [], createdAt: "2026-11-12T12:00:00Z" };
const failed = (mode: PolyviseRecord["mode"]): PolyviseRecord => ({
  id: "test", resolution: "Change the work week", subject: "Should we change the work week?", mode, evidence: "cited", status: "failed",
  createdAt: "2026-11-12T12:00:00Z", updatedAt: "2026-11-12T12:00:01Z", topicKind: "decision", highStakes: null, productNotes: [], followups: [],
  failureReason: "The summary timed out.", recovery: { available: true, attempt: 0 },
  liveEvents: [{ kind: "turns", round: "opening", turns: [turn] }, { kind: "stage", status: "judging" }]
});
beforeEach(() => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("EventSource", class extends EventTarget { close = vi.fn(); constructor() { super(); stream = this; } });
  host = document.createElement("div"); document.body.appendChild(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.unstubAllGlobals(); });

it.each(["hybrid_council", "consensus", "advisory_panel"] as const)("offers an inline retry for %s, prevents double submission, and reconnects", async mode => {
  const record = failed(mode);
  let finish!: (response: Response) => void;
  const fetcher = vi.fn(() => new Promise<Response>(resolve => { finish = resolve; }));
  vi.stubGlobal("fetch", fetcher);
  await act(async () => root.render(mode === "hybrid_council" ? <RunSurface record={asDebateRecord(record)} /> : <PendingModeRun record={record} />));
  expect(host.textContent).toContain("The summary timed out.");
  if (mode === "hybrid_council") expect(host.querySelector('.step.failed')?.textContent).toContain("Judging");
  const button = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Retry failed step")!;
  expect(button).toBeTruthy();
  await act(async () => { button.click(); button.click(); });
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(button.disabled).toBe(true);
  expect(button.textContent).toContain("Reconnecting");
  await act(async () => finish(Response.json({ debate: { ...record, status: "queued", failureReason: undefined, recovery: { available: true, attempt: 1 } } })));
  expect(host.textContent).not.toContain("The summary timed out.");
  expect(host.textContent).not.toContain("Retry failed step");
  expect(stream).toBeDefined();
  if (mode === "hybrid_council") expect(host.textContent).toContain(turn.content);
});

it("keeps the retry action available after a network failure", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection unavailable")));
  await act(async () => root.render(<PendingModeRun record={failed("consensus")} />));
  const button = Array.from(host.querySelectorAll("button")).find(button => button.textContent === "Retry failed step")!;
  await act(async () => button.click());
  expect(button.disabled).toBe(false);
  expect(host.querySelector('[role="alert"]')?.textContent).toBe("Connection unavailable");
});

it("deduplicates resumed speaker batches without losing the other speaker", () => {
  let state = initialStateFromRecord(asDebateRecord(failed("hybrid_council")));
  const con = { ...turn, id: "con", side: "con" as const };
  state = runViewReducer(state, { type: "event", event: { kind: "turns", round: "opening", turns: [con] } });
  state = runViewReducer(state, { type: "event", event: { kind: "turns", round: "opening", turns: [turn] } });
  expect(state.turns).toEqual([turn, con]);
  state = runViewReducer(state, { type: "hydrate", record: { ...asDebateRecord(failed("hybrid_council")), status: "queued", failureReason: undefined } });
  expect(state.turns).toEqual([turn, con]);
  expect(state.errorMessage).toBeNull();
  expect(state.done).toBe(false);
});
