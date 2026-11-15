import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as startRun } from "@/app/api/debates/route";
import { POST as askFollowup } from "@/app/api/debates/[id]/followups/route";
import { GET as engineInfo } from "@/app/api/engine/route";
import { addFollowup, getDebate, startDebate, subscribeToDebate, type RunLiveEvent } from "@/server/debate-store";
import { runModelLab } from "@/server/model-lab";
import { parseEventStream, PolyviseApiError } from "@/server/polyvise-api";
import { polyvisePromptPolicy } from "@/server/prompt-policy";
import type { NextRequest } from "next/server";
import { FAKE_API_URL, fixtures, installFakeApi } from "./helpers/fake-api";

const RECESS = { subject: "Should schools have longer recess?" };

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.POLYVISE_API_KEY;
});

function post(body: unknown): NextRequest {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: { "x-forwarded-for": `198.51.100.${Math.ceil(Math.random() * 250)}` },
    body: JSON.stringify(body)
  }) as unknown as NextRequest;
}

function recordedEvents(subject: string): RunLiveEvent[] {
  const run = fixtures.runs.find((candidate) => candidate.input.subject === subject)!;
  return run.events
    .split("\n\n")
    .map((block) => block.split("\n").find((line) => line.startsWith("data: ")))
    .filter((line): line is string => Boolean(line))
    .map((line) => JSON.parse(line.slice(6)))
    .filter((event) => typeof event.kind === "string");
}

describe("starting a run on the Polyvise API", () => {
  it("authenticates, and sends the product's prompt policy and output budget with the job", async () => {
    process.env.POLYVISE_API_KEY = "test-key";
    const calls = installFakeApi();
    const { debate, completion } = await startDebate(RECESS);
    await completion;

    expect(calls.every((call) => call.headers.get("authorization") === "Bearer test-key")).toBe(true);
    const job = calls.find((call) => call.path === "/v1/jobs")!;
    expect(job.body.debateId).toBe(debate.id);
    expect(job.body.request.subject).toBe(RECESS.subject);
    expect(job.body.options.config).toEqual({ llmMaxTokens: 8192, useStrictJsonSchema: true });
    expect(job.body.options.provider.promptPolicy).toEqual(polyvisePromptPolicy);
  });

  it("keeps the naming rule and the word limits in the prompt policy", () => {
    const { polyviseParticipantNaming, responseLengthGuidance } = polyvisePromptPolicy.fields;
    expect(polyviseParticipantNaming).toContain("supporting debater");
    expect(polyviseParticipantNaming).toContain("Do not invent animal mascots");
    expect(responseLengthGuidance).toContain("1,200 words");
    expect(responseLengthGuidance).toContain("150 words");
    expect(responseLengthGuidance).toContain("200 words");
    expect(responseLengthGuidance).toContain("never truncate");
  });

  it("relays every live event once, in order, and ends after the record is stored", async () => {
    installFakeApi();
    const { debate, completion } = await startDebate(RECESS);
    const seen: RunLiveEvent[] = [];
    let storedAtComplete: string | undefined;
    subscribeToDebate(debate, (event) => {
      seen.push(event);
    });
    const record = await completion;
    storedAtComplete = (await getDebate(debate.id))?.status;

    expect(seen.map((event) => event.kind)).toEqual(recordedEvents(RECESS.subject).map((event) => event.kind));
    expect(seen.at(-1)).toEqual({ kind: "complete", runId: record.latestRun!.id });
    expect(storedAtComplete).toBe("complete");
    // A subscriber arriving after the end is replayed the run and told it is over.
    const late: string[] = [];
    expect(subscribeToDebate(record, (event) => late.push(event.kind)).terminal).toBe(true);
    expect(late).toEqual(seen.map((event) => event.kind));
  });

  it("resumes a dropped event stream where it left off", async () => {
    const calls = installFakeApi({ dropStreamAfter: 5 });
    const { debate, completion } = await startDebate(RECESS);
    const seen: string[] = [];
    subscribeToDebate(debate, (event) => seen.push(event.kind));
    await completion;

    const streams = calls.filter((call) => call.path.endsWith("/events"));
    expect(streams).toHaveLength(2);
    expect(streams[0].headers.get("last-event-id")).toBeNull();
    expect(streams[1].headers.get("last-event-id")).toBe("0:5");
    expect(seen).toEqual(recordedEvents(RECESS.subject).map((event) => event.kind));
  });

  it("settles on the terminal event without waiting for the API to close the stream", async () => {
    installFakeApi({ holdStreamsOpen: true });
    const { completion } = await startDebate(RECESS);
    await expect(completion).resolves.toMatchObject({ status: "complete" });
  });

  it("stores the API's failure summary, step and model when a run fails", async () => {
    const failure = {
      message: "Structured output validation failed for judge.",
      summary: "openai/gpt-4.1 failed during scorecard judge. The model returned an answer that did not match the required format.",
      step: "scorecard judge",
      model: "openai/gpt-4.1"
    };
    installFakeApi({ failure });
    const { debate, completion } = await startDebate(RECESS);
    const seen: RunLiveEvent[] = [];
    subscribeToDebate(debate, (event) => seen.push(event));

    await expect(completion).rejects.toThrow(failure.message);
    expect(seen.at(-1)).toEqual({ kind: "error", message: failure.summary });
    expect(await getDebate(debate.id)).toMatchObject({
      status: "failed",
      failureReason: failure.summary,
      failedStep: "scorecard judge",
      failedModel: "openai/gpt-4.1"
    });
  });

  it("fails a run the API no longer knows instead of leaving it queued forever", async () => {
    installFakeApi({ loseJobs: true });
    const { debate, completion } = await startDebate(RECESS);

    await expect(completion).rejects.toThrow();
    const stored = await getDebate(debate.id);
    expect(stored?.status).toBe("failed");
    expect(stored?.failureReason).toContain("interrupted");
  });

  it("picks up an unfinished run another server instance started", async () => {
    installFakeApi();
    const { debate } = await startDebate(RECESS);
    // A second instance shares the stored record but has never followed the job.
    vi.resetModules();
    const elsewhere = await import("@/server/debate-store");
    const seen: string[] = [];
    const { terminal } = elsewhere.subscribeToDebate(debate, (event) => seen.push(event.kind));

    expect(terminal).toBe(false);
    await vi.waitFor(() => expect(seen.at(-1)).toBe("complete"));
    expect(seen).toEqual(recordedEvents(RECESS.subject).map((event) => event.kind));
  });
});

