import { polyvisePromptPolicy } from "./prompt-policy";
import { normalizeDebateOutput } from "@/lib/debate-terminology";
import {
  answerFollowup,
  getJob,
  jobEvents,
  normalizeFeedback,
  PolyviseApiError,
  seedRecord,
  startJob,
  type ApiCallOptions,
  type JobFailure,
  type JobStatus
} from "./polyvise-api";
import { createDefaultDebateRepository, createDefaultFeedbackRepository } from "./repository";
import { asDebateRun, type PolyviseRecord } from "@/lib/run-record";
import type {
  AdvisoryPanelLiveEvent,
  ConsensusLiveEvent,
  DebateLiveEvent,
  FollowupExchange,
  UserFeedback
} from "@/lib/polyvise-api/types";

/**
 * Every mode's live events on one bus. The three payload unions stay separate
 * because their shapes genuinely differ; the transport does not care, and a
 * subscriber narrows on `kind` as it always has.
 */
export type RunLiveEvent = DebateLiveEvent | ConsensusLiveEvent | AdvisoryPanelLiveEvent;

const repository = createDefaultDebateRepository();
const feedbackRepository = createDefaultFeedbackRepository();
export const DEBATE_UNAVAILABLE_MESSAGE =
  "The debate couldn't start right now. Please try again in a few minutes.";
const RUN_INTERRUPTED_MESSAGE =
  "The run was interrupted before it finished. Please start it again.";

type Listener = (event: RunLiveEvent) => void;

class DebateEventBus {
  readonly buffer: RunLiveEvent[] = [];
  private listeners = new Set<Listener>();
  private terminal = false;

  emit(event: RunLiveEvent): void {
    event = normalizeDebateOutput(event);
    this.buffer.push(event);
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch {
        // listener errors should not break the run
      }
    }
    if (event.kind === "complete" || event.kind === "error") {
      this.terminal = true;
    }
  }

  subscribe(listener: Listener): () => void {
    // replay buffered events so a late subscriber catches up
    for (const event of this.buffer) {
      try {
        listener(event);
      } catch {
        // ignore
      }
    }
    if (this.terminal) {
      return () => {};
    }
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  isTerminal(): boolean {
    return this.terminal;
  }
}

/** A run this server instance is following on the API. */
interface RunWatch {
  bus: DebateEventBus;
  completion: Promise<PolyviseRecord>;
}

const watches = new Map<string, RunWatch>();

function scheduleWatchCleanup(id: string, delayMs = 5 * 60 * 1000): void {
  setTimeout(() => {
    watches.delete(id);
  }, delayMs).unref?.();
}

const promptPolicy: ApiCallOptions["provider"] = { promptPolicy: polyvisePromptPolicy };

function runOptions(): ApiCallOptions {
  const configured = Number(process.env.POLYVISE_LLM_MAX_TOKENS) || 0;
  return {
    config: {
      // Multi-agent arrays need more output room than a short model-lab answer.
      llmMaxTokens: Math.max(configured, 8192),
      useStrictJsonSchema: true
    },
    provider: promptPolicy
  };
}

export interface StartDebateResult {
  debate: PolyviseRecord;
  completion: Promise<PolyviseRecord>;
}

/**
 * Starts a run on the Polyvise API and follows it from here.
 *
 * The API validates and frames the request, runs the engine as a background
 * job and streams its events; this app owns the record. Throws
 * `PolyviseApiError` (`invalidRequest`) when the request breaks the contract.
 */
export async function startDebate(input: unknown): Promise<StartDebateResult> {
  const { record: seed, request } = await seedRecord(input);
  const record: PolyviseRecord = seed;
  await startJob(record.id, request, runOptions());
  await repository.save(record);
  return { debate: record, completion: watchRun(record).completion };
}

