import type {
  AvailableModel,
  DebateRecord,
  DebateRequest,
  FramedDebate,
  ModelSnapshot,
  UserFeedback
} from "@/lib/polyvise-api/types";
import type { StoredRun } from "@/lib/run-record";

/**
 * The one place this app talks to the Polyvise API.
 *
 * Every model call, schema and engine step lives behind that service; this
 * module only knows its URLs and the shape of what comes back.
 */

const DEFAULT_API_URL = "https://api.polyvise.ai";

/** Long enough for the API's slowest single call (a lab fan-out, a follow-up with retries). */
const DEFAULT_TIMEOUT_MS = 30_000;

export function polyviseApiUrl(): string {
  return (process.env.POLYVISE_API_URL?.trim() || DEFAULT_API_URL).replace(/\/+$/, "");
}

export interface ApiIssue {
  path: string[];
  message: string;
}

/** A non-2xx answer from the API. `issues` is present when the request itself was invalid. */
export class PolyviseApiError extends Error {
  readonly status: number;
  readonly issues?: ApiIssue[];
  readonly body: Record<string, unknown>;

  constructor(status: number, message: string, body: Record<string, unknown> = {}) {
    super(message);
    this.name = "PolyviseApiError";
    this.status = status;
    this.body = body;
    if (Array.isArray(body.issues)) {
      this.issues = body.issues as ApiIssue[];
    }
  }

  /** The caller sent something the API's contract rejects, as opposed to the API failing. */
  get invalidRequest(): boolean {
    return this.status === 422;
  }
}

function headers(extra: Record<string, string> = {}): Record<string, string> {
  const key = process.env.POLYVISE_API_KEY?.trim();
  return {
    Accept: "application/json",
    ...(key ? { Authorization: `Bearer ${key}` } : {}),
    ...extra
  };
}

async function failure(response: Response): Promise<PolyviseApiError> {
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  const message =
    typeof body.error === "string" && body.error
      ? body.error
      : `The Polyvise API answered ${response.status}.`;
  return new PolyviseApiError(response.status, message, body);
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  timeoutMs?: number;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await fetch(`${polyviseApiUrl()}${path}`, {
    method: options.method ?? (options.body === undefined ? "GET" : "POST"),
    headers: headers(options.body === undefined ? {} : { "Content-Type": "application/json" }),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
    signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  });
  if (!response.ok) {
    throw await failure(response);
  }
  return (await response.json()) as T;
}

// ------------------------------------------------------------------ runs

/** Product-level prompt additions and runtime tuning the API applies to a run or a single call. */
export interface ApiCallOptions {
  config?: { llmMaxTokens?: number; useStrictJsonSchema?: boolean };
  provider?: { promptPolicy?: { fields: Record<string, string> } };
}

export interface JobFailure {
  message: string;
  /** A short, user-presentable description (model, step, and why). */
  summary: string;
  step: string;
  failedStep?: string;
  model?: string;
  snapshot?: ModelSnapshot;
}

export interface JobStatus {
  debateId: string;
  attempt: number;
  status: "running" | "complete" | "failed";
  mode: string;
  framed: FramedDebate;
  createdAt: string;
  updatedAt: string;
  run?: StoredRun;
  failure?: JobFailure;
  resumable: boolean;
}

/** The queued record to persist before a run starts, and the request as the API parsed it. */
export function seedRecord(input: unknown): Promise<{ record: DebateRecord; request: DebateRequest }> {
  return request("/v1/records", { body: input ?? {} });
}

/** Starts a run in the background on the API. Its events arrive from `jobEvents`. */
export function startJob(
  debateId: string,
  runRequest: DebateRequest,
  options: ApiCallOptions
): Promise<{ debateId: string; attempt: number; status: string; framed: FramedDebate }> {
  return request("/v1/jobs", { body: { request: runRequest, debateId, options } });
}

export function getJob(debateId: string): Promise<JobStatus> {
  return request(`/v1/jobs/${encodeURIComponent(debateId)}`);
}

