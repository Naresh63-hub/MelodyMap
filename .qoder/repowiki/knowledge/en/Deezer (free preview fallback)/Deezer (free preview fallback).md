---
kind: external_dependency
name: Deezer (free preview fallback)
slug: deezer
category: external_dependency
category_hints:
    - sdk_real_api
    - client_constraint
scope:
    - '**'
---

### Deezer
- Role: Fallback music source providing free 30-second MP3 previews when YouTube search fails or tracks are restricted. Used via the public `https://api.deezer.com/search` endpoint — no API key required.
- Integration: `deezer.server.ts.searchDeezer` queries the search API with a `MelodyMap/1.0` User-Agent; `findDeezerPreview` cleans YouTube-style titles before searching.
- Hybrid strategy: `music-hybrid.server.ts.searchHybrid` tries YouTube first, then falls back to Deezer; `getTrackStreamUrl` routes Deezer tracks directly to their preview URL while YouTube tracks go through the `/api/stream/:videoId` proxy.
- Constraint: Only 30-second previews are available; full-length playback requires YouTube.