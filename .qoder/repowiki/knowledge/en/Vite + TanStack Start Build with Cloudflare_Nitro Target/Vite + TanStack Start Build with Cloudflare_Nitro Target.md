---
kind: build_system
name: Vite + TanStack Start Build with Cloudflare/Nitro Target
category: build_system
scope:
    - '**'
source_files:
    - package.json
    - vite.config.ts
    - bunfig.toml
    - .wrangler/deploy/config.json
    - src/server.ts
---

## Build System Overview

This project uses **Vite** as the build tool, configured through **TanStack Start** and a Lovable-provided Vite plugin (`@lovable.dev/vite-tanstack-config`). The server is built via **Nitro** (bundled with TanStack Start) targeting **Cloudflare Workers**, with deployment configuration managed by **Wrangler**.

## Key Files and Packages

- `package.json` — Defines scripts (`dev`, `build`, `build:dev`, `preview`, `lint`, `format`) and pins all runtime/dev dependencies. Uses ESM (`"type": "module"`) and marks sideEffects off for tree-shaking.
- `vite.config.ts` — Thin wrapper around `defineConfig` from `@lovable.dev/vite-tanstack-config`. It only overrides the TanStack Start server entry to point at `src/server.ts` (the SSR error wrapper). All other plugins (TanStack devtools, `tanstackStart`, `viteReact`, Tailwind, TypeScript path aliases, Nitro, env injection, React/TanStack dedupe, error logger, sandbox detection) are auto-injected by the Lovable config plugin.
- `bunfig.toml` — Configures Bun as the package manager with a supply-chain guard: `minimumReleaseAge = 86400` (24 hours), with explicit excludes for Lovable packages that may publish frequently during development.
- `.wrangler/deploy/config.json` — Points Wrangler to the generated server config at `.output/server/wrangler.json`, which is produced by the Nitro build step.
- `tsconfig.json` — TypeScript configuration used by both Vite and the Nitro server build.
- `eslint.config.js`, `.prettierrc`, `.prettierignore` — Code quality tooling invoked via npm scripts.

## Architecture and Conventions

### Build Pipeline
1. **Development**: `npm run dev` runs `vite dev`, which boots the TanStack Start dev server with HMR, React devtools, and the Nitro server in dev mode.
2. **Production Build**: `npm run build` runs `vite build`, which invokes the TanStack Start/Vite pipeline that internally triggers Nitro to bundle the server into `.output/server/`. The resulting output includes a `wrangler.json` describing the Cloudflare Worker.
3. **Preview**: `npm run preview` serves the built assets locally for verification.
4. **Deployment**: Wrangler reads the generated `.output/server/wrangler.json` (via `.wrangler/deploy/config.json`) to deploy the built server artifact to Cloudflare Workers.

### Server Entry Convention
The server entry is explicitly set to `server` (resolving to `src/server.ts`), which wraps TanStack Start's default server entry to provide centralized SSR error handling. This is the single entrypoint that Nitro builds into the Cloudflare Worker.

### Environment Handling
Environment variables prefixed with `VITE_` are injected into the client bundle at build time (handled automatically by the Lovable config plugin). Server-side environment variables are consumed directly by the Nitro-built server code.

### Package Manager and Lockfile
Bun is used as the package manager (evidenced by `bun.lock` and `bunfig.toml`), though `package-lock.json` is also present. The lockfile is saved as text (`saveTextLockfile = true`) for version control.

## Conventions and Constraints

- **Do not manually add Vite plugins** — `vite.config.ts` contains an explicit comment stating that the Lovable config already includes all necessary plugins and adding more would cause duplicates and break the app.
- **Supply-chain protection** — `bunfig.toml` enforces a 24-hour minimum release age for all packages to prevent accidental use of freshly published/unvetted versions, with explicit exceptions listed for Lovable internal packages.
- **Server entry must be `src/server.ts`** — The TanStack Start server entry is pinned to this file; changing it requires updating `vite.config.ts`.
- **No Makefiles, Dockerfiles, or CI pipelines** — There are no `Makefile`, `Dockerfile`, `docker-compose.yml`, or GitHub Actions workflows in the repository. Deployment appears to be driven by Wrangler against the `.output/server/` artifact produced by `vite build`.
- **Build modes** — Two build scripts exist: `build` (production) and `build:dev` (development mode via `--mode development`), allowing different behavior between environments.