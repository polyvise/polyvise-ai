/** Compatibility for role names embedded in output from older debate engines. */
export function currentDebateTerminology(text: string): string {
  return text.replace(/\b(green|yes|pink|no|judge|neutral) frog(s)?\b/gi, (_match, role: string, plural: string | undefined) => {
    const side = role.toLowerCase();
    if (side === "judge" || side === "neutral") return plural ? "judges" : "judge";
    return `${side === "green" || side === "yes" ? "supporting" : "opposing"} ${plural ? "debaters" : "debater"}`;
  });
}

// Only model-authored prose is adapted. IDs, URLs, citations, user input,
// retrieved evidence and raw provider diagnostics must retain their original values.
const proseFields = new Set([
  "name", "agentName", "lensName", "role", "content", "thesis", "assumptions",
  "strongestArguments", "text", "rationale", "headline", "recommendation",
  "strongestPro", "strongestCon", "unresolvedUncertainties", "whatWouldChangeMind",
  "note", "answer", "reasoning", "finding", "throughLine", "decisionGuidance",
  "point", "stance", "keyRisks", "conditions", "reason",
]);
const preservedBranches = new Set([
  "sources", "source", "evidence", "request", "context", "subject", "resolution",
  "prompt", "question", "failure", "attempts", "fallbacks", "highStakes",
]);

export function normalizeDebateOutput<T>(value: T): T {
  function visit(item: unknown, field = ""): unknown {
    if (preservedBranches.has(field)) return item;
    if (typeof item === "string") return proseFields.has(field) ? currentDebateTerminology(item) : item;
    if (Array.isArray(item)) return item.map(entry => visit(entry, field));
    if (item && typeof item === "object") {
      return Object.fromEntries(Object.entries(item).map(([key, entry]) => [key, visit(entry, key)]));
    }
    return item;
  }
  return visit(value) as T;
}
