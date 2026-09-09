import type { LlmProvider, LlmRequest } from "@polyvise/core/providers/llm";

const terminologyRule = "This is Polyvise. Refer to debate participants using their supplied names, supporting debater, opposing debater, or neutral judge. Do not invent animal mascots or color-based nicknames for participants. This naming rule does not change the subject of the debate or the wording of cited source material.";

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
        prompt = JSON.stringify({ ...parsed, polyviseParticipantNaming: terminologyRule });
      } catch {
        prompt = `${request.prompt}\n\n${terminologyRule}`;
      }
      return provider.generateStructured<T>({ ...request, prompt });
    },
  };
}
