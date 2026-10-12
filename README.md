<div align="center">
  <img src="public/brand/app-icon.png" alt="MelodyMap Logo" width="104" height="104" style="border-radius: 24px;" />
  <h1>MelodyMap</h1>
  <p><strong>Your Music. Your Mood. Your Map.</strong></p>
  <p>A local-first, multi-source music &amp; podcast streaming Progressive Web App and native Android (Capacitor) client — with an adaptive recommender, studio-grade Web Audio processing, a resilient dual-engine playback system, and Spotify-style background audio.</p>

  <p>
    <a href="https://melodymap-pi.vercel.app" target="_blank">
      <img src="https://img.shields.io/badge/Live-melodymap--pi.vercel.app-7c3aed?style=for-the-badge&logo=vercel" alt="Live Demo" />
    </a>
  </p>

  <p>
    <img src="https://img.shields.io/badge/Version-1.3.4-1DB954?style=flat-square" alt="Version 1.3.4" />
    <img src="https://img.shields.io/badge/Unit_Tests-346_Passed-brightgreen?style=flat-square&logo=vitest" alt="Vitest 346 Passed" />
    <img src="https://img.shields.io/badge/E2E-6_Passed-brightgreen?style=flat-square&logo=playwright" alt="Playwright E2E 6 Passed" />
    <img src="https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react" alt="React 19" />
    <img src="https://img.shields.io/badge/TanStack-Start-ff4154?style=flat-square" alt="TanStack Start" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript" alt="TypeScript 5.8" />
    <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4" />
    <img src="https://img.shields.io/badge/Capacitor-8%20(Android%20SDK%2036)-blue?style=flat-square&logo=capacitor" alt="Capacitor Android" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>
