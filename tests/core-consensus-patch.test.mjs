import { test } from "node:test";
import assert from "node:assert/strict";
import { patchConsensusSummarySchema } from "../scripts/patch-core-consensus.mjs";

test("patch removes only consensus summary length caps and is idempotent", () => {
  const other = 'const otherSchema = z.object({ title: z.string().max(120) });';
  const source = `${other}\nvar consensusSummaryOutputSchema = z.object({\n  headline: z.string().min(1).max(120),\n  finding: z.string().min(1).max(400),\n  confidence: z.number().min(0).max(100)\n});`;
  const result = patchConsensusSummarySchema(source);
  assert.ok(result.includes(other));
  assert.ok(result.includes('headline: z.string().min(1),'));
  assert.ok(result.includes('finding: z.string().min(1),'));
  assert.ok(result.includes('confidence: z.number().min(0).max(100)'));
  assert.equal(patchConsensusSummarySchema(result), result);
});

test("panel accepts long advice and synthesis while retaining structural validation", async () => {
  const { patchPanelSchemas } = await import("../scripts/patch-core-consensus.mjs");
  const { readFile } = await import("node:fs/promises");
  const { z } = await import("zod");
  const source = await readFile(new URL("../node_modules/@polyvise/core/dist/chunk-DYN5DLLB.js", import.meta.url), "utf8");
  const patched = patchPanelSchemas(source);
  assert.equal(patchPanelSchemas(patched), patched);
  const executable = patched.replace(/import \{ z \} from "zod";/, "").replace(/export \{[\s\S]*?\};/, "");
  const schemas = new Function("z", `${executable}
; return { panelAdviceOutputSchema, panelChairOutputSchema };`)(z);
  const chair = { headline: "H".repeat(121), throughLine: "T".repeat(401), decisionGuidance: "G".repeat(701), confidence: 80 };
  assert.equal(schemas.panelChairOutputSchema.parse(chair).decisionGuidance.length, 701);
  assert.equal(schemas.panelChairOutputSchema.safeParse({ ...chair, confidence: 101 }).success, false);
  assert.equal(schemas.panelChairOutputSchema.safeParse({ ...chair, decisionGuidance: "" }).success, false);
  assert.equal(schemas.panelAdviceOutputSchema.safeParse({ recommendation: "R".repeat(401), reasoning: "Evidence", confidence: 0.8 }).success, true);
  assert.equal(schemas.panelAdviceOutputSchema.safeParse({ recommendation: "Advice", reasoning: "Evidence", confidence: 2 }).success, false);
});
