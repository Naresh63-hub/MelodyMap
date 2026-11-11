# MelodyMap — Total Project & Architecture Documentation
**Version:** 1.3.10  
**Status:** Production Ready  
**System:** Full-Stack Cross-Platform Music Streaming Engine (Web, PWA, Android Native)  
**Authors:** MelodyMap Engineering Team  

---

## 1. Executive Summary & Product Vision

**MelodyMap** is a high-performance, studio-grade music streaming application designed to match and exceed the capabilities of global industry leaders such as **Spotify** and **YouTube Music**.

### Key Architectural Differentiators:
1. **Studio-Grade 320kbps Audio Pipeline**: Direct high-speed CDN audio streaming with multi-provider failover (JioSaavn licensed CDN streams, Audius decentralized catalog, Jamendo Creative Commons, and YouTube/Piped fallback).
2. **Context-Aware Thompson Sampling Recommendation Engine**: A Bayesian Multi-Armed Bandit algorithm that learns individual taste dynamically, weighting repeat listens, completion rates, language affinity, and time of day, while penalizing skips.
3. **Strict Feed Isolation & Fuzzy Deduplication (`isFuzzySameSong`)**: Eliminates the common streaming frustration of repeating the same tracks across the active queue, "Made For You", "Daily Mix", and the "Explore" charts.
4. **Edge-to-Edge Modern Mobile Experience**: Built with Capacitor for native Android integration, featuring a persistent Android `MediaPlaybackService` with notification and lock-screen controls, safe-area insets adaptation for Dynamic Island and punch-hole displays, and zero-latency offline caching.

---

## 2. High-Level System Architecture