</div>

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Key Features](#2-key-features)
3. [Playback Engines (how audio works)](#3-playback-engines-how-audio-works)
4. [Technology Stack](#4-technology-stack)
5. [Architecture Overview](#5-architecture-overview)
6. [Music Providers](#6-music-providers)
7. [Project Structure](#7-project-structure)
8. [Prerequisites](#8-prerequisites)
9. [Local Installation](#9-local-installation)
10. [Environment Variables](#10-environment-variables)
11. [Development Commands](#11-development-commands)
12. [Testing & CI](#12-testing--ci)
13. [Web Production Build & Vercel Deploy](#13-web-production-build--vercel-deploy)
14. [Android APK Build](#14-android-apk-build)
15. [Capacitor Configuration](#15-capacitor-configuration)
16. [Background Playback & MediaSession](#16-background-playback--mediasession)
17. [APK Notes & Server Constraints](#17-apk-notes--server-constraints)
18. [Data, Auth & Sync (Supabase)](#18-data-auth--sync-supabase)
19. [Security](#19-security)
20. [Keyboard Shortcuts](#20-keyboard-shortcuts)
21. [Known Limitations](#21-known-limitations)
22. [License & Legal](#22-license--legal)

---

## 1. Project Overview

**MelodyMap** is a high-performance, local-first streaming platform delivered as both a **Progressive Web App** and a **native Android app** (Capacitor). It aggregates multiple legal music catalogs behind a single player and adds an adaptive recommendation layer on top.

Highlights:

1. **Adaptive discovery** — a Contextual Linear Thompson Sampling (LinTS) multi-armed bandit that updates online from skips, completions, likes, time-of-day, and session momentum, plus an optional AI reasoning gateway.
2. **Dual-engine playback** — a resilient client YouTube player and an HTML5/proxy path, with automatic fallback when an embed is blocked or a stream stalls.
3. **Studio-grade Web Audio** — 10-band parametric equalizer, loudness-normalizing compressor, and equal-power crossfading.
4. **Spotify-style native background** — foreground `MediaPlaybackService`, wake/Wi-Fi locks, `MediaSession`, lock-screen/notification + headset controls, and a hardware sleep-timer.
5. **Local-first** — library, playlists, and audio cache in IndexedDB; optional cross-device sync via Supabase.

---

## 2. Key Features

- 🎵 **Full player UI** — docked mini-player, immersive full-screen view, scrub preview, volume, and speed control (0.25×–3.0×).
- 🌐 **Multi-catalog search** — debounced, aggregated, and de-duplicated across the configured providers (see [Providers](#6-music-providers)).
- 🧠 **Contextual AI discovery** — LinTS bandit scoring updated in real time after every interaction.
- 🎚️ **10-band equalizer** — biquad filters from 32 Hz to 16 kHz with presets (Bass Boost, Vocal, Rock, Acoustic, Flat) and custom curves.
- 🔀 **Crossfade & quality** — equal-power crossfade (default 3 s) and `saver`/`standard`/`high` stream quality.
- 🌙 **Sleep timer** — native Android exact-alarm bridge that stops playback and releases locks even in deep sleep.
- ⏭️ **SponsorBlock auto-skip** — configurable skipping of intros, sponsor segments, and outros.
- 📝 **Synced lyrics** — time-aligned lyrics via LRCLIB.
- 📲 **Background playback** — real screen-off / lock-screen playback for direct-source tracks via a foreground service.
- 💾 **Offline & local-first** — IndexedDB library, playlists, and cached audio.
- 🛡️ **Security-hardened** — strict video-ID validation, SSRF-safe upstream allowlist, per-IP rate limiting, server-scoped secrets, and CodeQL-clean streaming.

---

## 3. Playback Engines (how audio works)

MelodyMap chooses a playback engine per environment (see `src/lib/native-playback.ts` → `resolvePlaybackEngine`) and per track. There are **two engines**, and **only one is ever active at a time**:

| Engine | Mechanism | Used for | Background / screen-off |
| :--- | :--- | :--- | :---: |
| **`youtube`** | Client-side YouTube IFrame player | Deployed **web** and the **native APK** for YouTube-catalog tracks | ❌ pauses when hidden/locked |
| **`html5`** | Native `<audio>` element via the `/api/stream` proxy **or** a direct provider URL | Localhost/dev, and **all direct-source tracks** (`saavn`, `audius`, `jamendo`, `archive`, `podcast`) and offline cache | ✅ continues (native service keeps it alive) |

How a track is routed (`use-audio-player.ts` → `load`):

1. **Offline cache** → HTML5 (background-safe).
2. **Direct full-length source** (`saavn:` / `audius:` / `jamendo:` / `archive:` / `podcast:` — see `track-stream-policy.ts`) → HTML5 `<audio>` playing the provider URL directly. **These play in the background.**
3. **Everything else** → the engine chosen by `resolvePlaybackEngine`:
   - `youtube` (deployed web & APK): plays through the IFrame — reliable, no server needed, but pauses when the screen locks.
   - `html5` (localhost/dev): streams through the `/api/stream` proxy (yt-dlp → InnerTube → provider fallback).

If a YouTube embed is blocked (player error 100/101/150/2), the client **falls back to the HTML5 proxy** automatically.

> **Why this matters for the APK:** the app's catalog is **JioSaavn-first**, and JioSaavn is a direct source — so most songs get true Spotify-style background playback. Only occasional plain-YouTube fallback tracks (IFrame) are foreground-only. See [APK Notes](#17-apk-notes--server-constraints).

---

## 4. Technology Stack

| Tier | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TanStack Start, TanStack Router, TanStack Query |
| **Styling & UI** | Tailwind CSS v4, Radix UI primitives, Lucide icons, CVA, `tw-animate-css` |
| **Audio & DSP** | HTML5 `Audio`, Web Audio API (`AudioContext`, `BiquadFilterNode`, `DynamicsCompressorNode`), Media Session API, YouTube IFrame API |
| **Server & API** | Nitro server engine, TanStack Start server functions, H3, `youtube-dl-exec` / yt-dlp |
| **Mobile runtime** | Capacitor 8.5 — `minSdk 24`, `compileSdk`/`targetSdk 36` |
| **Data & auth** | Supabase (Auth + PostgreSQL), Google Sign-In (web + native 1-tap); local-first IndexedDB |
| **AI & recs** | Contextual Multi-Armed Bandit (Linear Thompson Sampling) + server-side AI gateway |
| **Testing** | Vitest 5 (346 tests / 38 files), Playwright (6 E2E playback scenarios) |
| **CI & security** | GitHub Actions (CI + CodeQL `javascript-typescript`), Dependabot |

---

## 5. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          MelodyMap Client App                              │
│      (React 19 · TanStack Router · Tailwind CSS 4 · Capacitor Native)      │
└───────────────┬───────────────────────────────────────┬──────────────────┘
        Playback & controls                    Telemetry & context
                ▼                                       ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│      useAudioPlayer core      │        │    Contextual LinTS bandit    │
│  - one active engine (XOR)    │        │  - feature extraction         │
│  - Web Audio 10-band EQ       │        │  - Cholesky posterior sample  │
│  - equal-power crossfade      │        │  - online Bayesian update     │
│  - Media Session lock screen  │        │  - feed freshness & dedup     │
└───────────────┬───────────────┘        └───────────────┬───────────────┘
        Audio streams                          Candidate scoring
                ▼                                       ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│   Dual-engine stream path     │        │     Multi-provider catalogs   │
│  - yt-dlp (where available)   │        │  - JioSaavn (primary, direct) │
│  - pure-TS InnerTube fallback │        │  - Audius / Jamendo / Archive │
│  - /api/stream byte-range     │        │  - Deezer (metadata/ISRC)     │
│  - LRCLIB synced lyrics       │        │  - MusicBrainz (metadata)     │
└───────────────────────────────┘        └───────────────────────────────┘
```

---

## 6. Music Providers

Capabilities are declared in `src/lib/providers/registry.ts`.

| Provider | Discover | Metadata | Full playback | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **JioSaavn** | ✅ | ✅ | ✅ | Primary catalog; HD 320 kbps, direct CDN audio (background-safe). |
| **Audius** | ✅ | ✅ | ✅ | Decentralized / artist-uploaded, authorized full streams. |
| **Jamendo** | ✅ | ✅ | ✅ | Creative-Commons independent catalog, full MP3. |
| **Internet Archive** | ✅ | ✅ | ✅ | Public-domain & Live Music Archive recordings. |
| **Deezer** | ✅ | ✅ | ❌ | ISRC + rich metadata + album art (playback disabled for full-length policy). |
| **MusicBrainz** | ❌ | ✅ | ❌ | Authoritative recording IDs / relationships. |
| **ListenBrainz** | ❌ | ✅ | ❌ | Community listening insights. |

---

## 7. Project Structure

```
MelodyMap/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                 # CI: test → typecheck → build → Playwright E2E
│   │   └── codeql.yml             # CodeQL security analysis (javascript-typescript)
│   └── dependabot.yml
├── android/                       # Capacitor native Android Gradle project
│   └── app/src/main/
│       ├── AndroidManifest.xml    # mediaPlayback foreground service + WAKE_LOCK, etc.
│       └── java/com/melodymap/music/
│           ├── MainActivity.java              # WebView onResume/resumeTimers background tricks
│           ├── MediaPlaybackService.java      # Foreground media service (wake/wifi locks, MediaSession)
│           ├── PlaybackBridge.java            # JS ↔ service bridge (window.AndroidPlayback)
│           ├── GoogleAuthBridge.java          # Native 1-tap Google sign-in
│           ├── SleepTimerBridge.java          # Exact-alarm sleep timer
│           └── SleepTimerReceiver.java        # Releases locks & stops audio on expiry
├── server/routes/api/stream/      # Production /api/stream Nitro route (byte-range proxy)
├── public/                        # PWA manifest, icons, brand assets, service worker
├── e2e/playback.spec.ts           # Playwright E2E playback suite (6 scenarios)
├── src/
│   ├── components/                # music/ (player, equalizer, queue, cards, panels), ui/ (primitives)
│   ├── hooks/                     # use-keyboard-shortcuts, useSleepTimer
│   ├── lib/
│   │   ├── native-playback.ts     # resolvePlaybackEngine + native bridge calls
│   │   ├── use-audio-player.ts    # Audio engine (single-track, Web Audio EQ, crossfade, reconnect)
│   │   ├── use-media-session.ts   # Media Session metadata & hardware control handlers
│   │   ├── stream.server.ts       # yt-dlp + InnerTube + provider stream resolver (LRU cache)
│   │   ├── stream-proxy-core.ts   # Shared SSRF/origin/rate-limit/byte-range proxy core
│   │   ├── track-stream-policy.ts # Which tracks use a direct URL vs the proxy
│   │   ├── bandit-policy.ts       # Contextual LinTS recommender
│   │   ├── context-engine.ts      # Recommendation feature/context extraction
│   │   ├── equalizer.ts           # 10-band EQ presets, crossfade, quality
│   │   ├── ai-gateway.server.ts   # Server-side AI reasoning gateway
│   │   ├── auth.ts / supabase.ts  # Supabase auth & client
│   │   ├── offline.ts             # IndexedDB offline library & cache
│   │   └── providers/             # saavn, audius, jamendo, deezer, archive, musicbrainz, dedup…
│   ├── routes/                    # TanStack file-based routes
│   └── styles.css                 # Tailwind v4 theme + light/dark token swaps
├── capacitor.config.ts
├── vite.config.ts                 # Vite + Nitro + stream-proxy dev middleware
└── package.json                   # name: melodymap, version: 1.3.4
```

---

## 8. Prerequisites

- **Node.js** `20.x` or `22.x LTS` (Node 22 recommended — CI uses 22)
- **npm** `10.x+`
- **For the Android APK:** Android Studio (bundles the Android SDK + a compatible JDK). `minSdk 24`, `compileSdk`/`targetSdk 36`.

---

## 9. Local Installation

```bash
git clone https://github.com/Naresh63-hub/MelodyMap.git
cd MelodyMap
npm ci
```

---

## 10. Environment Variables

Copy `.env.example` to `.env` and fill in what you use. The app runs fully in **guest mode** with none configured.

```dotenv
# Optional AI reasoning gateway
AI_API_BASE_URL=
AI_API_KEY=
AI_MODEL=

# Supabase (auth + cross-device sync). Leave blank for guest-only / local use.
VITE_GOOGLE_CLIENT_ID=
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SUPABASE_PUBLISHABLE_KEY=

# Optional YouTube data API key
YOUTUBE_API_KEY=

# Optional: path to a pre-installed yt-dlp binary (server stream resolver).
# When unset, the resolver uses the bundled/system binary or falls back to pure-TS InnerTube.
# YOUTUBE_DL_PATH=/usr/local/bin/yt-dlp
```

> Supabase **service-role** keys (if used) must be configured **server-side only** and never prefixed with `VITE_` (which exposes them to the client).

---

## 11. Development Commands

```bash
npm run dev            # Vite dev server (yt-dlp-backed stream proxy) → http://localhost:3000
npm run build          # Production build (client + Nitro server bundle)
npm run preview        # Preview the production build
npm run typecheck      # tsc --noEmit (strict)
npm run lint           # ESLint
npm test               # Vitest unit + integration suite
npm run test:e2e       # Playwright E2E playback suite
npm run android:build  # cap sync android + gradlew assembleDebug
npm run android:open   # Open the Android project in Android Studio
```

---

## 12. Testing & CI

- **Unit / integration:** `npm test` → **346 tests across 38 files** (Vitest).
- **Type safety:** `npm run typecheck` (TypeScript strict, `tsc --noEmit`).
- **E2E:** `npm run test:e2e` → **6 Playwright playback scenarios** (single-track guarantee, seek, next/prev, auto-advance, one-active-source).
- **CI** (`.github/workflows/ci.yml`, Node 22): `verify` job runs test → typecheck → build; the `e2e` job installs Chromium and runs the Playwright suite.
- **Security scanning** (`.github/workflows/codeql.yml`): CodeQL `javascript-typescript` with `security-extended,security-and-quality` on push/PR and weekly.
- **Dependabot** keeps dependencies patched.

```bash
npm run typecheck && npm test && npm run build
```

---

## 13. Web Production Build & Vercel Deploy

```bash
npm run build
```

When `process.env.VERCEL` is set, Vite configures Nitro with the **`vercel`** preset (otherwise it emits the standalone **node-server** output at `.output/server/index.mjs`).

- **Build command:** `vite build`
- **Framework:** auto-detected (TanStack Start / Nitro). Pushing to `main` triggers a Vercel redeploy.

---

## 14. Android APK Build

```bash
# 1. Build web assets + sync plugins/native project
npm run build
npx cap sync android

# 2a. Debug APK (quick, unsigned)
npm run android:build          # gradlew assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk

# 2b. Signed Release APK (Android Studio or Gradle)
cd android && ./gradlew assembleRelease && cd ..
```

For signing, provide a keystore via `android/key.properties` (see `android/key.properties.example`). Android Studio's **Build ▸ Generate Signed App Bundle/APK** works too.

> **Important:** the APK is configured as a **remote wrapper** (see below) — it loads the deployed site, so ship the web app to Vercel first, then install the APK.

---

## 15. Capacitor Configuration

`capacitor.config.ts` (abridged):

```typescript
const config: CapacitorConfig = {
  appId: "com.melodymap.music",
  appName: "MelodyMap",
  webDir: ".output/public",
  server: {
    url: "https://melodymap-pi.vercel.app", // APK loads the live site
    cleartext: isDev,
  },
  android: {
    allowMixedContent: isDev,
    backgroundColor: "#0a0a0f",
  },
  plugins: {
    // Android 15+ edge-to-edge: insets handled by the built-in SystemBars plugin.
    SystemBars: {
      insetsHandling: "css",
      initialViewportFitValueHint: "cover",
      style: "DARK",
    },
  },
};
```

`server.url` makes the WebView load the **deployed PWA** (so the server API routes like `/api/stream` and auth keep working). To bundle the web build inside the APK instead, remove `server.url` — but then the API routes won't exist, so streaming/auth would break. Keep remote mode.

---

## 16. Background Playback & MediaSession

Native background audio is driven by the **`MediaPlaybackService`** foreground service (not the Activity), so locks and the notification only exist while audio is actually playing.

- **Foreground service** (`android:foregroundServiceType="mediaPlayback"`) with a persistent notification (Prev / Play-Pause / Next).
- **Wake & Wi-Fi locks** — `PARTIAL_WAKE_LOCK` keeps the CPU alive with the screen off; a Wi-Fi lock keeps streaming flowing.
- **Audio focus** — auto-pauses on incoming audio focus loss, ducks under transient focus, resumes afterward, and pauses on headphone unplug (noisy-audio receiver).
- **`MediaSessionCompat`** — lock-screen artwork/metadata + hardware headset / media-key control, mirrored from `src/lib/use-media-session.ts`.
- **WebView keep-alive** — `MainActivity` calls `webView.onResume()` + `resumeTimers()` in `onPause`/`onStop`/`onWindowFocusChanged`, and sets `setMediaPlaybackRequiresUserGesture(false)` for automatic track transitions.
- **Direct hardware audio** — on native, `initWebAudio` intentionally returns early so the `<audio>` element plays straight to hardware (Chromium suspends WebAudio-routed audio on screen lock). This is why **direct-source** tracks survive background playback.
- **Sleep timer** — `SleepTimerBridge` schedules exact Android alarms; on expiry `SleepTimerReceiver` releases the wake lock and cleanly pauses audio.

**Command flow:** lock-screen / notification / headset buttons call into the page via `window.__melodymap_media_command`, and the web player remains the single source of truth for the queue.

---

## 17. APK Notes & Server Constraints

- The APK loads the **live Vercel site**, so front-end changes go live when Vercel redeploys (the installed APK picks them up on next load — no APK rebuild required for pure web changes; a rebuild is only needed when the native Android code changes).
- **YouTube stream resolution on serverless:** the `/api/stream` proxy prefers `yt-dlp` when a binary is present, otherwise pure-TS InnerTube. On **Vercel serverless** there is no `yt-dlp` binary and datacenter IPs are bot-checked by YouTube, so **YouTube proxy streams may fail there**. This is fine for **direct-source** tracks (JioSaavn/Audius/Jamendo/Archive) and for the **client YouTube IFrame** engine, which is why the APK uses the IFrame for YouTube tracks and direct HTML5 for the rest.
- For full YouTube background playback inside the APK, host the same app on a server that can run `yt-dlp` from a non-blocked IP (a VPS/container) and point `server.url` at it.

---

## 18. Data, Auth & Sync (Supabase)

MelodyMap runs **guest-first**: everything works locally via IndexedDB with no account. Signing in enables optional cross-device sync through **Supabase** (Auth + PostgreSQL).

- **`profiles`** — user display info (`displayName`, `email`, `avatarUrl`, timestamps).
- **`user_library`** — favorites / saved tracks for cross-device sync.
- **Google Sign-In** — web OAuth (popup/redirect) and a **native 1-tap** Play Services flow in the APK (`GoogleAuthBridge` → Supabase `signInWithIdToken`).

---

## 19. Security

1. **Stream proxy hardening** (`stream-proxy-core.ts`):
   - Strict video-ID validation (`^[a-zA-Z0-9_-]{1,32}$`).
   - **SSRF guard** — upstream hosts restricted to an allowlist (Google/YouTube/Audius/Jamendo CDNs), HTTPS only.
   - **Origin allowlist** + **per-IP rate limiting** on `/api/stream`.
   - Byte-range responses clamped to bounded chunks for serverless-safe streaming.
2. **No dynamic binary downloads** — the resolver only uses pre-provisioned `yt-dlp` (env / bundled / system path) and otherwise falls back to a pure-TS resolver. There are no network-to-filesystem write sinks (`js/http-to-file-access` eliminated).
3. **Secret isolation** — Supabase service-role keys are server-only and never bundled into the client.
4. **Network & headers** — Android cleartext traffic disabled (`network_security_config.xml`); `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, and a `Permissions-Policy` are set on the web server.
5. **Static analysis** — CodeQL (`security-extended`, `security-and-quality`) runs on every push/PR and weekly.

---

## 20. Keyboard Shortcuts

Disabled automatically while typing in inputs (except <kbd>Esc</kbd> to blur).

| Key | Action |
| :--- | :--- |
| <kbd>Space</kbd> / <kbd>K</kbd> | Play / Pause |
| <kbd>→</kbd> / <kbd>←</kbd> | Seek forward / backward |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Volume up / down |
| <kbd>N</kbd> / <kbd>P</kbd> | Next / previous track |
| <kbd>M</kbd> | Mute / unmute |
| <kbd>F</kbd> | Toggle full-screen player |
| <kbd>E</kbd> | Open equalizer |
| <kbd>S</kbd> | Toggle shuffle |
| <kbd>R</kbd> | Cycle repeat mode |
| <kbd>/</kbd> | Focus search |
| <kbd>?</kbd> | Shortcuts help |

---

## 21. Known Limitations

1. **Real-device testing** — automated coverage uses Vitest + Playwright (headless Chromium) and Gradle APK builds; physical-device behavior (OEM battery managers, headset quirks) should still be spot-checked.
2. **Aggressive OEM battery savers** (Xiaomi/OPPO/Realme, etc.) may still stop background audio after some time; the app requests a battery-optimization exemption once, but this is not guaranteed on every device.
3. **Upstream availability** — stream success depends on public provider endpoints; fallback engines and per-track backoff minimize interruption but cannot remove upstream outages.

---

## 22. License & Legal

Licensed under the [MIT License](LICENSE).

> **Disclaimer:** MelodyMap resolves audio from publicly available, provider-authorized endpoints and does not store or redistribute copyrighted media files. Respect each provider's terms of use.

**Maintainer:** [Naresh](https://github.com/Naresh63-hub)
