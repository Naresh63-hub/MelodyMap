---
kind: configuration_system
name: Environment-Driven Configuration via Vite + Supabase Client
category: configuration_system
scope:
    - '**'
source_files:
    - .env.example
    - src/integrations/supabase/client.ts
    - src/lib/music.functions.ts
    - vite.config.ts
    - src/server.ts
    - src/start.ts
    - bunfig.toml
    - supabase/config.toml
---

## What system/approach is used

Configuration is **environment-variable driven** with no dedicated config loader library. The project uses:

- **Vite build-time env injection** (`import.meta.env.*`) for values exposed to the browser, gated by the `VITE_` prefix convention.
- **Node `process.env`** for server-side-only secrets (e.g. `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`).
- A **generated Supabase client** that reads both sources and falls back from client to server at runtime.
- `.env.example` as the single source of truth for required variables; `.env` is gitignored.
- `bunfig.toml` for Bun runtime/dependency policy (minimum release age).
- `supabase/config.toml` for the Supabase project ID.
- `vite.config.ts` delegates most plugin/env wiring to `@lovable.dev/vite-tanstack-config`, which injects `VITE_*` env vars into the browser bundle.

## Key files and packages

- `.env.example` — declares all required environment variables and their purpose.
- `src/integrations/supabase/client.ts` — generated client that resolves `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` from `import.meta.env['VITE_SUPABASE_*']` (client) falling back to `process.env['SUPABASE_*']` (SSR), validates presence, and constructs the Supabase client with a custom fetch wrapper that normalizes new-style API keys.
- `src/lib/music.functions.ts` — reads `LOVABLE_API_KEY` from `process.env` to call the AI gateway.
- `vite.config.ts` — minimal entry pointing TanStack Start's Nitro server to `src/server.ts`; env injection is handled by the Lovable config plugin.
- `src/server.ts` — Nitro server entry that proxies audio streams; does not read env directly but relies on the runtime env being present for downstream code.
- `src/start.ts` — registers request/function middleware (CSRF, error handling, Supabase auth attacher); configuration is implicit via middleware composition.
- `bunfig.toml` — enforces a 24-hour minimum package release age to guard against supply-chain risk.
- `supabase/config.toml` — pins the Supabase project ID.

## Architecture and conventions

1. **Client vs. server env split**: Variables prefixed `VITE_` are baked into the browser bundle at build time; non-prefixed variables are only available in server code (`process.env`). The Supabase client explicitly tries `import.meta.env['VITE_SUPABASE_*']` first, then `process.env['SUPABASE_*']`, so the same module works in both contexts.
2. **No service role key in the browser**: `.env.example` comments explicitly state that `SUPABASE_SERVICE_ROLE_KEY` must never be exposed to the browser — only `SUPABASE_PUBLISHABLE_KEY` is prefixed `VITE_`.
3. **Missing env fails fast**: If either `SUPABASE_URL` or `SUPABASE_PUBLISHABLE_KEY` is absent, the Supabase client throws an error listing the missing variables, rather than silently degrading.
4. **Single source of env docs**: `.env.example` is the canonical reference for what variables exist and where to obtain them (Supabase project settings, Lovable Cloud Secrets). It is copied to `.env` locally and never committed.
5. **AI key via Lovable Cloud**: `LOVABLE_API_KEY` is documented as auto-injected by Lovable Cloud and read only on the server side inside server functions.
6. **Bun supply-chain policy**: `bunfig.toml` sets `minimumReleaseAge = 86400` (24 hours) globally, with explicit excludes for Lovable-owned packages that may publish frequently during development.
7. **Supabase project pinning**: `supabase/config.toml` hardcodes the project ID, tying migrations and local tooling to one Supabase project.

## Conventions and constraints

- **Variables must be declared in `.env.example`** before use — it documents every required variable and its origin.
- **Never commit `.env`** — enforced by `.gitignore` and the comment in `.env.example`.
- **Only publishable keys go to the browser** — the `VITE_` prefix is the gate; `SUPABASE_SERVICE_ROLE_KEY` has no `VITE_` variant and is server-only.
- **Runtime validation is mandatory** — the Supabase client throws when required env vars are missing, making misconfiguration a hard failure rather than a silent bug.
- **Server functions access secrets via `process.env`** — e.g. `music.functions.ts` reads `LOVABLE_API_KEY` this way.
- **TanStack Start/Nitro server entry is fixed** to `src/server.ts` via `vite.config.ts`'s `tanstackStart.server.entry`, so any server-side configuration must be reachable from there.