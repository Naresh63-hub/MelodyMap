---
kind: external_dependency
name: Supabase (PostgreSQL + Auth + RLS)
slug: supabase
category: external_dependency
category_hints:
    - vendor_identity
    - auth_protocol
scope:
    - '**'
---

### Supabase
- Role: Optional cloud backend for authenticated users — stores `profiles` and a single `user_library` JSONB row per user; Row Level Security restricts access to the current user's row.
- Integration: `@supabase/supabase-js` client is created in `src/integrations/supabase/client.ts`; it reads `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` from env and injects the key via an `apikey` header (new-style opaque keys are supported).
- Auth: Email/password plus Google OAuth handled by Supabase Auth; session persisted in `localStorage` with auto-refresh tokens.
- Migration files live under `supabase/migrations/`; project id is set in `supabase/config.toml`.
- Client code uses Supabase only when a user is signed in; the app otherwise runs fully local-first (localStorage/IndexedDB).