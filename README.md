# polyvise.ai

This repository contains the Polyvise website and professional debate workspace served at `polyvise.ai`.

It consumes the framework-neutral [`@polyvise/core`](https://github.com/polyvise/polyvise-core) package and owns its own Next.js routes, persistence adapters, UI, operations, and deployment configuration.

## Run locally

```bash
npm ci
npm run dev
```

Open `http://localhost:3000`.

For live provider keys, create an ignored `local.secrets.env` file and run `./scripts/dev.sh`.

## Verify

```bash
npm run verify
```

The final pre-split monorepo is preserved in `polyvise/polyvise-core` under the `monolith-final-2026-07-23` tag.

## LLM calls and recovery

Polyvise Core owns provider retries, structured-output repair, and resumable execution in all three modes. This app owns professional response guidance, the retry interface, private checkpoint storage, and atomic worker claims. See [AGENTS.md](AGENTS.md) before choosing where a change belongs.

Each model step has a shared budget of at most three HTTP calls, including transport retries, schema-format fallback, and validation repair. Calls time out after at most 45 seconds. Retries use a bounded delay; permanent provider errors stop immediately. Output room grows only when a response is truncated. Output repair includes the rejected response and validation errors, and telemetry retains usage across attempts. Presentation length remains prompt guidance; schema validation still checks required fields, types, ranges, and enums.

**Retry failed step** keeps the same question, models, sources, and completed work. Checkpoints stay on the server. Conditional writes and attempt-scoped streams prevent duplicate workers and old failures from contaminating a resumed run. Browser reads have timeouts, saved-progress polling, and a five-minute idle deadline. Older runs without checkpoints cannot resume.

Cloud Run uses `--no-cpu-throttling` because work continues after the initial HTTP response and the event stream may connect to another instance. This uses instance-based billing while an instance runs; minimum instances remain zero. Checkpoints allow recovery after an instance is interrupted. The previous postinstall Core patch has been removed in favor of upstream source changes.
