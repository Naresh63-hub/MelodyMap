# 🎵 MelodyMap — Music Player

A full-featured music streaming application built with React 19 and TanStack Start. Stream any song for free with AI-powered recommendations that learn your taste. No account needed for basic usage, with optional cloud sync via Supabase.

## ✨ Features

- **🎧 Unlimited Streaming**: Play any song from YouTube with ad-free audio extraction
- **🤖 AI-Powered Recommendations**: Smart playlists and music discovery that adapts to your preferences
- **📱 Responsive Design**: Beautiful dark neon theme that works on all devices
- **🎨 Premium UI**: Glass morphism effects, smooth animations, and intuitive navigation
- **📚 Local-First Library**: Manage your likes, playlists, and listening history locally
- **☁️ Cloud Sync**: Optional Supabase integration for cross-device synchronization
- **🔍 Smart Search**: Real-time search with suggestions and multi-source aggregation
- **🎵 Multiple Sources**: YouTube, Deezer fallback, and more streaming options
- **⚡ Offline Support**: Service worker for PWA functionality and offline access
- **🎛️ Advanced Controls**: Queue management, sleep timer, and playback customization

## 🛠️ Tech Stack

- **Frontend**: React 19 + TanStack Start (SSR via Nitro)
- **Styling**: Tailwind CSS 4 + custom dark neon theme + Radix UI primitives
- **State Management**: TanStack Query + React hooks
- **Routing**: TanStack Router with file-based routing
- **Database**: Supabase (PostgreSQL + Auth + RLS) for cloud sync
- **Streaming**: YouTube audio extraction + Deezer fallback
- **AI Recommendations**: OpenAI-compatible gateway (works with any provider)
- **Build Tool**: Vite 8 + TypeScript 5
- **Deployment**: Node.js / Docker / VPS Self-Hosted (via Nitro `node-server`)

## 🚀 Getting Started

### Prerequisites

- Node.js 18+ 
- npm or bun
- (Optional) Supabase account for cloud sync

### Installation

```bash
# Clone the repository
git clone https://github.com/Naresh63-hub/Musicplayer.git
cd Musicplayer

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Edit .env with your API keys (optional for local-only usage)
```

### Development

```bash
# Start development server
npm run dev

# The app will be available at http://localhost:3000
```

### Build for Production

```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

## 📖 Usage

### Basic Usage
1. Open the app and start browsing recommended music
2. Use the search bar to find specific songs, artists, or albums
3. Click on any track to start playing
4. Use keyboard shortcuts for quick control (Space for play/pause, etc.)

### Features Navigation
- **For You**: AI-curated recommendations based on your listening history
- **Mixes**: Pre-built playlists for different moods and genres
- **Search**: Find any song, artist, or album
- **Playlists**: Create and manage your own playlists
- **History**: View your recently played tracks
- **Favourites**: Quick access to your liked songs

### Cloud Sync (Optional)
To enable cross-device synchronization:
1. Create a Supabase project
2. Add your Supabase URL and anon key to `.env`
3. Sign up/in through the app's authentication
4. Your library will sync across devices

## 🎯 Scripts

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `npm run dev`    | Start dev server with HMR             |
| `npm run build`  | Production build (client + server)    |
| `npm run preview`| Preview the production build locally  |
| `npm run lint`   | Run ESLint                            |
| `npm run format` | Format with Prettier                  |

## ⚙️ Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Supabase (optional - for cloud sync)
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# AI Gateway (optional - for enhanced recommendations)
VITE_AI_GATEWAY_URL=your_ai_gateway_url
VITE_AI_GATEWAY_KEY=your_ai_gateway_key
```

## 🏗️ Project Structure

```
src/
├── components/
│   ├── music/           # Main music player components
│   │   ├── layout/     # Sidebar, SearchHeader
│   │   └── ui/         # Custom UI components
│   └── ui/             # shadcn/ui components
├── hooks/              # Custom React hooks
├── lib/                # Utilities and server functions
├── routes/             # TanStack Router file-based routes
└── styles.css          # Global styles and Tailwind config
```

## 🎨 Design System

The app uses a custom dark neon theme with:
- **Primary Colors**: Neon pink/magenta (#ec4899) and purple (#8b5cf6)
- **Accent Colors**: Cyan (#06b6d4) and electric blue (#2979ff)
- **Background**: Deep navy/black (#0a0a18)
- **Effects**: Glass morphism, neon glows, and smooth animations

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- Music streaming powered by YouTube and Deezer APIs
- UI components from shadcn/ui and Radix UI
- Build tooling by Vite and TanStack
