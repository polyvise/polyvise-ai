const terminologyRule = "This is Polyvise. Refer to debate participants using their supplied names, supporting debater, opposing debater, or neutral judge. Do not invent animal mascots or color-based nicknames for participants. This naming rule does not change the subject of the debate or the wording of cited source material.";

const responseLengthGuidance = "Response word limits: use at most 1,200 words of prose across the entire JSON response. Each individual debate turn, consensus perspective, or advisor reasoning field must be at most 150 words. Each final synthesis, decision guidance, or summary recommendation field must be at most 200 words. Headlines must be at most 15 words. Other prose fields must be at most 80 words, and each risk, condition, agreement, conflict, or bullet item at most 30 words. If a stricter schema limit applies, obey it. Keep every required field, participant, round, and array entry; shorten their prose rather than omitting required structure. Preserve source IDs and enum values exactly. Return a complete JSON object; never truncate it to meet these limits.";

/**
 * Product terminology and length guidance, sent with every run and follow-up.
 *
 * The API applies it to each model call without changing routing or schemas:
 * the fields are merged into JSON prompts and appended, one paragraph each, to
 * plain-text ones.
 */
export const polyvisePromptPolicy = {
  fields: {
    polyviseParticipantNaming: terminologyRule,
    responseLengthGuidance
  }
} as const;