function watchRun(record: PolyviseRecord): RunWatch {
  const existing = watches.get(record.id);
  if (existing) {
    return existing;
  }
  const bus = new DebateEventBus();
  const completion = followRun(record, bus).finally(() => scheduleWatchCleanup(record.id));
  // Prevent unhandled rejection warnings when callers only consume via SSE.
  completion.catch(() => {});
  const watch = { bus, completion };
  watches.set(record.id, watch);
  return watch;
}

const MAX_STREAM_FAILURES = 5;

/** Longer than the API's keep-alive interval, so a quiet but healthy stream is not mistaken for a broken one. */
const HEALTHY_STREAM_MS = 20_000;

function isLiveEvent(data: unknown): data is RunLiveEvent {
  return Boolean(data) && typeof data === "object" && typeof (data as { kind?: unknown }).kind === "string";
}

/**
 * Relays a job's events onto the bus until the job ends, then stores the
 * outcome. A dropped connection resumes after the last event received, so a
 * long run survives the API's per-request time limit.
 */
async function followRun(record: PolyviseRecord, bus: DebateEventBus): Promise<PolyviseRecord> {
  let lastEventId: string | undefined;
  let failures = 0;

  for (;;) {
    const connectedAt = Date.now();
    let progressed = false;
    let ended = false;
    let lost = false;
    try {
      for await (const event of jobEvents(record.id, lastEventId)) {
        progressed = true;
        if (event.id) lastEventId = event.id;
        // The terminal event is published by `settleRun`, once the outcome is
        // stored, so a client that stops listening there can fetch the record.
        if (event.name === "closed" || event.name === "complete" || event.name === "error") {
          ended = true;
          break;
        }
        if (isLiveEvent(event.data)) {
          bus.emit(event.data);
        }
      }
    } catch (error) {
      // A 404 means the API no longer knows this job: it restarted or the job expired.
      lost = error instanceof PolyviseApiError && error.status === 404;
      if (!lost) {
        console.warn("[polyvise.run.stream]", {
          runId: record.id,
          reason: error instanceof Error ? error.message.slice(0, 300) : "Unknown error"
        });
      }
    }

    if (ended) {
      return settleRun(record, bus);
    }
    failures = progressed || Date.now() - connectedAt >= HEALTHY_STREAM_MS ? 0 : failures + 1;
    if (lost || failures >= MAX_STREAM_FAILURES) {
      return failRun(record, bus, {
        message: lost ? "The Polyvise API no longer has this job." : "Lost contact with the Polyvise API.",
        summary: RUN_INTERRUPTED_MESSAGE,
        step: "run"
      });
    }
    if (failures > 0) {
      await new Promise((resolve) => setTimeout(resolve, Math.min(500 * 2 ** failures, 8000)));
    }
  }
}

