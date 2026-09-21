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
