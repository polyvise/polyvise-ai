import type { DebateRuntimeConfig } from "@polyvise/core/debate/config";
import type { LlmProvider, LlmRequest } from "@polyvise/core/providers/llm";

const terminologyRule = "This is Polyvise. Refer to debate participants using their supplied names, supporting debater, opposing debater, or neutral judge. Do not invent animal mascots or color-based nicknames for participants. This naming rule does not change the subject of the debate or the wording of cited source material.";

const responseLengthGuidance = "Response word limits: use at most 1,200 words of prose across the entire JSON response. Each individual debate turn, consensus perspective, or advisor reasoning field must be at most 150 words. Each final synthesis, decision guidance, or summary recommendation field must be at most 200 words. Headlines must be at most 15 words. Other prose fields must be at most 80 words, and each risk, condition, agreement, conflict, or bullet item at most 30 words. If a stricter schema limit applies, obey it. Keep every required field, participant, round, and array entry; shorten their prose rather than omitting required structure. Preserve source IDs and enum values exactly. Return a complete JSON object; never truncate it to meet these limits.";

/** Apply product terminology before generation, without changing routing or schemas. */
export function withPolyviseTerminology(provider: LlmProvider): LlmProvider {
  return {
    name: provider.name,
    configured: provider.configured,
    modelForRole: role => provider.modelForRole(role),
    generateStructured<T>(request: LlmRequest) {
      let prompt: string;
      try {
        const parsed: unknown = JSON.parse(request.prompt);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Not a prompt object");
        prompt = JSON.stringify({ ...parsed, polyviseParticipantNaming: terminologyRule, responseLengthGuidance });
      } catch {
        prompt = `${request.prompt}\n\n${terminologyRule}\n\n${responseLengthGuidance}`;
      }
      return provider.generateStructured<T>({ ...request, prompt });
    },
  };
}

/** One bounded shared budget across transport, format fallback and validation. */
export function polyviseRuntimeConfig(config: DebateRuntimeConfig): DebateRuntimeConfig {
  return { ...config,
    llmTimeoutMs: Math.min(config.llmTimeoutMs, 45_000),
    llmMaxAttempts: Math.min(config.llmMaxAttempts, 3),
    apiRetryBaseDelayMs: Math.min(5000, Math.max(1000, config.apiRetryBaseDelayMs))
  };
}