describe("the run routes", () => {
  it("returns the API's validation message for a request that breaks the contract", async () => {
    installFakeApi();
    const response = await startRun(post({ subject: "No" }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: "Invalid debate request.",
      issues: [{ path: ["subject"], message: "Enter at least a short subject." }]
    });
    await expect(startDebate({ subject: "No" })).rejects.toBeInstanceOf(PolyviseApiError);
  });

  it("starts a run and answers 202 with the queued record", async () => {
    installFakeApi();
    const response = await startRun(post(RECESS));
    expect(response.status).toBe(202);
    const { debate } = await response.json();
    expect(debate).toMatchObject({ status: "queued", subject: RECESS.subject, mode: "hybrid_council" });
  });

  it("hides engine outages behind a message the visitor can act on", async () => {
    installFakeApi({ routes: { "/v1/records": Response.json({ error: "A valid API key is required." }, { status: 401 }) } });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const response = await startRun(post(RECESS));
    expect(response.status).toBe(502);
    expect((await response.json()).error).not.toContain("API key");
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});

describe("follow-ups", () => {
  async function finishedRun(options: Parameters<typeof installFakeApi>[0] = {}) {
    const calls = installFakeApi(options);
    const { completion } = await startDebate(RECESS);
    return { calls, record: await completion };
  }

  it("stores the API's answer, offering this app's own answer as the fallback", async () => {
    const { calls, record } = await finishedRun({
      routes: { "/v1/followups": { answer: "It depends on supervision.", generated: true } }
    });
    const followup = await addFollowup(record.id, "  What are the risks?  ");

    expect(followup).toMatchObject({ question: "What are the risks?", answer: "It depends on supervision." });
    const sent = calls.find((call) => call.path === "/v1/followups")!.body;
    expect(sent.question).toBe("What are the risks?");
    expect(sent.fallbackAnswer).toContain("The main downside is");
    expect(sent.provider.promptPolicy).toEqual(polyvisePromptPolicy);
    expect((await getDebate(record.id))?.followups).toHaveLength(1);
  });

  it("answers from the run record when the API cannot be reached", async () => {
    const { record } = await finishedRun({
      routes: { "/v1/followups": Response.json({ error: "unavailable" }, { status: 503 }) }
    });
    const followup = await addFollowup(record.id, "What would change your mind?");
    expect(followup?.answer).toContain("The clearest mind-changers are");
  });

  it("rejects a question the API's contract rejects, and an unknown run", async () => {
    const { record } = await finishedRun({
      routes: {
        "/v1/followups": Response.json(
          { error: "Invalid request.", issues: [{ path: ["question"], message: "String should have at least 4 characters" }] },
          { status: 422 }
        )
      }
    });
    const context = (id: string) => ({ params: Promise.resolve({ id }) });
    const invalid = await askFollowup(post({ question: "?" }), context(record.id));
    expect(invalid.status).toBe(400);
    expect((await invalid.json()).issues[0].message).toContain("at least 4 characters");
    expect((await askFollowup(post({ question: "What next?" }), context("debate_missing"))).status).toBe(404);
  });
});

describe("the model catalog and lab", () => {
  it("serves the API's catalog and version, with this app's supplemental models", async () => {
    installFakeApi();
    const info = await (await engineInfo()).json();
    expect(info.version).toBe(fixtures.apiVersion);
    const ids = info.models.map((model: { id: string }) => model.id);
    expect(ids).toEqual(expect.arrayContaining(fixtures.models.map((model) => model.id)));
    expect(ids).toContain("openai/gpt-5.6-terra");
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("asks only models OpenRouter can serve, through the API", async () => {
    const calls = installFakeApi({
      routes: {
        "/v1/config": { providers: { openrouter: true, tavily: true, brave: false }, config: { enableMockLlm: false } },
        "/v1/lab": (body: { models: string[] }) => ({
          answers: body.models.map((model) => ({ model, answer: "Yes.", latencyMs: 12 }))
        })
      }
    });
    const fake = globalThis.fetch;
    vi.stubGlobal("fetch", (input: string | URL, init?: RequestInit) =>
      String(input).startsWith(FAKE_API_URL)
        ? fake(input, init)
        : Promise.resolve(
            Response.json({ data: [{ id: "openai/gpt-4.1", supported_parameters: ["structured_outputs"] }] })
          )
    );

    expect(await runModelLab("Is recess useful?", ["openai/gpt-4.1", "openai/gpt-4.1"])).toEqual([
      { model: "openai/gpt-4.1", answer: "Yes.", latencyMs: 12 }
    ]);
    expect(calls.find((call) => call.path === "/v1/lab")!.body).toEqual({
      prompt: "Is recess useful?",
      models: ["openai/gpt-4.1"]
    });
    await expect(runModelLab("Is recess useful?", ["openai/gpt-5.5"])).rejects.toThrow("unavailable through OpenRouter");
  });
});

it("parses server-sent events across chunk boundaries, ignoring keep-alives", async () => {
  const encoder = new TextEncoder();
  const chunks = [": ping\n\nid: 0:1\nevent: stage\nda", 'ta: {"kind":"stage"}\n\n', "event: closed\r\ndata: {}\r\n\r\n", "data: not json\n\n"];
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    }
  });
  const events = [];
  for await (const event of parseEventStream(body)) events.push(event);
  expect(events).toEqual([
    { id: "0:1", name: "stage", data: { kind: "stage" } },
    { id: undefined, name: "closed", data: {} }
  ]);
});
