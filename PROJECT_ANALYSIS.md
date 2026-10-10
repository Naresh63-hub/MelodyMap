# MelodyMap — Project Analysis & Fix Report

_Generated 2026-10-09 against `main` (HEAD `d186728` + working-tree metadata fix)._

Every claim below is marked with how it was established:

- **[verified]** — reproduced with a test, a live API call, or the running app.
- **[code]** — read directly from the source (no runtime confirmation yet).
- **[suspected]** — inferred, needs confirmation.

---

## 1. Recommendation metadata — FIXED (song name + movie name, no channel names)

### The problem

JioSaavn returns film songs with the movie baked into the title, and mirrors that
same polluted string into the album field:

| field | real value (live API) |
| --- | --- |
| `title` | `Yeshanagula (From "The Paradise") (Telugu)` |
| `more_info.album` | `Yeshanagula (From "The Paradise") (Telugu)` |
| `more_info.artistMap.primary_artists` | `Anirudh Ravichander, Singer Prabha, Jangi Reddy, Kasarla Shyam` |

**[verified]** Two compounding bugs:

1. The old cleaner (`cleanYouTubeTrackMetadata` → `cleanTrackDisplayMetadata`)
   only copied the derived movie into `album` **when `album` was missing**
   (`...(album && !track.album) ? { album } : {}`). JioSaavn always supplies an
   album, so the extracted movie name was **always thrown away** and the junk
   string stayed.
2. The `(Telugu)` / `(Hindi)` language tag was never stripped, so even after the
   `(From …)` clause was removed the title stayed cluttered
   (`Yeshanagula (Telugu)`).

