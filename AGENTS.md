<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Shared-library ownership

Before changing run execution, LLM call handling, structured-output validation, or retry behavior, inspect the corresponding `polyvise/polyvise-core` implementation. Put reusable behavior in Core; keep UI, professional writing guidance, routes, storage, rate limits, and deployment in this app. Do not patch installed `node_modules` or copy a second generic engine into the app. Record any necessary workaround and the intended upstream fix.

Run `npm run verify` for code changes. Test failed-stage resumption in debate, consensus, and advisory-panel modes when changing execution or recovery.
