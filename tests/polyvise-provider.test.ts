import { expect, it, vi } from "vitest";
import type { LlmProvider } from "@polyvise/core/providers/llm";
import { withPolyviseTerminology } from "@/server/polyvise-provider";

it("adds naming guidance to fresh generation requests while preserving routing and payloads", async () => {
  const generateStructured = vi.fn().mockResolvedValue({ data: { content: "A response" }, snapshot: { id: "call" } });
  const provider = { name: "test", configured: true, modelForRole: vi.fn(() => "selected-model"), generateStructured } as LlmProvider;
  const wrapped = withPolyviseTerminology(provider);
  const request = { role: "judge review round", schemaName: "debateTurnOutput", model: "chosen-model", sessionId: "run-1", fallback: { content: "fallback" }, prompt: JSON.stringify({ task: "Review", debate: { subject: "Should green frogs be protected?" }, rules: ["Return JSON"] }) };
  await wrapped.generateStructured(request);
  const forwarded = generateStructured.mock.calls[0][0];
  expect(forwarded).toEqual({ ...request, prompt: expect.any(String) });
  const prompt = JSON.parse(forwarded.prompt);
  expect(prompt.debate.subject).toBe("Should green frogs be protected?");
  expect(prompt.rules).toEqual(["Return JSON"]);
  expect(prompt.polyviseParticipantNaming).toContain("supporting debater");
  expect(prompt.polyviseParticipantNaming).toContain("Do not invent animal mascots");
  expect(wrapped.modelForRole("judge")).toBe("selected-model");
  expect(provider.modelForRole).toHaveBeenCalledWith("judge");
});
