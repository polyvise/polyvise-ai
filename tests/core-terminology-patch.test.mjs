import { test } from "node:test";
import assert from "node:assert/strict";
import { neutralizeCoreBranding } from "../scripts/patch-core-terminology.mjs";

test("published core prompts, post-processing, and routing use consistent participant names", () => {
  const source = `const task = "Use green frog and pink frog language";
const role = "yes frog claim builder";
if (normalized.includes("yes frog")) return config.yesModel;
const label = "The other frog says";
const output = value.replace(/pro side/gi, "green frog");`;
  const result = neutralizeCoreBranding(source);
  assert.ok(!/\bfrog\b/i.test(result));
  assert.ok(result.includes('"supporting debater claim builder"'));
  assert.ok(result.includes('normalized.includes("supporting debater")'));
  assert.ok(result.includes('value.replace(/pro side/gi, "supporting debater")'));
  assert.ok(result.includes('"The other debater says"'));
  assert.equal(neutralizeCoreBranding(result), result);
});
