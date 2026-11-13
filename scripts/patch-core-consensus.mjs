import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Length is presentation guidance, not a reason to discard a valid analysis.
export function patchConsensusSummarySchema(source) {
  return source.replace(
    /((?:var|const) consensusSummaryOutputSchema = [\s\S]*?\n\}\);)/g,
    (schema) => schema.replace(/\.max\((?:120|400)\)/g, ""),
  );
}

export function patchPanelSchemas(source) {
  return source.replace(
    /((?:var|const) panel(?:Advice|Chair)OutputSchema = [\s\S]*?\n\}\);)/g,
    (schema) => schema.replace(/\.max\((?:120|400|700)\)/g, ""),
  );
}

async function patch(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await patch(filename);
    else if (entry.name.endsWith(".js")) {
      const original = await readFile(filename, "utf8");
      const updated = patchProviderRetries(patchDebateSummarySchema(patchPanelSchemas(patchConsensusSummarySchema(original))));
      if (updated !== original) await writeFile(filename, updated);
    }
  }
}

export function patchDebateSummarySchema(source) {
  return source.replace(
    /((?:var|const) finalSummaryOutputSchema = [\s\S]*?\n\}\);)/g,
    schema => schema.replace(/\.max\((?:120|320)\)/g, ""),
  );
}

// Retrying clipped JSON with the same output budget repeats the failure.
export function patchProviderRetries(source) {
  if (source.includes("Model response exceeded the output token budget")) return source;
  return source
    .replace('this.completeStructured(request, model, started, useJsonSchema);', 'this.completeStructured(request, model, started, useJsonSchema, attempt);')
    .replace('async completeStructured(request, model, started, useJsonSchema) {', 'async completeStructured(request, model, started, useJsonSchema, attempt = 1) {')
    .replace('max_tokens: this.config.llmMaxTokens,', 'max_tokens: Math.min(32768, this.config.llmMaxTokens * 2 ** (attempt - 1)),')
    .replace('const content = payload.choices?.[0]?.message?.content;', `if (payload.choices?.[0]?.finish_reason === "length") {
        throw new SyntaxError("Model response exceeded the output token budget; retrying with more room.");
      }
      const content = payload.choices?.[0]?.message?.content;`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../node_modules/@polyvise/core/", import.meta.url));
  const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  if (version !== "0.4.1") throw new Error("Review and remove the consensus schema patch before changing core versions.");
  await patch(path.join(root, "dist"));
}
