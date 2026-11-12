import type { RunCheckpoint } from "@polyvise/core/runs/checkpoint";
import { polyviseRuntimeConfig, withPolyviseTerminology } from "./polyvise-provider";
import { normalizeDebateOutput } from "@/lib/debate-terminology";
import { randomUUID } from "node:crypto";
import { createDefaultLlmProvider, LlmProviderFailure } from "@polyvise/core/providers/llm";
import {
  loadDebateRuntimeConfig,
  type DebateRuntimeConfig
} from "@polyvise/core/debate/config";
import {
  debateRequestSchema,
  feedbackRequestSchema,
  followupOutputSchema
} from "@polyvise/core/debate/schema";
import {
  frameDebateRequest,
  productNotes,
  runHybridCouncilDebate
} from "@polyvise/core/debate/engine";
import { runConsensus } from "@polyvise/core/consensus/engine";
import { runAdvisoryPanel } from "@polyvise/core/panel/engine";
import { createDefaultDebateRepository, createDefaultFeedbackRepository } from "./repository";
import { asDebateRun, type PolyviseRecord, type StoredRun, type RunLiveEvent } from "@/lib/run-record";
import type {
  DebateRecord,
  DebateRequest,
  FollowupExchange,
  ModelSnapshot,
  UserFeedback
} from "@polyvise/core/debate/types";

/**
 * Every mode's live events on one bus. The three payload unions stay separate
 * in core because their shapes genuinely differ; the transport does not care,
 * and a subscriber narrows on `kind` as it always has.
 */
export type { RunLiveEvent } from "@/lib/run-record";

const repository = createDefaultDebateRepository();
const feedbackRepository = createDefaultFeedbackRepository();
export const DEBATE_UNAVAILABLE_MESSAGE =
  "The run couldn't finish this step. Retry the failed step to continue.";
export const DEBATE_JUDGE_UNAVAILABLE_MESSAGE =
  "The judge couldn't finish this step. Retry the failed step to continue.";

type StoredRecord = PolyviseRecord & {
  retryState?: {
    request: DebateRequest;
    config: DebateRuntimeConfig;
    checkpoint?: RunCheckpoint;
    events: RunLiveEvent[];
    attempt: number;
  };
};

function publicRecord(record: StoredRecord): PolyviseRecord {
  const { retryState, ...publicFields } = record;
  return normalizeDebateOutput({ ...publicFields,
    recovery: { attempt: retryState?.attempt ?? 0, available: Boolean(retryState) },
    ...(!record.latestRun && retryState ? { liveEvents: retryState.events } : {})
  });
}

type Listener = (event: RunLiveEvent) => void;