export interface ApiEvent {
  /** `<attempt>:<n>`; absent on the terminating `closed` event. */
  id?: string;
  name: string;
  data: unknown;
}

/**
 * A job's server-sent events: the attempt so far, then live ones, ending with
 * `closed`. Pass the last `id` seen to receive only what followed it.
 */
export async function* jobEvents(debateId: string, after?: string): AsyncGenerator<ApiEvent> {
  // Aborting is how a caller that stops reading early (it saw the terminal
  // event) releases the connection without waiting on the server.
  const connection = new AbortController();
  try {
    const response = await fetch(`${polyviseApiUrl()}/v1/jobs/${encodeURIComponent(debateId)}/events`, {
      headers: headers({ Accept: "text/event-stream", ...(after ? { "Last-Event-ID": after } : {}) }),
      cache: "no-store",
      signal: connection.signal
    });
    if (!response.ok || !response.body) {
      throw await failure(response);
    }
    yield* parseEventStream(response.body);
  } finally {
    connection.abort();
  }
}

export async function* parseEventStream(body: ReadableStream<Uint8Array>): AsyncGenerator<ApiEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      pending += decoder.decode(value, { stream: !done });
      const blocks = pending.split(/\r?\n\r?\n/);
      pending = done ? "" : (blocks.pop() ?? "");
      for (const block of blocks) {
        const event = parseEventBlock(block);
        if (event) yield event;
      }
      if (done) return;
    }
  } finally {
    // Not awaited: cancelling a body that is still open can wait on the server
    // indefinitely, and nothing here depends on it finishing.
    void reader.cancel().catch(() => {});
  }
}

function parseEventBlock(block: string): ApiEvent | null {
  let id: string | undefined;
  let name = "message";
  const data: string[] = [];
  for (const line of block.split(/\r?\n/)) {
    if (!line || line.startsWith(":")) continue; // blank or a keep-alive comment
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    const value = colon === -1 ? "" : line.slice(colon + 1).replace(/^ /, "");
    if (field === "id") id = value;
    else if (field === "event") name = value;
    else if (field === "data") data.push(value);
  }
  if (!data.length) return null;
  try {
    return { id, name, data: JSON.parse(data.join("\n")) };
  } catch {
    return null;
  }
}

// ----------------------------------------------------- single model calls

export interface FollowupAnswer {
  answer: string;
  /** False when the API fell back to the answer this app supplied. */
  generated: boolean;
  failure?: string;
}

export function answerFollowup(
  input: { question: string; fallbackAnswer: string },
  options: ApiCallOptions
): Promise<FollowupAnswer> {
  return request("/v1/followups", { body: { ...input, ...options }, timeoutMs: 180_000 });
}

export interface LabAnswer {
  model: string;
  answer: string | null;
  latencyMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  estimatedCostUsd?: number;
  failure?: string;
}

export async function askLab(prompt: string, models: string[]): Promise<LabAnswer[]> {
  const { answers } = await request<{ answers: LabAnswer[] }>("/v1/lab", {
    body: { prompt, models },
    timeoutMs: 180_000
  });
  return answers;
}

/** Validates feedback and returns the record to store. */
export async function normalizeFeedback(input: Record<string, unknown>): Promise<UserFeedback> {
  const { feedback } = await request<{ feedback: UserFeedback }>("/v1/feedback", { body: input });
  return feedback;
}

// -------------------------------------------------------------- reference

export async function listModels(): Promise<AvailableModel[]> {
  const { models } = await request<{ models: AvailableModel[] }>("/v1/models", { timeoutMs: 10_000 });
  return models;
}

export interface ApiRuntime {
  /** Whether each upstream provider has a key configured on the API. */
  providers: { openrouter: boolean; tavily: boolean; brave: boolean };
  config: { enableMockLlm: boolean };
}

export function getRuntime(): Promise<ApiRuntime> {
  return request("/v1/config", { timeoutMs: 10_000 });
}

/** Unauthenticated liveness and version. */
export function getHealth(): Promise<{ status: string; version: string; mockLlm: boolean }> {
  return request("/health", { timeoutMs: 10_000 });
}