Additionally, YouTube-derived entries still mixed into the feeds carried
**channel names as artists** — `Aditya Music PLAYBACK`, `SriBalajiMovies`,
`Music Club Official`, `DEBASREE DANCE ACADEMY`, `X - Topic`, `YVEVO`
**[verified — observed in the app's own DOM]**.

### The fix

| file | change |
| --- | --- |
| `src/lib/track-metadata.ts` **(new)** | Pure, dependency-free normaliser: `cleanSongTitle`, `cleanMovieName`, `cleanAlbumName`, `extractFromClause`, `stripLanguageAndNoiseTags`, `isChannelOrLabelName`, `trackSubtitle`, `decodeEntities`. |
| `src/lib/track-metadata.test.ts` **(new)** | 16 tests driven by real captured catalog strings. |
| `src/lib/providers/saavn.ts` | The mapper now emits a clean `title` and stores the **movie name** in `album`. |
| `src/lib/track-dedup.ts` | `cleanTrackDisplayMetadata` (the central feed cleaner) derives the movie and now **replaces** a polluted album instead of discarding the result. |
| `src/components/music/ui/MobileHomeSections.tsx` | Home cards + list rows show `trackSubtitle(track)`. |
| `src/components/music/ui/HomeSections.tsx` | Desktop grid card subtitle uses `trackSubtitle(track)`. |
| `src/components/music/ui/SearchResults.tsx` | Search result rows use `trackSubtitle(track)`. |
| `src/components/music/ui/ExploreSections.tsx` | Explore-tab card rows + lists use `trackSubtitle(track)`. |

### Display rule (what a listener now sees)

```
title    = clean song name           e.g. "Tu Jahaan"
subtitle = movie / album name        e.g. "Dacoit"
         → else the artist, unless that artist is a channel/label (then blank)
```

### Result — verified on the running app and the live API

| song | shown subtitle | note |
| --- | --- | --- |
| `Yeshanagula` | `The Paradise` | movie recovered from a polluted album |
| `Gehra Hua` | `Dhurandhar` | movie |
| `Tum Hi Ho` | `Aashiqui 2` | movie |
| `Aaya Sher` | `Srikanth Odela` | album name |
| `Tu Jahaan` | `Dacoit` | movie (was `Tu Jahaan")` + channel junk) |
| `Chamka Chamka` | `Chirutha` | movie |
| `Door Number` | `Thozha` | movie |
| `Dooba Dooba` | `Silk Route` | album == title → artist fallback |
| `Tera Mera Pyar` | `Prem & Hardeep, Kumar Sanu` | album was a compilation → artist fallback |
| `Virijalluvo` | `Raktha Sam Bandham` | movie (Explore → Old Songs) |
| `Bhamalo Chandamamalo` | `Alibaba 40 Dongalu` | movie (Explore → Old Songs) |

Channel names are now suppressed: `Aditya Music PLAYBACK`, `SriBalajiMovies`,
`Music Club Official`, `XVEVO`, `Y - Topic`, plus curated-uploader handles
observed live in the Explore feed (`MoodExTunes, MoodoraTunes`, `Trending Topic`,
`Retro Rewind (Trending Again)`) — all resolve to an empty subtitle rather than
appearing where an artist belongs **[verified — unit tests]**.

### Remaining metadata gaps (recommendations)

- **`primary_artists` mixes roles.** For `Gehra Hua` the API returns
  `Shashwat Sachdev (composer), Arijit Singh (singer), Irshad Kamil (lyricist),
  Armaan Khan`. Showing all four as "the artist" is noisy **[verified]**.
  Recommendation: prefer `artistMap` roles / `singers` from `song.getDetails`,
  falling back to `primary_artists` minus known lyricists.
- **The same song is returned twice** (single entry with polluted title +
  album entry with clean title/album) **[verified]**. Harmless for display now,
  but it halves effective search depth and wastes dedupe work.
- **Language is available** (`language`, plus `(Telugu)` tags) and could drive
  the existing language filter instead of being inferred from the title.
- **`song.getDetails` exposes `starring` (cast), `label`, `release_date`,
  `has_lyrics`** — currently unused. `starring` would enrich the full-screen
  player; `has_lyrics` could hide the lyrics button when there are none.

---

## 2. Audio playback

### 2.1 "Song plays but there is no sound" — FIXED (commit `d186728`, by another agent this session)

**Root cause [verified by controlled experiment]:** the `<audio>` element was
captured by the Web Audio EQ graph (`createMediaElementSource`) while tracks
streamed from the direct cross-origin `aac.saavncdn.com` URL with `crossorigin`
stripped. Chromium renders **cross-origin media fetched in no-CORS mode as pure
silence** once routed through Web Audio — the element advances, duration and
progress update, no error fires.

Measured with the app's own CDN URL, same graph, only the attribute differing:

| `crossorigin` | analyser peak | element | raw bytes |
| --- | --- | --- | --- |
| absent (no-CORS) | **0 (silent)** | playing, advancing, unmuted, volume 1 | decode RMS **0.098** (loud) |
| `anonymous` | **19 (audible)** | playing, advancing | same URL |

The committed fix stops wiring the main element into Web Audio on web, so the
silence mechanism cannot occur **[verified: 0 `AudioContext` instances created
during playback; no `createMediaElementSource` anywhere in `src/`]**.

### 2.2 Consequences of that fix — open issues

| # | issue | severity | evidence |
| --- | --- | --- | --- |
| 1 | **10-band EQ, audio visualizer and crossfade are inert on web** — no `AudioContext` is ever created, so `getAnalyser()` is permanently `null` and the EQ sliders change nothing. The EQ/visualizer UI still ships. | High | [verified — runtime + code] |
| 2 | The explanatory comment claims the Saavn CDN "does not return CORS headers". It **does** (`Access-Control-Allow-Origin: *`). That matters: the EQ could be restored by keeping the graph for CORS-clean media, which measured audible (peak 19). | Medium | [verified — live header] |
| 3 | **Mute does not stick**: `initWebAudio()`/`setStream()` force `volume` back to `1` when it is `0`, so muting is undone on the next track/resume. Pre-existing (the old code set `volume = 1` unconditionally). | Medium | [code] |
| 4 | **Offline downloads are write-only.** `playOffline()` always returns `false`, so a saved blob can never play, yet the Download button and "Downloaded" state remain. Users spend storage on files that never play. | High | [code — `use-audio-player.ts:860`, `offline.ts:128`] |

### 2.3 Stream resolution

| # | issue | severity | evidence |
| --- | --- | --- | --- |
| 5 | **`lastSeenDurations` is never written** — only `.get()` calls exist, so the duration-aware candidate picker always receives `null` and takes the first Saavn/Audius/Jamendo match. Wrong-version risk (extended/remix/another cut of the same title). | Medium | [code — `stream.server.ts:340`] |
| 6 | The legacy InnerTube branch POSTs `youtubei/v1/player` with a bare `{videoId}` body — returns **HTTP 400** in practice (tested 3 IDs), so it is dead code. Worse, if it ever succeeded it seeds the stream from `adaptiveFormats[0]`, which is frequently a **video-only** format → a silent or mismatched "song". | Medium | [verified — 400 responses; code] |
| 7 | `getYtDlpInstance()` returns `null` and `resolvedYtDlpInstance` is unused — dead scaffolding. | Low | [code] |
| 8 | YouTube-derived track IDs still enter the feeds and then 404 through the proxy (`Failed to load resource: 404`, `MEDIA_ELEMENT_ERROR: Format error`, auto-skip). The app is Saavn-only for streaming, so those entries are pure churn. | Medium | [verified — console during playback] |
| 9 | Rate limiting is a per-process `Map`, i.e. ineffective on serverless (documented in code as best-effort). | Low | [code] |
| 10 | `isReplacementSource` is hardcoded `false` and the `streamSource` prop was removed from `FullScreenPlayer`, so the "alternate recording" indicator is dead. | Low | [code] |

---

## 3. Feature inventory (what exists)

**Catalog & playback**

- JioSaavn-first streaming: 96/160/320 kbps direct CDN, DES-ECB URL decryption,
  Audius + Jamendo fallbacks, LRU stream cache (25 min) + per-track backoff.
- Same-origin stream proxy in three shapes (Nitro route, Vite dev middleware,
  SSR entry) sharing `stream-proxy-core.ts`: SSRF allow-list, origin check,
  per-IP rate limit, Range/206 handling, 512 KB chunk clamp for serverless.
- Queue, shuffle, repeat off/all/one, gapless pre-buffer, continuous autoplay,
  seek, ±5 s skip, playback speed, sleep timer, crossfade (currently inert),
  SponsorBlock skipping, offline cache, downloads (currently unusable).
- Native Android shell: `MediaPlaybackService` foreground service, lockscreen
  MediaSession bridge, media-button dispatch, battery-optimisation prompt.
- PWA: service worker, offline shell, install, safe-area/edge-to-edge handling.

**Discovery & personalisation**

- Thompson-sampling bandit + context engine + telemetry events; Discover Weekly,
  Daily Mix, Mixes (discover/new release/explore), Old Classics, New Releases,
  Release Radar, Listening Personality/Insights, streak badge.
- Language & artist onboarding/picker, language-strict filtering, era filters.
- Genre & Mood quick filters (instant client-side, 22 filters).
- Search with filters (songs/albums/artists/playlists/podcasts), debounce,
  search history, voice search, radio ("song radio").
- Podcasts with per-episode resume positions, lyrics panel, share modal.

**Platform & UX**

- Supabase-backed auth, guest mode, cloud sync, playlists, likes/dislikes,
  history, stats; theme toggle (light/dark/auto); keyboard shortcuts;
  pull-to-refresh; skeletons; haptics; mini + floating players; equalizer UI.

---

## 4. Recommended next steps (priority order)

1. **Decide the EQ question.** Keep the graph only for media that is CORS-clean
   (same-origin proxy URLs and CORS-capable CDNs such as `saavncdn.com`, which
   sends `ACAO: *`) — measured audible — or delete the EQ/visualizer/crossfade
   UI so it stops lying to users.
2. **Fix or remove offline downloads.** Either restore blob playback in
   `playOffline()` or remove the download affordances.
3. **Make Saavn the single catalog source** for feeds (fixes channel names,
   proxy 404s, and gives the movie name + full-length audio in one step).
4. **Fix `lastSeenDurations`** (populate it in `stream.server.ts`) so version
   matching actually uses duration.
5. **Fix mute** (stop forcing `volume = 1`; only reset a stale `0` when the user
   did not mute).
6. **Artist quality:** show singers (from `song.getDetails`) instead of the
   composer+lyricist composite.
7. **Delete dead code:** InnerTube branch, `getYtDlpInstance`,
   `isReplacementSource`, unused `streamSource` plumbing.
8. **Regression tests** for the two bug classes that cost real time here:
   an audibility test (analyser signal > 0 while playing) and a metadata test
   (title has no `(From …)`/language tag; subtitle is a movie or a real artist).

---

## 5. Verification log

- `npm run test` → **372/372 pass, 41 files, exit 0** (16 of them metadata tests).
- `npm run typecheck` → **exit 0**.
- No raw `{track.artist}` remains in the four recommendation surfaces
  (Home cards, Home list rows, Explore rows/lists, Search rows).
- Live JioSaavn API sampled for shapes used by the fix (`search.getResults`,
  `song.getDetails`).
- Running app inspected for card text, audio element state, `AudioContext`
  count and console errors.
