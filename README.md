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
