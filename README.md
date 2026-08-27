# YouTube Music Companion

A full-featured music streaming app that plays audio from YouTube — ad-free, with background playback, offline downloads, AI-powered recommendations, and a local-first library.

## Tech Stack

- **Frontend**: React 19 + TanStack Start (SSR via Nitro)
- **Styling**: Tailwind CSS 4 + shadcn/ui + Radix UI
- **Database**: Supabase (PostgreSQL + Auth + RLS)
- **Streaming**: @distube/ytdl-core (YouTube audio extraction) + same-origin proxy
- **AI Recommendations**: OpenAI-compatible gateway (works with any provider)
- **Deployment**: Cloudflare Workers (via Wrangler)

## Development

Requires Node.js 18+ and npm.

```sh
git clone <this-repository-url>
cd <repository-name>
npm install
cp .env.example .env   # fill in your API keys
npm run dev
```

## Scripts

| Command          | Description                           |
| ---------------- | ------------------------------------- |
| `npm run dev`    | Start dev server with HMR             |
| `npm run build`  | Production build (client + server)    |
| `npm run preview`| Preview the production build locally  |
| `npm run lint`   | Run ESLint                            |
| `npm run format` | Format with Prettier                  |

## Environment Variables

See [.env.example](./.env.example) for all required/optional variables.
