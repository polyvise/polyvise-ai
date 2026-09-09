import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

/** Temporary, reproducible branding patch for the published core 0.4.0 artifact.
 * That release embeds mascot names in prompts AND output post-processing.
 * Remove this hook when upgrading to a verified neutral core release.
 */
export function neutralizeCoreBranding(source) {
  return source
    .replace(/green frog/gi, "supporting debater")
    .replace(/pink frog/gi, "opposing debater")
    .replace(/yes frog/gi, "supporting debater")
    .replace(/no frog/gi, "opposing debater")
    .replace(/judge frog/gi, "neutral judge")
    .replace(/\bfrogs\b/g, "debaters")
    .replace(/\bfrog\b/g, "debater")
    .replace(/\bFrogs\b/g, "Debaters")
    .replace(/\bFrog\b/g, "Debater");
}

async function patch(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) await patch(filename);
    else if (entry.name.endsWith(".js")) {
      const original = await readFile(filename, "utf8");
      const updated = neutralizeCoreBranding(original);
      if (updated !== original) await writeFile(filename, updated);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../node_modules/@polyvise/core/", import.meta.url));
  const { version } = JSON.parse(await readFile(path.join(root, "package.json"), "utf8"));
  if (version !== "0.4.0") throw new Error("Review and remove the core terminology patch before changing core versions.");
  await patch(path.join(root, "dist"));
}