```
+---------------------------------------------------------------------------------------+
|                                    CLIENT LAYER                                       |
|                                                                                       |
|   +-----------------------+   +------------------------+   +----------------------+   |
|   |  React 19 Components  |   |  TanStack Start Router |   |  Lucide & Tailwind   |   |
|   | (Player, Feeds, Modals)|  |    (SSR & Hydration)   |   |   Design System      |   |
|   +-----------+-----------+   +-----------+------------+   +----------+-----------+   |
|               |                           |                           |               |
|   +-----------v---------------------------v---------------------------v-----------+   |
|   |                         Audio Engine & State Machine                          |   |
|   |   (useAudioPlayer, HTML5 Audio, AudioPrefetchManager, AudioLeveling, EQ)     |   |
|   +---------------------------------------+---------------------------------------+   |
|                                           |                                           |
|   +---------------------------------------v---------------------------------------+   |
|   |                           Native Bridge Layer                                 |   |
|   |   (PlaybackBridge, MediaPlaybackService, GoogleAuthBridge, SleepTimerBridge)  |   |
+-------------------------------------------+-------------------------------------------+
                                            |
                                            | (HTTPS / Server Functions)
                                            v
+---------------------------------------------------------------------------------------+
|                                 SERVER / EDGE LAYER                                   |
|                                                                                       |
|   +-----------------------+   +------------------------+   +----------------------+   |
|   |  Nitro Server Engine  |   |  Music Server Functions|   | Stream Proxy Core    |   |
|   |  (API & Cache Layers) |   | (Recommend, Mix, Radio)|   | (Range, Audio Chunks)|   |
|   +-----------+-----------+   +-----------+------------+   +----------+-----------+   |
|               |                           |                           |               |
+---------------+---------------------------+---------------------------+---------------+
                |                           |                           |
                v                           v                           v
+-------------------------------+   +-------------------------------+   +---------------+
|     MUSIC PROVIDERS (CDN)     |   |       SUPABASE CLOUD          |   |  LOCAL STORE  |
|                               |   |                               |   |               |
| • JioSaavn (320kbps Primary)  |   | • Auth (Google OAuth, PKCE)   |   | • IndexedDB   |
| • Audius (Decentralized MP3)  |   | • Profiles & User Metadata    |   | • safeStorage |
| • Jamendo (Independent CC)    |   | • Cloud Favorites & Playlists |   | • Cache API   |
| • YouTube / Piped (Fallback)  |   | • Row-Level Security (RLS)    |   | • SW Cache    |
+-------------------------------+   +-------------------------------+   +---------------+
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | React 19 + TypeScript | Core UI component hierarchy with concurrent rendering |
| **Routing / SSR** | TanStack Start + TanStack Router | File-based routing, server functions (`createServerFn`), type-safe navigation |
| **Server Engine** | Nitro + Node.js | Fast edge-compatible server handling SSR, caching, and stream proxying |
| **Styling & Theme** | Tailwind CSS v4 + PostCSS | Midnight Plum streaming aesthetic, CSS variables for dynamic ambient colors |
| **Native Runtime** | Capacitor v8 (Android 15+) | Native Android bridge, foreground media service, edge-to-edge window handling |
| **Backend & Database** | Supabase (PostgreSQL + Auth) | User identity, Google OAuth 1-Tap integration, cloud sync with RLS |
| **Client Storage** | IndexedDB + localStorage | Offline audio tracks, feed caches, session state persistence |
| **Quality & Tests** | Vitest + Vite | 80 test suites, 795+ tests verifying bandits, deduplication, and auth |

---

## 4. Subsystems Deep-Dive

### 4.1. Audio Playback & Streaming Engine
* **Direct High-Bitrate CDN Streams**: Resolves and plays uncompressed 320kbps / 160kbps audio from licensed CDNs.
* **Smart Prefetching (`AudioPrefetchManager`)**: Anticipates the next song in the active queue and buffers the initial chunk, allowing instant transition with zero pause.
* **Volume Leveling & Dynamic Range Control (`audio-leveling.ts`)**: Measures audio power across different provider sources to prevent ear fatigue from sudden volume spikes.
* **Hardware Equalizer (`EqualizerModal.tsx`)**: 5-band parametric equalizer utilizing the Web Audio API (`BiquadFilterNode`) with custom presets (Bass Boost, Vocal, Acoustic, Electronic, Rock).
* **Sleep Timer with Exponential Fade-Out**: Timer that gradually ramps master gain down over the final 60 seconds to ensure a peaceful sleep transition.

### 4.2. Native Android Integration
* **`MediaPlaybackService.java`**: Android Foreground Service managing audio focus, system notification with media art, seekbar, and lock-screen playback buttons (including interactive Favorite toggle).
* **`GoogleAuthBridge.java`**: One-Tap native Google Play Services sign-in bottom sheet exchanging Google ID Tokens directly with Supabase Auth.
* **System Bars & Dynamic Island Safe-Area**: Automatically consumes both CSS `env(safe-area-inset-top)` and Capacitor `--safe-area-inset-*` variables to position headers below punch-hole cameras, notches, and status pills.

### 4.3. Recommendation Engine & Personalization
MelodyMap uses a state-of-the-art **Thompson Sampling Multi-Armed Bandit** algorithm combined with a Bayesian Context Engine:

$$\theta_i \sim \text{Beta}(\alpha_i + \text{likes} + \text{completions}, \beta_i + \text{skips})$$

* **Context Engine (`context-engine.ts`)**: Dynamically computes affinity weights based on:
  * Recent history sequence and dwell time
  * User's explicit language priorities (Telugu, Hindi, Tamil, Punjabi, English, etc.)
  * Time-of-day listening patterns (e.g., upbeat in morning, melodic/chill at night)
  * Heavy penalties for tracks skipped before 15 seconds
* **Feed Isolation**:
  * **"Made For You"**: Top-ranked personalized recommendations refreshed with newly discovered tracks at index 0.
  * **"Daily Mix"**: Cohesive genre/soundtrack vibes strictly excluding tracks in the active queue or on Explore.
  * **"Explore"**: Top 50 regional trending charts, latest verified releases, and golden oldies.
* **Fuzzy Deduplication (`isFuzzySameSong`)**: Matches songs across different providers regardless of video outro/intro duration differences (e.g. YouTube 4:15 vs JioSaavn 3:42) and title tags (`(From "Movie")`, `[Official Video]`).

### 4.4. Offline Architecture & Network Resilience
* **Dual-Tier Offline Storage**:
  * Tracks marked for download are stored in IndexedDB as binary blobs alongside album artwork and lyrics.
  * Playback automatically fails over to offline cache when network connectivity drops.
* **Instant Feed Hydration**:
  * Feed states are cached in `safeStorage` (`melodymap.home_cache.v2`), allowing the app to launch instantly with zero spinner latency on cold start.

---

## 5. Directory Structure & Codebase Map

```
D:\mymusic
├── android/                             # Native Android project (Capacitor)
│   ├── app/src/main/java/com/melodymap/music/
│   │   ├── MainActivity.java            # Main activity, window insets, bridge registration
│   │   ├── MediaPlaybackService.java    # Foreground audio playback & notification service
│   │   ├── PlaybackBridge.java          # JS-to-Native audio bridge
│   │   ├── GoogleAuthBridge.java        # Native Google Play Services 1-tap sign-in
│   │   ├── SleepTimerBridge.java        # Hardware sleep timer
│   │   └── ThemeBridge.java             # System dark/light theme synchronization
├── src/
│   ├── components/
│   │   ├── music/
│   │   │   ├── layout/                  # MobileHeader, MobileNav, Sidebar, MobileDrawer
│   │   │   └── ui/                      # FloatingMiniPlayer, FullScreenPlayer, LyricsPanel,
│   │   │                                # EqualizerModal, SleepTimerModal, SettingsModal,
│   │   │                                # ProfilePanel, LanguageArtistPicker
│   │   └── ui/                          # Radix UI primitives (Button, Dialog, Input, Slider)
│   ├── lib/
│   │   ├── audio-leveling.ts            # Dynamic gain and audio normalization
│   │   ├── audio-prefetch.ts            # Next-track proactive prebuffering manager
│   │   ├── auth.ts                      # Supabase auth hooks & session management
│   │   ├── bandit-policy.ts             # Thompson Sampling multi-armed bandit policy
│   │   ├── context-engine.ts            # User behavioral affinity calculation
│   │   ├── feed-freshness.ts            # Freshness filters & isFuzzySameSong comparison
│   │   ├── language-artists.ts          # Curated artist rosters per language
│   │   ├── music.functions.ts           # Server functions for search, recommendations, feeds
│   │   ├── native-playback.ts           # Client-side native playback bridge dispatcher
│   │   ├── offline-storage.ts           # IndexedDB offline audio track storage
│   │   ├── providers/
│   │   │   ├── saavn.ts                 # JioSaavn API provider & 320kbps stream resolver
│   │   │   ├── audius.ts                # Audius decentralized provider
│   │   │   ├── jamendo.ts               # Jamendo Creative Commons provider
│   │   │   └── registry.ts              # Music provider registry & rate-limit rules
│   │   └── track-dedup.ts               # Track deduplication & list diversification
│   ├── routes/
│   │   ├── __root.tsx                   # Root layout, QueryClient, global error boundaries
│   │   ├── index.tsx                    # Main streaming application (Home, Explore, Search, Library)
│   │   └── auth.tsx                     # Authentication screen (Google 1-Tap, Email, Guest Mode)
│   ├── styles.css                       # Design system, safe area utilities, animations
│   └── sw.ts                            # Progressive web app service worker
├── capacitor.config.ts                  # Capacitor native runtime configuration
├── package.json                         # Dependencies & npm scripts
└── vite.config.ts                       # Vite & Nitro compilation configuration
```

---

## 6. Testing & Quality Assurance

MelodyMap enforces strict automated verification:
* **80 Test Suites**: Cover audio streaming, bandit math, offline storage, deduplication, deep-linking, and accessibility.
* **795 Unit & Integration Tests**: 100% passing across Vitest.
* **TypeScript Strictness**: `npx tsc --noEmit` runs with zero errors.
* **Production Build Validation**: Nitro and Vite compile clean, optimized bundles.

---

## 7. Security, Privacy & Compliance
* **Row-Level Security (RLS)**: Enforced in PostgreSQL on Supabase so users can only read and write their own playlists and favorites.
* **No Track Hijacking**: Anonymous guests can explore freely; their local preferences transfer seamlessly to cloud storage upon logging in.
* **No Unlicensed Streaming**: Employs licensed public APIs and CDN streams with full attribution to artists, albums, and labels.
