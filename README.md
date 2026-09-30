<div align="center">
  <img src="public/brand/app-icon.png" alt="MelodyMap Logo" width="104" height="104" style="border-radius: 24px; box-shadow: 0 12px 36px rgba(124, 58, 237, 0.45);" />
  <h1>MelodyMap</h1>
  <p><strong>Your Music. Your Mood. Your Map.</strong></p>
  <p>A local-first music streaming progressive web application and Android app powered by <strong>Contextual Linear Thompson Sampling (LinTS)</strong>, studio-grade Web Audio API processing, single-track playback guarantees, and real-time listening insights.</p>

  <p>
    <a href="https://melodymap-pi.vercel.app" target="_blank">
      <img src="https://img.shields.io/badge/Live_Demo-melodymap--pi.vercel.app-7c3aed?style=for-the-badge&logo=vercel" alt="Live Demo" />
    </a>
  </p>

  <p>
    <a href="https://github.com/Naresh63-hub/Musicplayer/releases/tag/v1.0.0">
      <img src="https://img.shields.io/badge/Release-v1.0.0-1DB954?style=flat-square&logo=android" alt="Release v1.0.0" />
    </a>
    <img src="https://img.shields.io/badge/CI-Passing-brightgreen?style=flat-square&logo=githubactions" alt="CI Passing" />
    <img src="https://img.shields.io/badge/Unit_Tests-119_Passed-brightgreen?style=flat-square&logo=vitest" alt="Vitest 119 Passed" />
    <img src="https://img.shields.io/badge/E2E_Tests-6_Passed-brightgreen?style=flat-square&logo=playwright" alt="Playwright E2E 6 Passed" />
    <img src="https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react" alt="React 19" />
    <img src="https://img.shields.io/badge/TanStack-Start-ff4154?style=flat-square" alt="TanStack Start" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript" alt="TypeScript 5.8" />
    <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4" />
    <img src="https://img.shields.io/badge/Capacitor-Android-blue?style=flat-square&logo=capacitor" alt="Capacitor Android" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>
