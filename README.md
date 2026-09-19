<div align="center">
  <img src="public/brand/app-icon.png" alt="MelodyMap Logo" width="96" height="96" style="border-radius: 22px; box-shadow: 0 10px 30px rgba(124, 58, 237, 0.4);" />
  <h1>MelodyMap</h1>
  <p><strong>Your Music. Your Mood. Your Map.</strong></p>
  <p>A full-featured, local-first music streaming application with AI recommendations, 10-band equalizer, Spotify-style background playback, and seamless lock screen controls.</p>

  <p>
    <img src="https://img.shields.io/badge/React-19.2-61dafb?style=flat-square&logo=react" alt="React 19" />
    <img src="https://img.shields.io/badge/TanStack-Start-ff4154?style=flat-square" alt="TanStack Start" />
    <img src="https://img.shields.io/badge/TailwindCSS-v4-38bdf8?style=flat-square&logo=tailwindcss" alt="Tailwind CSS 4" />
    <img src="https://img.shields.io/badge/TypeScript-5.8-3178c6?style=flat-square&logo=typescript" alt="TypeScript" />
    <img src="https://img.shields.io/badge/PWA-Ready-7c3aed?style=flat-square" alt="PWA Ready" />
    <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
  </p>
</div>

---

## 🎧 Features

- **⚡ Dual-Engine Audio Streaming**: Seamlessly routes between HTML5 audio proxy and direct client-side playback for zero-failure streaming across localhost and serverless clouds (Vercel).
- **📱 Spotify-Like Lock Screen Controls**: Full native Media Session integration showing high-res album art, song title, artist, live seek scrubber, play/pause, and track advance directly on Android, iOS, Windows, and macOS lock screens.
- **🎵 Continuous Background Playback**: Screen-off background audio focus keeps music streaming seamlessly even when your phone is locked in your pocket or when multitasking between apps.
- **🎛️ 10-Band Hardware Equalizer & FX**: Studio-grade Web Audio API parametric filters, bass booster, vocal enhancer, and LUFS Dynamic Range Compressor leveling.
- **❤️ 1-Click Fast Favourites**: Tap the heart button on the playing bar or mini player to immediately save songs and tune personalized recommendations.
- **🤖 AI-Powered Recommendation Engine**: Generates Daily Mixes, Mood Radios, and personalized song suggestions learning from your play history and likes.
- **⚡ Offline Caching**: Download songs directly to local browser IndexedDB storage for full offline listening without an internet connection.
- **⏩ SponsorBlock Auto-Skip**: Automatically detects and skips sponsored segments, non-music intros, and outros for uninterrupted listening.
- **📝 Real-Time Synced Lyrics**: Synchronized word-for-word scrolling lyrics powered by LRCLIB.
- **☁️ Cloud Sync (Optional)**: Connect Supabase to sync your library, playlists, and history across all your devices, or use local guest mode with zero setup.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Framework** | [React 19](https://react.dev/), [TanStack Start](https://tanstack.com/start) (SSR & Server Functions via Nitro) |
| **Styling** | [Tailwind CSS 4](https://tailwindcss.com/), Radix UI Primitives, Lucide Icons |
| **Audio Pipeline** | Web Audio API (10-Band Biquad Filters), Media Session API, HTML5 Audio |
| **Catalog & Search** | Multi-source hybrid search aggregation with YouTube Music & Deezer |
| **PWA & Mobile** | Progressive Web App manifest, Service Worker caching, Capacitor ready |
| **Database & Auth** | [Supabase](https://supabase.com/) (PostgreSQL + Row-Level Security) |
| **Build & Tooling** | Vite 8, TypeScript 5, ESLint, Prettier |

---

## 🚀 Quick Start

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or higher recommended)
- `npm`

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Naresh63-hub/Musicplayer.git
cd Musicplayer

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev
```

The application will be running at **`http://localhost:3000`**.

---

## 📦 Building for Production

```bash
# Build client and server bundles
npm run build

# Preview production build locally
npm run preview
```

---

## ☁️ Cloud Sync & Deployment (Optional)

MelodyMap runs completely local-first out of the box with **no configuration required**. 

If you want cross-device cloud sync and Google OAuth:
1. Create a free project at [Supabase](https://supabase.com/).
2. In your deployment platform (e.g. Vercel), add these Environment Variables:
   - `VITE_SUPABASE_URL`: `https://your-project.supabase.co`
   - `VITE_SUPABASE_ANON_KEY`: `your-supabase-anon-key`
3. Deploy!

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Space</kbd> | Play / Pause |
| <kbd>J</kbd> / <kbd>L</kbd> | Skip Backward (15s) / Forward (30s) |
| <kbd>K</kbd> | Play / Pause |
| <kbd>N</kbd> / <kbd>P</kbd> | Next Track / Previous Track |
| <kbd>M</kbd> | Mute / Unmute Volume |
| <kbd>F</kbd> | Toggle Full-Screen Player |
| <kbd>E</kbd> | Open 10-Band Equalizer |
| <kbd>L</kbd> | Toggle Synced Lyrics |
| <kbd>/</kbd> | Focus Search Bar |

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).
