"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { ModelOption } from "@/lib/model-catalog";

export interface EngineInfo {
  /** The Polyvise API's version; null until known. */
  version: string | null;
  /** The model catalog; null until loaded, or if the API can't be reached. */
  models: ModelOption[] | null;
}

const unknown: EngineInfo = { version: null, models: null };

const EngineInfoContext = createContext<EngineInfo>(unknown);

/**
 * Loads the model catalog and engine version once for the whole interface.
 * Both come from the Polyvise API at run time, so pages stay static and a
 * catalog change needs no rebuild. Pass `value` to supply them directly.
 */
export function EngineInfoProvider({ value, children }: { value?: EngineInfo; children: ReactNode }) {
  const [loaded, setLoaded] = useState<EngineInfo>(unknown);

  useEffect(() => {
    if (value) return;
    let cancelled = false;
    fetch("/api/engine")
      .then((response) => (response.ok ? response.json() : null))
      .then((info: EngineInfo | null) => {
        if (info && !cancelled) setLoaded(info);
      })
      .catch(() => {
        // The pickers fall back to the default models; nothing to report.
      });
    return () => {
      cancelled = true;
    };
  }, [value]);

  return <EngineInfoContext.Provider value={value ?? loaded}>{children}</EngineInfoContext.Provider>;
}

export function useEngineInfo(): EngineInfo {
  return useContext(EngineInfoContext);
}
