# MelodyMap Android QA — v1.0.7 (versionCode 8)

Manual test checklist for the v1.0.7 APK build. Run top-to-bottom on at least one
primary device; add rows per extra device in the results log at the bottom.

**Build under test:** `android/app/build/outputs/apk/debug/app-debug.apk` (versionCode 8, versionName 1.0.7)
**Companion web deploy:** https://melodymap-pi.vercel.app (must be the v1.0.7 deploy)

**What changed in this build**
- Songs that YouTube refuses (bot-block) now fall back to **full-length Audius streams** before the 30-second Deezer preview (server-side).
- Resolve failures back off **per track** — one bad song can no longer freeze every other song (old global circuit breaker removed).
- The JS auto-resume watchdog is disabled inside the APK — the native service owns background state (prevents play/pause fight from returning).
- Native audio-focus handling: manual pauses are never auto-resumed by a stale focus flag; duplicate focus-loss callbacks are debounced (500 ms).
- App relaunch after background process death restores the **saved position** (clamped: restarts at 0:00 if < 5 s or within the last 15 s).

---

## 1. Streaming & full-length playback

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 1.1 | Mainstream track plays full-length | Play a popular/commercial track | Song plays past 0:30 to the end; no cutoff at 0:30 |
| 1.2 | Fallback chain transparent | Play several tracks back-to-back (10+) | Tracks keep playing; no "Audio connection interrupted" storms |
| 1.3 | Track changes cleanly | Let 2–3 songs auto-advance | Next track starts within ~5 s; no long silent gaps |
| 1.4 | Cold start load time | First play after app kill | Track starts within ~8 s (resolver is fastest path, no probe delays) |
| 1.5 | Scrubbing mid-song | Seek to 50%, 90% | Seek lands, playback continues; position bar matches audio |
| 1.6 | Bad/network recovery | Enable airplane mode 10 s mid-song, disable | Reconnect banner appears, playback resumes near same position |

## 2. Background playback (screen off / app switch)

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 2.1 | Screen-off continuity | Start playback, lock screen 3 min | Audio keeps playing; notification shows correct track + progress |
| 2.2 | Notification pause | Pause from notification, wait 1 min | Stays paused; NO play/pause cycling in the notification |
| 2.3 | Notification resume | Play from notification after 2.1 | Resumes near where it paused; audio audible |
| 2.4 | Headset buttons | Plug wired/BT headset, press play/pause/next | Each press acts once (no double actions, no cycling) |
| 2.5 | Headphone unplug | Unplug headset mid-playback | Pauses within ~2 s; does not resume by itself |
| 2.6 | Interruption by call | Receive a call during playback | Pauses during call; after call ends, stays paused (v1.0.7 change: no auto-resume after full focus loss) |
| 2.7 | Alarm/navigation ducking | Trigger a short transient sound during playback | May pause briefly and auto-resume (transient loss); must NOT cycle repeatedly |
| 2.8 | Other music app | Start Spotify while MelodyMap is playing | MelodyMap pauses and stays paused |
| 2.9 | Long session stability | Background play 30+ min on Wi-Fi | No silence-with-animation; no notification state flicker |
| 2.10 | Mobile data session | Background play 10 min on cellular | Same as 2.9; no mid-song drop loops |

## 3. Restore & queue continuity

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 3.1 | Mid-song app relaunch | Play to ~1:30, kill app (swipe away), reopen | Player shows same track; pressing play resumes near 1:30 (not 0:00) |
| 3.2 | Near-start relaunch | Kill app in first 4 s of a song, reopen | Restarts at 0:00 |
| 3.3 | Near-end relaunch | Kill app in last 10 s, reopen | Restarts at 0:00 |
| 3.4 | Queue survives relaunch | With 5+ queued songs, kill and reopen | Queue order preserved; next-track works |
| 3.5 | AutoDJ refill | Start playback with empty/small queue, screen off | Upcoming songs auto-populate; playback continues for 30+ min |
| 3.6 | Podcast resume | Play a podcast to 10:00, relaunch app | Resumes at ~10:00 (unchanged podcast behavior) |

## 4. UI / audio-truth

| # | Case | Steps | Expected |
|---|------|-------|----------|
| 4.1 | Animation matches audio | Pause/resume repeatedly from app UI | Animation and sound always agree (no silent "playing" state) |
| 4.2 | Foreground return | Background 5 min playing, reopen app | Same track still playing; position continuous; no restart at 0:00 |
| 4.3 | Equalizer/quality change mid-song | Toggle audio quality in settings while playing | Stream swaps without stopping or position jump |

## Results log

| Device | Android version | Build | Section | Pass/Fail | Notes |
|--------|-----------------|-------|---------|-----------|-------|
| Pixel (primary) | — | 1.0.7 (8) | 1 | | |
| Pixel (primary) | — | 1.0.7 (8) | 2 | | |
| Pixel (primary) | — | 1.0.7 (8) | 3 | | |
| Pixel (primary) | — | 1.0.7 (8) | 4 | | |
| Samsung | — | 1.0.7 (8) | | | |
| Xiaomi/Oppo | — | 1.0.7 (8) | | | |

## Known limitations (not bugs)

- **30-second Deezer previews** may still occur for tracks with no Audius/Jamendo equivalent — the song will end at 0:30 by design of the fallback catalog.
- After background **process death** (OEM battery killer), a cold reload is unavoidable; position restore covers the content, but the WebView must reload.
- YouTube's bot-blocking is intermittent by IP; full-length streams may come and go across deploys. The fallback chain masks this but cannot create streams YouTube refuses to serve.
- Xiaomi/Oppo/Vivo aggressive battery savers can still kill the WebView; the battery-optimization prompt (once per install) mitigates it — approve it when asked.
