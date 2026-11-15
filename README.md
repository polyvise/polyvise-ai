# polyvise.ai

This repository contains the Polyvise AI website and professional debate workspace served at `polyvise.ai`.

It is a client of the [Polyvise API](https://github.com/polyvise/polyvise-api), which runs every debate, consensus and advisory run, the model lab and follow-ups. This repository owns the Next.js routes, persistence adapters, UI, operations, and deployment configuration; it makes no model calls of its own.

## How it talks to the API

| This app | Polyvise API |
| --- | --- |
| Start a run (`POST /api/debates`) | `POST /v1/records` for the queued record, then `POST /v1/jobs` |
| Live run events (`GET /api/debates/{id}/events`) | `GET /v1/jobs/{id}/events`, resumed with `Last-Event-ID` if the connection drops |
| Storing the result or failure | `GET /v1/jobs/{id}` once the job ends |
| Follow-up questions | `POST /v1/followups` |
| Model lab | `POST /v1/lab`, `GET /v1/config` |
| Model pickers and footer version (`GET /api/engine`) | `GET /v1/models`, `GET /health` |

`src/server/polyvise-api.ts` is the only module that calls the API; `src/lib/polyvise-api/types.ts` holds its wire contracts. Product wording is sent with each run as a prompt policy (`src/server/prompt-policy.ts`).

Configuration:

- `POLYVISE_API_URL` — defaults to `https://api.polyvise.ai`.
- `POLYVISE_API_KEY` — sent as a bearer token; required by the hosted API. In production it is the `polyvise-api-key-polyvise-ai` secret.

Models, evidence providers, timeouts and provider keys are configured on the API, not here.

## Run locally

Start the API in another terminal. With no keys it answers from deterministic templates, so nothing is billed:

```bash
cd ../polyvise-api && uv run uvicorn polyvise_api.main:app --port 8000
```

Then:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000`.

To use the hosted API instead, put `POLYVISE_API_URL` and `POLYVISE_API_KEY` in an ignored `local.secrets.env` file and run `./scripts/dev.sh`.

## Tests

Tests replay API responses recorded in `tests/fixtures/polyvise-api.json`, so they need no network. Re-record them against a local API after its contracts change:

```bash
node scripts/record-api-fixtures.mjs
```

## Verify

```bash
npm run verify
```

The final pre-split monorepo is preserved in `polyvise/polyvise-core` under the `monolith-final-2026-07-23` tag.
