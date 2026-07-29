import packageJson from "../../package.json";
import { modelCatalog } from "./model-catalog";

/**
 * The engine version the app is pinned to. Read from the dependency range
 * rather than hardcoded so the rail footer can't drift from the lockfile.
 */
export const CORE_VERSION = packageJson.dependencies["@polyvise/core"].replace(/^[\^~]/, "");

export const MODEL_COUNT = modelCatalog.length;

export const PROVIDER_COUNT = new Set(modelCatalog.map((model) => model.provider)).size;
