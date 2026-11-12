import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PolyviseRecord } from "@/lib/run-record";
import type { LlmRequest } from "@polyvise/core/providers/llm";

const control = vi.hoisted(() => ({ failRole: "final summary", calls: [] as string[], records: new Map<string, PolyviseRecord>() }));
vi.mock("@/server/repository", async original => {
  const module = await original<typeof import("@/server/repository")>();
  return { ...module, createDefaultDebateRepository: () => new module.MemoryDebateRepository({ debates: control.records, feedback: new Map() }) };
});
vi.mock("@polyvise/core/providers/llm", async original => {
  const module = await original<typeof import("@polyvise/core/providers/llm")>();
  class Provider extends module.MockLlmProvider {
    async generateStructured<T>(request: LlmRequest) {
      control.calls.push(request.role);
      if (request.role === control.failRole) throw new Error("Model timed out");
      return super.generateStructured<T>(request);
    }
  }
  return { ...module, createDefaultLlmProvider: () => new Provider() };
});
import { getDebate, listDebates, retryDebate, startDebate, subscribeToDebate } from "@/server/debate-store";

beforeEach(() => {
  control.records.clear(); control.calls.length = 0; control.failRole = "final summary";
  vi.stubEnv("POLYVISE_EVIDENCE_PROVIDER", "mock");
  vi.stubEnv("POLYVISE_ALLOW_DETERMINISTIC_FALLBACKS", "false");
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

async function failedRun(mode: PolyviseRecord["mode"] = "hybrid_council") {
  const result = await startDebate({ subject: "Should we use a four-day work week?", mode, evidence: "cited", councilSize: "duo", consensus: { agentCount: 3, rounds: 2 } });
  await expect(result.completion).rejects.toThrow("Model timed out");
  return (await getDebate(result.debate.id))!;
}
function terminal(id: string) {
  return new Promise<void>(resolve => subscribeToDebate(id, event => {
    if (event.kind === "complete" || event.kind === "error") resolve();
  }));
}

it.each([
  ["hybrid_council", "final summary"], ["consensus", "consensus summary"], ["advisory_panel", "panel chair"]
] as const)("resumes only the unfinished %s step and saves before completion", async (mode, role) => {
  control.failRole = role;
  const failed = await failedRun(mode);
  expect(failed.recovery).toEqual({ available: true, attempt: 0 });
  expect(failed.failureReason).toContain("Retry the failed step");
  expect(failed.liveEvents?.length).toBeGreaterThan(0);
  expect(failed).not.toHaveProperty("retryState");
  expect((await listDebates())[0]).not.toHaveProperty("retryState");
  control.failRole = ""; control.calls.length = 0;
  expect((await retryDebate(failed.id, 0))?.accepted).toBe(true);
  await terminal(failed.id);
  const complete = (await getDebate(failed.id))!;
  expect(complete.status).toBe("complete");
  expect(control.calls).toEqual([role]);
  expect(complete.recovery?.attempt).toBe(1);
  expect(complete.failureReason).toBeUndefined();
});

it("deduplicates simultaneous and stale retry requests", async () => {
  const failed = await failedRun();
  control.calls.length = 0;
  await Promise.all([retryDebate(failed.id, 0), retryDebate(failed.id, 0)]);
  await terminal(failed.id);
  expect(control.calls).toEqual(["final summary"]);
  expect((await retryDebate(failed.id, 0))?.accepted).toBe(false);
  expect(control.calls).toEqual(["final summary"]);
});

it("rejects old stream attempts and resumes an abandoned worker", async () => {
  const failed = await failedRun();
  const listener = vi.fn();
  expect(subscribeToDebate(failed.id, listener, 1).terminal).toBe(true);
  expect(listener).not.toHaveBeenCalled();
  control.records.set(failed.id, { ...control.records.get(failed.id)!, status: "judging", updatedAt: new Date(Date.now() - 6 * 60_000).toISOString() });
  control.failRole = ""; control.calls.length = 0;
  await retryDebate(failed.id, 0);
  await terminal(failed.id);
  expect(control.calls).toEqual(["final summary"]);
});

it("does not resume legacy records or rerun completed work", async () => {
  const failed = await failedRun();
  control.records.set(failed.id, failed);
  expect((await retryDebate(failed.id, 0))?.accepted).toBe(false);
  control.records.set(failed.id, { ...failed, status: "complete" });
  control.calls.length = 0;
  expect((await retryDebate(failed.id, 0))?.accepted).toBe(true);
  expect(control.calls).toEqual([]);
  expect(await retryDebate("missing", 0)).toBeNull();
});
