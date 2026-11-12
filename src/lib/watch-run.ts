import type { RunLiveEvent, PolyviseRecord } from "@/lib/run-record";

const POLL_INTERVAL_MS = 10_000;
const REQUEST_TIMEOUT_MS = 10_000;
export const RUN_IDLE_TIMEOUT_MS = 5 * 60_000;
export const RUN_CONNECTION_MESSAGE =
  "No progress was received before the connection timed out. Retry the failed step to reconnect or continue from saved progress.";

/** SSE supplies live turns; the saved record recovers a missed terminal event. */
export function watchRun(
  debateId: string,
  onEvent: (event: RunLiveEvent) => void,
  onRecord: (debate: PolyviseRecord) => void,
  attempt = 0
): () => void {
  const stream = new EventSource(`/api/debates/${debateId}/events?attempt=${attempt}`);
  let stopped = false;
  let pending = false;
  let lastProgressAt = Date.now();
  let receivedCompletion = false;
  let savedStamp = "";
  let request: AbortController | null = null;

  const stop = () => {
    stopped = true;
    stream.close();
    clearInterval(timer);
    request?.abort();
  };

  const poll = async () => {
    if (stopped || pending) return;
    pending = true;
    const controller = new AbortController();
    request = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`/api/debates/${debateId}`, {
        cache: "no-store", signal: controller.signal
      });
      if (!response.ok) return;
      const { debate } = await response.json() as { debate?: PolyviseRecord };
      if (stopped || !debate || debate.id !== debateId) return;
      if (debate.recovery && debate.recovery.attempt < attempt) return;
      if (["complete", "failed", "partial"].includes(debate.status)) {
        onRecord(debate);
        stop();
        return;
      }
      if (!receivedCompletion && debate.updatedAt && debate.updatedAt !== savedStamp) {
        savedStamp = debate.updatedAt;
        lastProgressAt = Math.max(lastProgressAt, Math.min(Date.now(), Date.parse(debate.updatedAt)));
        onRecord(debate);
      }
      // Saved progress also covers a stream connected to a different instance.
    } catch {
      // Temporary network failures are retried until the idle deadline.
    } finally {
      clearTimeout(timeout);
      request = null;
      pending = false;
    }
  };

  const timer = setInterval(() => {
    if (Date.now() - lastProgressAt >= RUN_IDLE_TIMEOUT_MS) {
      if (!receivedCompletion) onEvent({ kind: "error", message: RUN_CONNECTION_MESSAGE });
      stop();
      return;
    }
    void poll();
  }, POLL_INTERVAL_MS);

  const kinds: RunLiveEvent["kind"][] = [
    "stage", "framed", "scouts", "teams", "sources", "claims",
    "argument_map", "agents", "lenses", "round", "advice", "chair", "convergence", "turns", "scorecard", "summary", "model_snapshot", "complete", "error"
  ];
  for (const kind of kinds) {
    stream.addEventListener(kind, (message) => {
      if (stopped) return;
      // EventSource's transport errors have no data. Close the stream to
      // avoid replaying all turns on reconnect; polling still gets the result.
      if (!(message instanceof MessageEvent)) {
        stream.close();
        void poll();
        return;
      }
      let event: RunLiveEvent;
      try {
        const parsed: unknown = JSON.parse(message.data);
        if (!parsed || typeof parsed !== "object") return;
        event = { kind, ...parsed } as RunLiveEvent;
      } catch {
        return;
      }
      if (event.kind !== kind) return;
      lastProgressAt = Date.now();
      onEvent(event);
      if (event.kind === "error") stop();
      if (event.kind === "complete") {
        receivedCompletion = true;
        stream.close();
        // Keep polling for older workers that emitted before persistence.
        void poll();
      }
    });
  }
  stream.addEventListener("closed", () => {
    if (stopped) return;
    stream.close();
    void poll();
  });

  return stop;
}
