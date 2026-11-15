import { vi } from "vitest";
import recorded from "../fixtures/polyvise-api.json";

/**
 * A stand-in for the Polyvise API that replays responses recorded from the
 * real service in mock mode (see scripts/record-api-fixtures.mjs).
 */

export const fixtures = recorded;

export const FAKE_API_URL = "http://polyvise-api.test";

type RecordedRun = (typeof recorded.runs)[number];

export interface FakeApiOptions {
  /** End every job with this failure instead of its recorded result. */
  failure?: { message: string; summary: string; step: string; model?: string };
  /** Cut the first event stream of each job after this many events, as a dropped connection would. */
  dropStreamAfter?: number;
  /** Leave event streams open after their last event, as a slow or stalled connection would. */
  holdStreamsOpen?: boolean;
  /** Forget every job once started, as an API restart would. */
  loseJobs?: boolean;
  /** Answers for the single-call endpoints, keyed by path. A function receives the request body. */
  routes?: Record<string, unknown | ((body: any) => unknown)>;
}

export interface FakeApiCall {
  method: string;
  path: string;
  headers: Headers;
  body: any;
}

function scenarioKey(input: { subject?: unknown; context?: unknown; mode?: unknown; consensus?: unknown }) {
  return JSON.stringify([
    String(input.subject ?? "").trim(),
    String(input.context ?? "").trim(),
    input.mode ?? "hybrid_council"
  ]);
}

function eventBlocks(text: string): string[] {
  return text.split("\n\n").filter(Boolean).map((block) => `${block}\n\n`);
}

function stream(chunks: string[], close = true): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      // Split mid-event, with a keep-alive comment, the way a real connection delivers them.
      const text = `: ping\n\n${chunks.join("")}`;
      const middle = Math.floor(text.length / 2) + 3;
      controller.enqueue(encoder.encode(text.slice(0, middle)));
      controller.enqueue(encoder.encode(text.slice(middle)));
      if (close) controller.close();
    }
  });
}

/** Ids stay unique across installs, as they are across real runs. */
let started = 0;

/** Replaces `fetch` with the fake API. Returns every call it received. */
export function installFakeApi(options: FakeApiOptions = {}): FakeApiCall[] {
  process.env.POLYVISE_API_URL = FAKE_API_URL;
  const calls: FakeApiCall[] = [];
  const jobs = new Map<string, { run: RecordedRun; streams: number }>();

  const json = (body: unknown, status = 200) => Response.json(body, { status });

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL, init: RequestInit = {}) => {
      const url = String(input);
      if (!url.startsWith(FAKE_API_URL)) {
        throw new Error(`Unexpected request outside the fake Polyvise API: ${url}`);
      }
      const path = url.slice(FAKE_API_URL.length);
      const method = init.method ?? "GET";
      const body = typeof init.body === "string" ? JSON.parse(init.body) : undefined;
      const headers = new Headers(init.headers);
      calls.push({ method, path, headers, body });

      if (options.routes && path in options.routes) {
        const route = options.routes[path];
        const answer = typeof route === "function" ? route(body) : route;
        return answer instanceof Response ? answer : json(answer);
      }

      if (path === "/health") return json({ status: "ok", version: recorded.apiVersion, mockLlm: true });
      if (path === "/v1/models") return json({ models: recorded.models });

      if (path === "/v1/records") {
        if (String(body?.subject ?? "").trim().length < 4) {
          return json(
            { error: "Invalid request.", issues: [{ path: ["subject"], message: "Enter at least a short subject." }] },
            422
          );
        }
        const run = recorded.runs.find((candidate) => scenarioKey(candidate.input) === scenarioKey(body));
        if (!run) {
          return json({ error: `No recorded run for ${scenarioKey(body)}. Add it to scripts/record-api-fixtures.mjs.` }, 500);
        }
        const id = `debate_test${++started}`;
        jobs.set(id, { run, streams: 0 });
        return json({ record: { ...run.record, id }, request: run.request });
      }

      if (path === "/v1/jobs") {
        const job = jobs.get(body.debateId);
        if (!job) return json({ error: "Unknown debateId." }, 500);
        if (options.loseJobs) jobs.delete(body.debateId);
        return json({ debateId: body.debateId, attempt: 0, status: "running", framed: job.run.job.framed }, 202);
      }

      const match = /^\/v1\/jobs\/([^/]+)(\/events)?$/.exec(path);
      const job = match ? jobs.get(match[1]) : undefined;
      if (!match || !job) return json({ error: "Run not found." }, 404);

      if (match[2]) {
        let blocks = eventBlocks(job.run.events);
        if (options.failure) {
          const live = blocks.slice(0, 4);
          blocks = [
            ...live,
            `id: 0:${live.length + 1}\nevent: error\ndata: ${JSON.stringify({ kind: "error", message: options.failure.summary })}\n\n`,
            "event: closed\ndata: {}\n\n"
          ];
        }
        const after = Number((headers.get("last-event-id") ?? "0:0").split(":")[1]);
        blocks = blocks.slice(after);
        if (options.dropStreamAfter && job.streams++ === 0) {
          blocks = blocks.slice(0, options.dropStreamAfter);
        }
        return new Response(stream(blocks, !options.holdStreamsOpen), { headers: { "Content-Type": "text/event-stream" } });
      }

      return json(
        options.failure
          ? { ...job.run.job, debateId: match[1], status: "failed", run: undefined, failure: options.failure }
          : { ...job.run.job, debateId: match[1] }
      );
    })
  );
  return calls;
}
