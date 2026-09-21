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

async function patch(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await patch(filename);
    else if (entry.name.endsWith(".js")) {
      const original = await readFile(filename, "utf8");
      const updated = patchConsensusSummarySchema(original);
      if (updated !== original) await writeFile(filename, updated);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../node_modules/@polyvise/core/", import.meta.url));
  const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  if (version !== "0.4.1") throw new Error("Review and remove the consensus schema patch before changing core versions.");
  await patch(path.join(root, "dist"));
}
