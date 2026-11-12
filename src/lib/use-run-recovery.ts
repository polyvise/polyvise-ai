"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PolyviseRecord, RunLiveEvent } from "./run-record";
import { watchRun } from "./watch-run";

export function useRunRecovery(initial: PolyviseRecord, callbacks: {
  onEvent: (event: RunLiveEvent) => void;
  onRecord: (record: PolyviseRecord) => void;
}) {
  const [record, setRecord] = useState(initial);
  const [retrying, setRetrying] = useState(false);
  const [retryError, setRetryError] = useState<string | null>(null);
  const current = useRef(callbacks);
  current.current = callbacks;
  const request = useRef<AbortController | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const terminal = ["complete", "failed", "partial"].includes(record.status);

  useEffect(() => {
    setRecord(initial);
    current.current.onRecord(initial);
  }, [initial.id, initial.updatedAt]);

  useEffect(() => {
    if (terminal) return;
    stop.current = watchRun(record.id, event => {
      current.current.onEvent(event);
      if (event.kind === "error") setRecord(value => ({ ...value, status: "failed", failureReason: event.message }));
    }, saved => {
      setRecord(saved);
      current.current.onRecord(saved);
    }, record.recovery?.attempt ?? 0);
    return () => { stop.current?.(); stop.current = null; };
  }, [record.id, record.recovery?.attempt, terminal]);

  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  const retry = useCallback(async () => {
    if (request.current || !record.recovery?.available) return;
    const controller = new AbortController();
    request.current = controller;
    setRetrying(true);
    setRetryError(null);
    stop.current?.();
    const timeout = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch(`/api/debates/${record.id}/retry`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attempt: record.recovery.attempt }), signal: controller.signal
      });
      const payload = await response.json() as { debate?: PolyviseRecord; error?: string };
      if (request.current !== controller) return;
      if (payload.debate) {
        setRecord(payload.debate);
        current.current.onRecord(payload.debate);
      }
      if (!response.ok || !payload.debate) throw new Error(payload.error ?? "Could not reconnect. Try again.");
    } catch (error) {
      if (request.current === controller) setRetryError(error instanceof Error && error.name !== "AbortError"
        ? error.message : "The connection timed out. Your completed work is saved. Try again.");
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) { request.current = null; setRetrying(false); }
    }
  }, [record.id, record.recovery]);

  return { record, retry, retrying, retryError };
}