class DebateEventBus {
  readonly buffer: RunLiveEvent[] = [];
  private listeners = new Set<Listener>();
  private terminal = false;
  constructor(readonly attempt = 0) {}

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

const buses = new Map<string, DebateEventBus>();

function scheduleBusCleanup(id: string, delayMs = 5 * 60 * 1000): void {
  const bus = buses.get(id);
  setTimeout(() => {
    if (buses.get(id) === bus) buses.delete(id);
  }, delayMs).unref?.();
}

function buildSeedRecord(input: DebateRequest): {
  record: PolyviseRecord;
  request: DebateRequest;
  config: DebateRuntimeConfig;
  framed: ReturnType<typeof frameDebateRequest>;
} {
  const request = debateRequestSchema.parse(input);
  const id = `debate_${randomUUID().slice(0, 10)}`;
  const framed = frameDebateRequest(request);
  const createdAt = new Date().toISOString();
  const record: PolyviseRecord = {
    id,
    subject: framed.subject,
    context: framed.context,
    mode: request.mode,
    evidence: request.evidence,
    status: "queued",
    resolution: framed.resolution,
    topicKind: framed.topicKind,
    highStakes: framed.highStakes,
    createdAt,
    updatedAt: createdAt,
    productNotes: productNotes(),
    followups: []
  };

  const baseConfig = polyviseRuntimeConfig(loadDebateRuntimeConfig());
  const config: DebateRuntimeConfig = {
    ...baseConfig,
    // Multi-agent arrays need more output room than a short model-lab answer.
    llmMaxTokens: Math.max(baseConfig.llmMaxTokens, 8192),
    useStrictJsonSchema: true,
    quickModel: request.models?.quick?.trim() || baseConfig.quickModel,
    deepModel: request.models?.deep?.trim() || baseConfig.deepModel,
    yesModel: request.models?.yes?.trim() || request.models?.quick?.trim() || baseConfig.yesModel,
    noModel: request.models?.no?.trim() || request.models?.deep?.trim() || baseConfig.noModel,
    judgeModel: request.models?.judge?.trim() || baseConfig.judgeModel
  };

  return { record, request, config: configWithDevOverrides(config, request), framed };
}

function configWithDevOverrides(config: DebateRuntimeConfig, request: DebateRequest): DebateRuntimeConfig {
  if (process.env.NODE_ENV === "production" || !request.devOptions?.liveApis) {
    return config;
  }

  return {
    ...config,
    evidenceProvider: "tavily",
    enableMockLlm: false,
    allowDeterministicFallbacks: false
  };
}

export interface StartDebateResult {
  debate: PolyviseRecord;
  completion: Promise<PolyviseRecord>;
}

export async function startDebate(input: DebateRequest): Promise<StartDebateResult> {
  const { record, request, config } = buildSeedRecord(input);
  const stored: StoredRecord = {
    ...record, retryState: { request, config, events: [], attempt: 0 }
  };
  await repository.save(stored);
  const completion = executeDebate(stored);
  return { debate: publicRecord(stored), completion };
}

function nextUpdatedAt(previous: string): string {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}

export async function retryDebate(id: string, attempt: number): Promise<{ debate: PolyviseRecord; accepted: boolean } | null> {
  const record = await repository.get(id) as StoredRecord | null;
  if (!record) return null;
  if (record.status === "complete") return { debate: publicRecord(record), accepted: true };
  if (!record.retryState) return { debate: publicRecord(record), accepted: false };
  const inactive = record.status === "failed" || record.status === "partial" || Date.now() - Date.parse(record.updatedAt) >= 5 * 60_000;
  if (!inactive) return { debate: publicRecord(record), accepted: true };
  if (record.retryState.attempt !== attempt) return { debate: publicRecord(record), accepted: false };
  const resumed: StoredRecord = {
    ...record, failureReason: undefined, failedStep: undefined, failedModel: undefined, status: "queued", updatedAt: nextUpdatedAt(record.updatedAt),
    retryState: { ...record.retryState, attempt: attempt + 1 }
  };
  if (!await repository.saveIfUnchanged(resumed, record.updatedAt)) {
    const current = await repository.get(id) as StoredRecord | null;
    return current ? { debate: publicRecord(current), accepted: current.status !== "failed" } : null;
  }
  void executeDebate(resumed);
  return { debate: publicRecord(resumed), accepted: true };
}

function executeDebate(seed: StoredRecord): Promise<PolyviseRecord> {
  let record = seed;
  const { request, config } = record.retryState!;
  let checkpoint = record.retryState!.checkpoint;
  let stage: DebateRecord["status"] = record.status;
  const bus = new DebateEventBus(record.retryState!.attempt);
  buses.set(record.id, bus);
  const persist = async (status: DebateRecord["status"], latestRun = record.latestRun) => {
    const next: StoredRecord = {
      ...record, status, latestRun, updatedAt: nextUpdatedAt(record.updatedAt),
      retryState: { ...record.retryState!, checkpoint, events: [...bus.buffer] }
    };
    if (!await repository.saveIfUnchanged(next, record.updatedAt)) {
      throw new Error("This debate attempt was replaced by another request.");
    }
    record = next;
    return publicRecord(record);
  };

  const completion = (async (): Promise<PolyviseRecord> => {
    try {
      const run = await runForMode(record.id, request, frameDebateRequest(request), config, (event) => {
        if (event.kind === "complete" || (event.kind === "stage" && event.status === "complete")) return;
        if (event.kind === "stage") stage = event.status;
        bus.emit(event);
      }, {
        checkpoint,
        onCheckpoint: async (value) => {
          checkpoint = value;
          await persist(stage);
        }
      });
      const completed = await persist(run.status, run);
      bus.emit({ kind: "stage", status: "complete" });
      bus.emit({ kind: "complete", runId: run.id });
      scheduleBusCleanup(record.id);
      return completed;
    } catch (error) {
      const failedSnapshot = modelSnapshotFromError(error);
      const failure = describeRunFailure(error, failedSnapshot, stage, record.mode);
      record = { ...record, failureReason: failure.reason, failedStep: failure.step, failedModel: failedSnapshot?.model };
      console.error("[polyvise.run.failed]", { runId: record.id, mode: record.mode, step: failure.step, reason: failure.reason });
      if (failedSnapshot) {
        bus.emit({ kind: "model_snapshot", snapshot: failedSnapshot });
      }
      try {
        await persist("failed");
      } finally {
        bus.emit({ kind: "error", message: failure.reason });
        scheduleBusCleanup(record.id);
      }
      throw error;
    }
  })();

  // Prevent unhandled rejection warnings when callers only consume via SSE.
  completion.catch(() => {});

  return completion;
}


/**
 * Runs whichever mode was asked for.
 *
 * The hybrid council keeps returning its flat run so records written before
 * the other modes existed stay byte-identical to new ones; consensus and the
 * panel return their envelopes, which is the only shape they have.
 */
async function runForMode(
  debateId: string,
  request: DebateRequest,
  framed: ReturnType<typeof frameDebateRequest>,
  config: DebateRuntimeConfig,
  emit: (event: RunLiveEvent) => void,
  recovery: { checkpoint?: RunCheckpoint; onCheckpoint: (checkpoint: RunCheckpoint) => Promise<void> }
): Promise<StoredRun> {
  const provider = withPolyviseTerminology(createDefaultLlmProvider(config));
  switch (request.mode) {
    case "consensus":
      return runConsensus(debateId, request, framed, { config, emit, provider, ...recovery });
    case "advisory_panel":
      return runAdvisoryPanel(debateId, request, framed, { config, emit, provider, ...recovery });
    case "hybrid_council":
    default:
      return runHybridCouncilDebate(debateId, request, framed, { config, emit, provider, ...recovery, streamTurns: true });
  }
}

function modelSnapshotFromError(error: unknown): ModelSnapshot | null {
  if (error instanceof LlmProviderFailure) {
    return error.snapshot;
  }
  return null;
}

function describeRunFailure(
  error: unknown,
  snapshot: ModelSnapshot | null,
  status: DebateRecord["status"] | undefined,
  mode: DebateRequest["mode"]
): { reason: string; step: string } {
  const stageLabels: Partial<Record<DebateRecord["status"], string>> = {
    framing: "question framing",
    researching: "evidence gathering",
    debating: mode === "advisory_panel" ? "panel advice" : mode === "consensus" ? "perspective responses" : "debate",
    judging: mode === "advisory_panel" ? "panel chair" : mode === "consensus" ? "consensus summary" : "judge review"
  };
  const step = snapshot?.role ?? (status ? stageLabels[status] : undefined) ?? "run setup";
  const raw = snapshot?.failure ?? (error instanceof Error ? error.message : "The run could not finish.");
  const timedOut = /abort|timed?\s*out|timeout/i.test(raw);
  const prefix = snapshot?.model ? `${snapshot.model} ${timedOut ? "timed out" : "failed"}` : "The run failed";
  const detail = /structured output validation failed/i.test(raw)
    ? "The model returned an answer that did not match the required format."
    : /openrouter_api_key/i.test(raw)
      ? "The model provider is not configured."
      : raw;
  return {
    reason: `${prefix} during ${step}.${timedOut ? " Retry the failed step to continue." : ` ${detail}`}`.slice(0, 500),
    step
  };
}

export async function createDebate(input: DebateRequest): Promise<PolyviseRecord> {
  const { completion } = await startDebate(input);
  return completion;
}

export function subscribeToDebate(
  debateId: string,
  listener: Listener,
  attempt?: number
): { unsubscribe: () => void; terminal: boolean } {
  const bus = buses.get(debateId);
  if (!bus || (attempt !== undefined && bus.attempt !== attempt)) {
    return { unsubscribe: () => {}, terminal: true };
  }
  const unsubscribe = bus.subscribe(listener);
  return { unsubscribe, terminal: bus.isTerminal() };
}

export async function getDebate(id: string): Promise<PolyviseRecord | null> {
  const record = await repository.get(id);
  return record ? publicRecord(record) : null;
}

export async function listDebates(): Promise<PolyviseRecord[]> {
  return (await repository.list()).map(publicRecord);
}

export async function submitFeedback(input: {
  app?: string;
  message: string;
  debateId?: string;
  pagePath?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}): Promise<UserFeedback> {
  const parsed = feedbackRequestSchema.parse(input);
  const feedback: UserFeedback = {
    id: `feedback_${randomUUID().slice(0, 12)}`,
    app: input.app?.trim() || "polyvise",
    message: parsed.message,
    debateId: parsed.debateId || undefined,
    pagePath: parsed.pagePath || undefined,
    userAgent: input.userAgent?.trim() || undefined,
    metadata: input.metadata ?? {},
    createdAt: new Date().toISOString()
  };

  await feedbackRepository.save(feedback);
  return feedback;
}

export function listFeedback(): Promise<UserFeedback[]> {
  return feedbackRepository.list();
}

export async function addFollowup(debateId: string, question: string): Promise<FollowupExchange | null> {
  const debate = await getDebate(debateId);
  if (!debate?.latestRun) {
    return null;
  }

  const answer = await answerFollowup(question, debate);
  const exchange: FollowupExchange = {
    id: `followup_${randomUUID().slice(0, 8)}`,
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

async function answerFollowup(question: string, debate: PolyviseRecord): Promise<string> {
  const fallback = {
    answer: answerFollowupDeterministic(question, debate)
  };

  try {
    const result = await withPolyviseTerminology(createDefaultLlmProvider(polyviseRuntimeConfig(loadDebateRuntimeConfig()))).generateStructured<unknown>({
      role: "follow-up answer",
      schemaName: "followupOutput",
      prompt: JSON.stringify(fallback)
    });
    return followupOutputSchema.parse(result.data).answer;
  } catch {
    return fallback.answer;
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
