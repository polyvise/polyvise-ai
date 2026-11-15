// Records the Polyvise API responses the tests replay (tests/fixtures/polyvise-api.json).
//
// Run it against a local polyvise-api in its default mock mode, so the runs are
// deterministic templates rather than paid model calls:
//
//   (cd ../polyvise-api && uv run uvicorn polyvise_api.main:app --port 8000)
//   node scripts/record-api-fixtures.mjs
//
// Re-record whenever the API's contracts or the scenarios below change.
import { writeFile } from "node:fs/promises";

const api = (process.env.POLYVISE_API_URL ?? "http://localhost:8000").replace(/\/+$/, "");
const key = process.env.POLYVISE_API_KEY;

/** Every run a test starts. A test asking for anything else fails loudly in the fake API. */
const scenarios = [
  { subject: "Should schools have longer recess?" },
  { subject: "Should we migrate our database?" },
  { subject: "Should we move billing off a single vendor?", mode: "consensus", consensus: { agentCount: 3, rounds: 2 } },
  { subject: "Should we move billing off a single vendor?", mode: "advisory_panel" },
  ...["hybrid_council", "consensus", "advisory_panel"].map((mode) => ({
    subject: "Should our team move to a four-day workweek?",
    context: "Keep weekday support coverage.",
    mode
  }))
];

/** Mode and debate size pairs whose model routing the composer's controls must match. */
const routingCases = [
  ["hybrid_council", "duo"],
  ["hybrid_council", "quartet"],
  ["consensus", "quartet"],
  ["advisory_panel", "quartet"]
];

async function call(path, body) {
  const response = await fetch(`${api}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(key ? { Authorization: `Bearer ${key}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} answered ${response.status}: ${await response.text()}`);
  return response;
}

const json = async (path, body) => (await call(path, body)).json();

async function runJob(input) {
  const { record, request } = await json("/v1/records", input);
  await json("/v1/jobs", { request, debateId: record.id });
  // Reading the stream to its end is also how we wait for the job to finish.
  const events = await (await call(`/v1/jobs/${record.id}/events`)).text();
  const job = await json(`/v1/jobs/${record.id}`);
  if (job.status !== "complete") throw new Error(`${JSON.stringify(input)} ended ${job.status}`);
  return { input, record, request, events, job };
}

const health = await json("/health");
if (!health.mockLlm) throw new Error("Record against an API in mock mode (POLYVISE_ENABLE_MOCK_LLM=true).");

const runs = [];
for (const scenario of scenarios) {
  runs.push(await runJob(scenario));
}

const routing = [];
for (const [mode, councilSize] of routingCases) {
  const { job } = await runJob({ subject: "Should our team migrate our database?", mode, councilSize });
  // The roster entries describe slots; the template entries are the calls the engine made.
  const roles = job.run.modelSnapshots
    .filter((snapshot) => snapshot.model === "deterministic-template")
    .map((snapshot) => snapshot.role);
  const { routes } = await json("/v1/routing", { roles });
  routing.push({ mode, councilSize, slots: [...new Set(routes.map((route) => route.slot))].sort() });
}

const { models } = await json("/v1/models");
const fixtures = { apiVersion: health.version, models, routing, runs };
await writeFile(new URL("../tests/fixtures/polyvise-api.json", import.meta.url), `${JSON.stringify(fixtures)}\n`);
console.log(`Recorded ${runs.length} runs and ${routing.length} routing cases from polyvise-api ${health.version}.`);
