---
kind: business_term
name: Business Glossary
category: business_term
scope:
    - '**'
---

### MelodyMap
- Definition：The name of this AI-powered music streaming application, which streams from YouTube (primary) and Deezer (preview fallback), supports offline downloads, and persists user libraries locally with optional Supabase sync.

### Mix types
- Definition：Five personalized recommendation categories generated via the Lovable AI gateway: Discover Mix (new artists based on taste), New Release Mix (fresh drops from favorites), Replay Mix (songs played repeatedly), New Songs (trending tracks), and Podcasts (audio-only episodes).

### Recommendation Settings
- Definition：Granular user controls that shape AI mix generation, including mood, genre, language, energy level, discovery vs. familiarity balance, and instrumental filtering.

### Local-first
- Definition：App mode where library, playlists, history, and settings persist in localStorage/IndexedDB without requiring an account; Supabase sync activates only after sign-in.

### Stream proxy
- Definition：Server-side `/api/stream/:videoId` endpoint that resolves and proxies YouTube's direct audio URLs to handle CORS and throttling, allowing playback in a plain `<audio>` element without ads.

### Debounced cloud sync
- Definition：Pattern where local library mutations are batched and written to Supabase with debouncing to avoid excessive writes, keeping client state authoritative until the server confirms.

### Session persistence
- Definition：Playback queue and position are saved to localStorage so they survive app reloads and browser restarts.
