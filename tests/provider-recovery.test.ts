import { afterEach, expect, it, vi } from "vitest";
import { OpenRouterLlmProvider } from "@polyvise/core/providers/llm";
import { loadDebateRuntimeConfig } from "@polyvise/core/debate/config";
import { finalSummaryOutputSchema } from "@polyvise/core/debate/schema";
afterEach(() => vi.unstubAllGlobals());
it("retries clipped and malformed JSON with increasing budgets, preserving diagnostics", async () => {
  const fetcher = vi.fn()
    .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "length", message: { content: '{"answer":"cut' } }] }))
    .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"answer":' } }] }))
    .mockResolvedValueOnce(Response.json({ choices: [{ finish_reason: "stop", message: { content: '{"answer":"complete"}' } }] }));
  vi.stubGlobal("fetch", fetcher);
  const provider = new OpenRouterLlmProvider({ ...loadDebateRuntimeConfig(), llmMaxTokens: 8192, llmMaxAttempts: 3, apiRetryBaseDelayMs: 1, useStrictJsonSchema: false }, "test-key");
  const result = await provider.generateStructured({ role: "stance scout", schemaName: "test", prompt: "test" });
  expect(result.data).toEqual({ answer: "complete" });
  expect(fetcher.mock.calls.map(call => JSON.parse(call[1].body).max_tokens)).toEqual([8192, 16384, 32768]);
  expect(result.snapshot.attempts?.map(a => a.status)).toEqual(["failed", "failed", "ok"]);
});
it("accepts a full debate recommendation while preserving confidence validation", () => {
  const output = { headline: "H".repeat(121), recommendation: "R".repeat(321), confidence: 80 };
  expect(finalSummaryOutputSchema.safeParse(output).success).toBe(true);
  expect(finalSummaryOutputSchema.safeParse({ ...output, confidence: 101 }).success).toBe(false);
});
