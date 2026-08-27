---
kind: external_dependency
name: YouTube (unofficial API scraping & stream proxy)
slug: youtube
category: external_dependency
category_hints:
    - framework_behavior
    - client_constraint
scope:
    - '**'
---

### YouTube
- Role: Primary music source. The app scrapes YouTube search results (`/results?search_query=...`) and resolves direct audio streams via the internal player endpoint (`youtubei/v1/player`).
- Stream resolution: `stream.server.ts.resolveStreamUrl` retries across Android/iOS client configs, picks the best audio-only format (itag 140 m4a preferred), and probes each URL with a Range request before returning it; age-restricted, members-only, and region-blocked videos are skipped.
- Radio: `radio.server.ts.getRadioTracks` calls `youtubei/v1/next` with playlistId `RD<videoId>` to fetch YouTube's built-in radio recommendations.
- Search: `music.server.ts.searchYouTube` parses `ytInitialData` from the HTML response and filters out non-music content via title heuristics.
- Constraint: No official API key is used; all calls rely on public endpoints and spoofed User-Agent/client contexts, so they may break if YouTube changes its response shape.