async function jobOutcome(id: string): Promise<JobStatus | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getJob(id);
    } catch (error) {
      if ((error instanceof PolyviseApiError && error.status === 404) || attempt >= 2) {
        return null;
      }
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

async function settleRun(record: PolyviseRecord, bus: DebateEventBus): Promise<PolyviseRecord> {
  const job = await jobOutcome(record.id);
  if (job?.status === "complete" && job.run) {
    const completed: PolyviseRecord = {
      ...record,
      status: job.run.status,
      latestRun: job.run,
      updatedAt: new Date().toISOString()
    };
    await repository.save(completed);
    bus.emit({ kind: "complete", runId: job.run.id });
    return completed;
  }
  return failRun(
    record,
    bus,
    job?.failure ?? { message: "The run ended without a result.", summary: RUN_INTERRUPTED_MESSAGE, step: "run" }
  );
}

async function failRun(record: PolyviseRecord, bus: DebateEventBus, failure: JobFailure): Promise<never> {
  const failed: PolyviseRecord = {
    ...record,
    status: "failed",
    failureReason: failure.summary,
    failedStep: failure.step,
    failedModel: failure.model,
    updatedAt: new Date().toISOString()
  };
  await repository.save(failed);
  bus.emit({ kind: "error", message: failure.summary });
  console.error("[polyvise.run.failed]", {
    runId: record.id,
    mode: record.mode,
    step: failure.step,
    model: failure.model,
    reason: failure.summary,
    technicalReason: failure.message.slice(0, 1000)
  });
  throw new Error(failure.message);
}

export async function createDebate(input: unknown): Promise<PolyviseRecord> {
  const { completion } = await startDebate(input);
  return completion;
}

/**
 * Streams a run's events to `listener`, replaying what already happened.
 *
 * A run that is still in flight but unknown to this server instance — started
 * by another instance, or before a restart — is picked up from the API, which
 * replays it and lets this instance store the outcome.
 */
export function subscribeToDebate(
  debate: PolyviseRecord,
  listener: Listener
): { unsubscribe: () => void; terminal: boolean } {
  const finished = debate.status === "complete" || debate.status === "failed";
  const watch = watches.get(debate.id) ?? (finished ? null : watchRun(debate));
  if (!watch) {
    return { unsubscribe: () => {}, terminal: true };
  }
  const unsubscribe = watch.bus.subscribe(listener);
  return { unsubscribe, terminal: watch.bus.isTerminal() };
}

export async function getDebate(id: string): Promise<PolyviseRecord | null> {
  const record = await repository.get(id);
  return record ? normalizeDebateOutput(record) : null;
}

export async function listDebates(): Promise<PolyviseRecord[]> {
  return normalizeDebateOutput(await repository.list());
}

export async function submitFeedback(input: {
  app?: string;
  message: string;
  debateId?: string;
  pagePath?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<UserFeedback> {
  const feedback = await normalizeFeedback({ ...input });
  await feedbackRepository.save(feedback);
  return feedback;
}

export function listFeedback(): Promise<UserFeedback[]> {
  return feedbackRepository.list();
}

/** Throws `PolyviseApiError` (`invalidRequest`) when the question breaks the API's contract. */
export async function addFollowup(debateId: string, input: unknown): Promise<FollowupExchange | null> {
  const debate = await getDebate(debateId);
  if (!debate?.latestRun) {
    return null;
  }

  const question = typeof input === "string" ? input.trim() : "";
  const answer = await followupAnswer(question, debate);
  const exchange: FollowupExchange = {
    id: `followup_${crypto.randomUUID().slice(0, 8)}`,
    question,
    answer,
    createdAt: new Date().toISOString()
  };

  const updated = {
    ...debate,
    followups: [...debate.followups, exchange],
    updatedAt: new Date().toISOString()
  };
  await repository.save(updated);

  return exchange;
}

async function followupAnswer(question: string, debate: PolyviseRecord): Promise<string> {
  const fallbackAnswer = answerFollowupDeterministic(question, debate);

  try {
    return (await answerFollowup({ question, fallbackAnswer }, { provider: promptPolicy })).answer;
  } catch (error) {
    if (error instanceof PolyviseApiError && error.invalidRequest) {
      throw error;
    }
    return fallbackAnswer;
  }
}

function answerFollowupDeterministic(question: string, debate: PolyviseRecord): string {
  const lowered = question.toLowerCase();
  const run = debate.latestRun ? asDebateRun(debate.latestRun) : null;
  const summary = run?.summary;

  if (!summary) {
    return "The debate has not completed yet, so this question cannot be answered from the run record.";
  }

  if (lowered.includes("change") || lowered.includes("mind")) {
    return `The clearest mind-changers are: ${summary.whatWouldChangeMind.join(" ")}`;
  }

  if (lowered.includes("risk") || lowered.includes("downside")) {
    return `The main downside is: ${summary.strongestCon[0]} The practical response is to make the first step reversible and name stop conditions before acting.`;
  }

  if (lowered.includes("source") || lowered.includes("evidence")) {
    const sources = run?.sources.slice(0, 3).map((source) => `${source.publisher}: ${source.title}`);
    return `The run leaned on these sources first: ${sources?.join("; ")}. Live search can replace development references when BRAVE_SEARCH_API_KEY or TAVILY_API_KEY is configured.`;
  }

  return `Based on the completed debate, the answer is conditional: ${summary.recommendation}`;
}