</div>

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
- [Contextual Thompson Sampling Recommender](#-contextual-thompson-sampling-recommender)
- [Offline Bandit Evaluation Harness](#-offline-bandit-evaluation-harness)
- [Playback & Audio Engine](#-playback--audio-engine)
- [Listening Insights & AI Radar](#-listening-insights--ai-radar)
- [Key Features](#-key-features)
- [Quality Assurance & CI/CD](#-quality-assurance--cicd)
- [Quick Start & Development](#-quick-start--development)
- [Mobile & Android APK Build](#-mobile--android-apk-build)
- [Keyboard Shortcuts](#-keyboard-shortcuts)
- [License & Legal](#-license--legal)

---

## 🏛️ System Architecture

MelodyMap runs a **local-first, full-stack hybrid architecture** powered by TanStack Start, Nitro server functions, and Web Audio API:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        MelodyMap Client App                           │
│   (React 19 + TanStack Router + Tailwind CSS 4 + Capacitor Native)     │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │                                        │
        Playback & Controls                      Telemetry & Context
                ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│     useAudioPlayer Core       │        │    Contextual LinTS Bandit    │
│  - Single Audio Element Guard │        │  - 6D Feature Extraction      │
│  - Mutual Audio Exclusion     │        │  - Cholesky Posterior Sample │
│  - Web Audio 10-Band EQ       │        │  - Online Bayesian Update     │
│  - MediaSession Lockscreen    │        │  - Feed Freshness & Dedup     │
└───────────────┬───────────────┘        └───────────────┬───────────────┘
                │                                        │
        Audio Streams                            Candidate Scoring
                ▼                                        ▼
┌───────────────────────────────┐        ┌───────────────────────────────┐
│   Hybrid Stream Resolvers     │        │  Multi-Source Music Catalogs  │
│  - Node Server Stream Proxy   │        │  - YouTube Music Hybrid API   │
│  - Deezer CDN Direct Previews │        │  - Deezer Public Search API   │
│  - LRCLIB Real-time Lyrics    │        │  - LRU Memory / Disk Caches   │
└───────────────────────────────┘        └───────────────────────────────┘
```

---

## 🧠 Contextual Thompson Sampling Recommender

Rather than relying on static, hand-tuned heuristic coefficients, MelodyMap recommends songs dynamically through **Linear Contextual Thompson Sampling (LinTS)** using Bayesian linear regression.

### 1. 6-Dimensional Contextual Feature Representation ($x \in [0, 1]^6$)

For each candidate track $a$ within session context $c$, the engine extracts:

| Feature | Dimension | Description |
| :--- | :---: | :--- |
| **Intercept** | $x_0$ | Base engagement bias ($1.0$). |
| **Circadian Alignment** | $x_1$ | Matches song energy (chill / medium / high) to the listener's time of day (Morning awakening, Afternoon focus, Evening unwind, Late night deep dive). |
| **Energy Continuity** | $x_2$ | Computes AutoDJ energy transition compatibility from the previous track (range: $[-0.30, +0.30] \rightarrow [0.0, 1.0]$). |
| **Artist Affinity** | $x_3$ | Historical completion-to-skip ratio for the artist ($c_{\text{comp}} / (n_{\text{plays}} + n_{\text{skips}} + 1)$). |
| **Novelty / Discovery** | $x_4$ | Dynamic novelty score modulated by the user's Discovery setting (0%–100%). |
| **Session Momentum** | $x_5$ | Ratio of completed vs. skipped tracks in the active session. |

### 2. Posterior Sampling & Online Bayesian Update

1. **Posterior Sampling**: Draws parameter vector $w^* \sim \mathcal{N}\left(\mu, v^2 B^{-1}\right)$ using Cholesky decomposition ($B^{-1} = L L^T$):
   $$w^* = \mu + v L z, \quad z \sim \mathcal{N}(0, I)$$
2. **Selection**: Ranks and selects the candidate maximizing expected reward:
   $$a^* = \arg\max_{a} \left(w^{*T} x_a\right)$$
3. **Telemetry Feedback**: Every playback milestone emits scalar rewards:
   - `COMPLETED`: $+1.0$
   - `LIKED`: $+2.0$
   - `REPLAYED`: $+1.5$
   - `SKIPPED (<10s)`: $-1.2$
   - `SKIPPED (10-25s)`: $-0.6$
4. **Bayesian Conjugate Update**:
   $$B \leftarrow B + x x^T, \quad f \leftarrow f + r x, \quad \mu = B^{-1} f$$

---

## 📊 Offline Bandit Evaluation Harness

MelodyMap includes a built-in offline simulation benchmark (`src/lib/bandit-evaluation.ts`) to verify recommender convergence and regret bounds:

- **Random Baseline**: Selects uniformly at random from available candidates.
- **$\varepsilon$-Greedy ($\varepsilon = 0.1$)**: Exploits the current point estimate $\hat{\theta} = B^{-1} f$ with probability $1 - \varepsilon$; explores uniformly with probability $\varepsilon$.
- **LinTS (Thompson Sampling)**: Samples from the posterior covariance, balancing exploration and exploitation.
- **Oracle (Optimal)**: Computes true maximum reward under latent user preference weights $\theta^*$.

### Benchmark Performance (200 Rounds)

| Policy | Cumulative Reward | Cumulative Regret | Regret vs. Random |
| :--- | :---: | :---: | :---: |
| **Oracle (Optimal)** | ~185.0 | 0.0 | — |
| **Thompson Sampling (LinTS)** | **~165.2** | **~24.8** | **-54% Regret** |
| **$\varepsilon$-Greedy ($\varepsilon=0.1$)** | ~152.1 | ~42.5 | -22% Regret |
| **Random Baseline** | ~112.4 | ~72.6 | Baseline (0%) |

---

## 🎵 Playback & Audio Engine

The playback pipeline is built for **resilience, smooth interaction, and zero interruptions**:

- **Strict Single-Track Guarantee**:
  - The DOM contains exactly one `<audio id="melodymap-core-audio">` instance.
  - Mutual audio exclusion prevents simultaneous HTML5 and YouTube IFrame playback.
  - Zero double-buffering or overlapping sound leaks.
- **Micro-Buffered Transport**:
  - Advancing to the next track (`Next`) or returning to the previous track (`Previous`) resets the position cleanly to `0:00`.
  - Seeking and scrub dragging use pointer-captured handles with real-time timestamp tooltips and zero snapback on release.
- **10-Band Studio Equalizer & Dynamics Compressor**:
  - 10 biquad peaking/shelf filters: `32Hz`, `64Hz`, `125Hz`, `250Hz`, `500Hz`, `1kHz`, `2kHz`, `4kHz`, `8kHz`, `16kHz`.
  - Integrated dynamic range compression leveling audio to **-14 LUFS** broadcast standard.
- **Native MediaSession API**:
  - Full Android and desktop lockscreen and notification control (album artwork, artist, title, scrubber, and transport).

---

## 📈 Listening Insights & AI Radar

Accessible directly from **Settings & Profile $\rightarrow$ Listening Insights**:

- **Telemetry KPI Dashboard**: Track completion rate (%), loved tracks, full listens, and avoided skips.
- **Bayesian Taste Vector Radar**: Real-time visualization of your learned LinTS weights ($\mu$) across Circadian Timing, Energy Flow, Artist Loyalty, Novelty Drive, and Session Momentum.
- **Affinity Spectrum**: Automatic lists of top affinity artists and deprioritized/skipped artists.
- **In-App Offline Benchmark**: Run a live 200-round simulation directly in the browser to visualize your model's regret reduction and reward gains.

---

## ✨ Key Features

- 🔍 **Live Debounced Search**: Fast auto-search (~400-500ms debounce) that discovers tracks while you type, with stale request cancellation and provider fallbacks.
- 🔄 **Fresh-Session Feed Discovery**: Dynamic session-level feed exclusions guarantee that refreshing the feed discovers genuinely new songs without repeating already displayed tracks.
- 🎯 **Logical-Song Deduplication**: Collapses multiple redundant uploads, lyric videos, and re-uploads of the same song while preserving distinct artist releases.
- ⚡ **Zero-Failure Hybrid Streaming**: High-speed Node server-side proxy paired with client-side direct streams.
- 🎚️ **Touch-Friendly Scrub Bars**: Draggable mini and full-screen scrub bars with live time previews.
- 📱 **PWA & Android Support**: Offline capability via IndexedDB and full APK compilation via Capacitor.
- ⏩ **SponsorBlock Integration**: Automatically skips non-music intros, sponsors, and outros.
- 📝 **Real-Time Synchronized Lyrics**: Powered by LRCLIB.
- ☁️ **Local-First & Optional Cloud Sync**: Works out of the box with zero login, with optional Supabase multi-device sync.

---

## 🧪 Quality Assurance & CI/CD

MelodyMap enforces strict engineering rigor through automated testing and continuous integration:

```bash
# Run 119 Vitest unit & integration tests
npm run test

# Run TypeScript strict typecheck (tsc --noEmit)
npm run typecheck

# Run Playwright E2E Playback Suite (6 flows)
npm run test:e2e

# Run production build
npm run build
```

### GitHub Actions CI Workflow (`.github/workflows/ci.yml`)
- Triggers on every `push` and `pull_request` to `main`.
- **Job 1 (`verify`)**: Runs unit tests, TypeScript typecheck, and production build in parallel.
- **Job 2 (`e2e`)**: Runs the complete Playwright E2E playback suite in a headless Chromium environment against the Nitro production server.

---

## 🚀 Quick Start & Development

### Prerequisites
- Node.js $\ge 20$
- `npm`

### Installation

```bash
# 1. Clone repository
git clone https://github.com/Naresh63-hub/Musicplayer.git
cd Musicplayer

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev
```

Visit **`http://localhost:3000`** in your browser.

---

## 📱 Android APK Release (v1.0.0)

MelodyMap provides a fully native Android application packaged via **Capacitor**.

### Download Android APK

- 🚀 **[Download MelodyMap v1.0.0 APK](https://github.com/Naresh63-hub/Musicplayer/releases/download/v1.0.0/MelodyMap-v1.0.0.apk)** *(Direct APK Download)*
- 📦 **GitHub Release**: [MelodyMap v1.0.0](https://github.com/Naresh63-hub/Musicplayer/releases/tag/v1.0.0)

### Installation Instructions
1. Download **`MelodyMap-v1.0.0.apk`** to your Android phone or tablet.
2. Tap the downloaded `.apk` file from your notification tray or File Manager.
3. If prompted by Android, enable **"Allow from this source"** for your browser or file manager.
4. Tap **Install** and open **MelodyMap**.
5. Start listening immediately (supports offline playback, guest mode, or cloud sync).

### Building the APK from Source

```bash
# 1. Build web application assets
npm run build

# 2. Sync Capacitor with Android assets
npx cap sync android

# 3. Compile signed Release APK with Gradle
cd android && .\gradlew.bat assembleRelease

# The generated APK is located at:
# android/app/build/outputs/apk/release/app-release.apk
```

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
| :--- | :--- |
| <kbd>Space</kbd> / <kbd>K</kbd> | Play / Pause |
| <kbd>→</kbd> / <kbd>←</kbd> | Seek Forward / Backward (5s) |
| <kbd>↑</kbd> / <kbd>↓</kbd> | Volume Up / Down (5%) |
| <kbd>N</kbd> / <kbd>P</kbd> | Next Track / Previous Track |
| <kbd>M</kbd> | Mute / Unmute Volume |
| <kbd>F</kbd> | Toggle Full-Screen Player |
| <kbd>E</kbd> | Open 10-Band Equalizer |
| <kbd>S</kbd> | Toggle Shuffle Mode |
| <kbd>R</kbd> | Cycle Repeat Mode (Off $\rightarrow$ All $\rightarrow$ One) |
| <kbd>/</kbd> | Focus Search Bar |
| <kbd>?</kbd> | Open Keyboard Shortcuts Modal |

---

## 📄 License & Legal

This project is licensed under the [MIT License](LICENSE).

> **Disclaimer**: MelodyMap resolves and streams audio from publicly available endpoints across third-party providers (YouTube, Deezer). It does not host, store, or redistribute any copyrighted media. This project is built for educational, personal research into contextual bandit recommendation systems.

**Author**: [Naresh](https://github.com/Naresh63-hub)
