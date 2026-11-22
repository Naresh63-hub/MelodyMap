# MelodyMap Recommendation Experiments & Feature Flags Guide

This document defines the experimentation framework, telemetry measurement protocol, and complete catalog of recommendation feature flags in MelodyMap.

All recommendation experiments are managed on-device via `src/lib/rec-flags.ts` and surface through the developer-gated Settings section (unlocked by tapping the app version 7 times in Settings).

---

## 1. Experimentation Principles & Hygiene

1. **One Flag at a Time**: Never enable multiple experimental flags simultaneously. Running multiple experiments confluates reward shifts, feature weights, and candidate distributions.
2. **Control for Weekday Variance**: Listening behavior differs drastically between weekdays (focused, routine, commuter listening) and weekends (exploratory, leisure, social listening). Always compare matching weekdays (e.g., Tuesday–Thursday of Week A vs. Tuesday–Thursday of Week B) on the same device.
3. **Verify Configuration Purity with `configChangedAt`**: Every change to a flag or $\gamma$ (discount factor) records an ISO timestamp under `melodymap.rec_config_changed_at`. The metrics export JSON includes this timestamp. Always verify that `configChangedAt` precedes the start of the evaluation window so no mid-window switches invalidate the test.
4. **Primary Evaluation Metrics**:
   - **Early-Skip Rate (<10s)**: $\frac{\text{earlySkips}}{\text{starts}}$ — the primary dissatisfaction metric. A lower rate indicates immediate relevance.
   - **Completion Rate**: $\frac{\text{completions}}{\text{starts}}$ — the primary satisfaction metric. A higher rate indicates deep engagement.
   - **Attribution Surfaces**: Metrics are segregated by source tag (`autodj-radio`, `autodj-taste`, `made-for-you`, `daily-mix`, `search`, `library`, `offline-mix`, `unknown`). Measure impact specifically on the targeted source surface.
5. **Statistical Threshold & Revert Rule**:
   - Minimum sample size: $\ge 50$ starts per surface before drawing conclusions.
   - **Immediate Revert Trigger**: If early-skip rate increases by $\ge 3.0$ percentage points, or completion rate drops by $\ge 5.0$ percentage points compared to the baseline period over $\ge 50$ starts, turn the flag OFF immediately.

---

## 2. Complete Catalog of Feature Flags

### 1. `singlePassRanking`
* **Default Value**: `true` (shipped as baseline)
* **Storage Key**: `melodymap.flag.singlePassRanking`
* **Description**: Ranks the accumulated AutoDJ candidate pool in a single Thompson Sampling pass rather than ranking per-page during seed expansion.
* **What It Changes**:
  - Located in `extendQueue` in `src/routes/index.tsx`.
  - When `true`, candidates gathered from multiple recent seeds (last 3 unique tracks in queue) are pooled, deduplicated, and ranked collectively with a single posterior weight draw $w^* \sim \mathcal{N}(\mu, v^2 B^{-1})$.
  - When `false`, falls back to per-page greedy ranking where candidates are scored in isolated chunks of 10.
* **How to Measure**:
  - Focus on `autodj-radio` early-skip rate and completion rate.
  - Baseline: 7-day frozen baseline with `singlePassRanking = true`. To measure the effect of the refactor vs legacy, set to `false` for matching weekdays.
* **Revert Criteria**: Revert to `false` if `autodj-radio` early-skip rate increases by $\ge 3\%$ or completion rate drops by $\ge 5\%$.

---

### 2. `trainOnFullTrack`
* **Default Value**: `true` (shipped as baseline)
* **Storage Key**: `melodymap.flag.trainOnFullTrack`
* **Description**: Supplies full track metadata to the bandit learner during training instead of minimal stubs.
* **What It Changes**:
  - Located in `src/lib/telemetry.ts` and `src/lib/bandit-policy.ts`.
  - When `true`, terminal telemetry events pull cached full track metadata (`stats[trackId].track`), ensuring that language, album, movie flags, duration, and artist tags match the metadata used at candidate ranking time.
  - When `false`, constructs an ad-hoc track stub containing only `id`, `title`, and `artist`, causing candidate-dependent features to evaluate to zeroes during training updates.
* **How to Measure**:
  - Evaluates bandit weight stability and early-skip rate across all bandit-driven surfaces (`made-for-you`, `autodj-radio`).
  - Compare session-first-5-track skip rates.
* **Revert Criteria**: Revert to `false` only if weight vector norms explode or numerical instabilities arise in matrix $B$.

---

### 3. `leakFreeTrainingContext`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.leakFreeTrainingContext`
* **Description**: Rewinds predecessor track and strips post-event session mutations to prevent target leakage during bandit updates.
* **What It Changes**:
  - Located in `src/lib/bandit-context.ts` (`buildTrainingContext`).
  - When `true`, constructs a synthetic `SessionContext` reconstructing the user state immediately *before* the played track was queued:
    - Predecessor track is set to the track played prior to this event (rather than the track itself).
    - Session history and cumulative counters exclude the current event.
    - Energy envelope reflects pre-play session trajectory.
  - When `false`, uses the live `SessionContext` at terminal event time, which already contains the completed track as the current track and includes the event's own count in session statistics.
* **How to Measure**:
  - Surface: `autodj-radio` and `made-for-you`.
  - Measure over 7 days (e.g., Week 2 vs Week 1 baseline). Compare early-skip rate on AutoDJ transition tracks.
* **Revert Criteria**: Revert if early-skip rate on `autodj-radio` increases by $\ge 3\%$ or completion rate decreases by $\ge 5\%$.

---

### 4. `languageFeature`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.languageFeature`
* **Description**: Activates coordinate $x_5$ in the 8-dimensional bandit feature vector as pure candidate language coherence.
* **What It Changes**:
  - Located in `src/lib/bandit-policy.ts` (`extractFeatures`).
  - When `true`, uses `getTrackLanguage(candidate)` from `src/lib/language-artists.ts` to compute exact match against `context.preferredLanguages` and recent session listening languages, outputting a normalized $[0, 1]$ coherence score.
  - Triggers a one-time migration that zeros coordinate 5 in the stored $B$ matrix and $f$ vector (marked via `melodymap.rec_x5_reset_done.v1`) to purge legacy unnormalized values.
  - When `false`, coordinate $x_5$ evaluates to `0.0`.
* **How to Measure**:
  - Surface: `made-for-you`, `daily-mix`, and `autodj-radio` in bilingual/multilingual user accounts (e.g., Telugu + Hindi + English).
  - Metric: Early-skip rate on tracks of preferred languages, and `languageFeatureStd` in the exported metrics JSON (higher spread indicates active discrimination).
* **Revert Criteria**: Revert if multi-language listeners experience $\ge 4\%$ increase in early skips due to sudden language clustering.

---

### 5. `artistRecentSkipFeature`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.artistRecentSkipFeature`
* **Description**: Activates coordinate $x_6$ in the bandit feature vector, signaling rolling artist skip health over the last 10 plays.
* **What It Changes**:
  - Located in `src/lib/artist-recent.ts` and `src/lib/bandit-policy.ts`.
  - When `true`, queries an in-memory bounded LRU store (`ArtistRecentStore`) recording the last 10 playback outcomes per artist:
    $$\text{score} = 1.0 - \frac{\text{recentSkips}}{\text{recentPlays} + 1}$$
    If an artist has been skipped repeatedly in the active session, their candidate score is heavily penalized.
  - When `false`, coordinate $x_6$ evaluates to `0.0`.
* **How to Measure**:
  - Surface: Continuous `autodj-radio` sessions.
  - Check whether repeated skips of a specific artist successfully suppress that artist in subsequent queue extensions.
  - Metric: Early skips following an initial skip of the same artist within the same session.
* **Revert Criteria**: Revert if users skip fewer unique artists but overall completion rate falls by $\ge 5\%$ due to overly aggressive artist blacklisting.

---

### 6. `noveltyMomentumFeature`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.noveltyMomentumFeature`
* **Description**: Activates coordinate $x_7$ in the bandit feature vector as an interaction term: Candidate Unfamiliarity $\times$ Session Momentum.
* **What It Changes**:
  - Located in `src/lib/bandit-policy.ts`.
  - When `true`, multiplies candidate novelty ($1.0 - \text{familiarity}$) by the user's current session completion streak / completion momentum. When a user has completed several songs in a row without skipping, unfamiliar songs receive a boost; when the user is skipping frequently, familiar songs are favored.
  - When `false`, coordinate $x_7$ evaluates to `0.0`.
* **How to Measure**:
  - Surfaces: `autodj-radio` and `made-for-you`.
  - Metric: Completion rate on previously unplayed tracks (novelty discovery completion rate).
* **Revert Criteria**: Revert if early-skip rate on unfamiliar tracks during positive sessions fails to improve, or if overall session length shortens.

---

### 7. `movieTieBreaker`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.movieTieBreaker`
* **Description**: Restricts movie/soundtrack preference in AutoDJ ranking to an $\epsilon$-tie-breaker rather than an absolute sorting priority.
* **What It Changes**:
  - Located in `src/lib/bandit-policy.ts` (`sortByScoreWithMovieTieBreaker`) and `src/routes/index.tsx`.
  - When `true`, candidates whose predicted rewards fall within 10% of the top candidate's score ($\Delta \le 0.10 \times (\text{maxScore} - \text{minScore})$) are tie-broken by favoring movie/soundtrack tracks. Candidates outside this margin are strictly ranked by bandit score.
  - When `false`, candidate order strictly adheres to raw sampled posterior score $w^{*T} x$.
* **How to Measure**:
  - Surface: `autodj-radio`.
  - Metric: Compare completion rate of non-movie vs movie tracks in cinematic/regional repertoires (e.g. Tollywood, Bollywood) where movie metadata is prevalent.
* **Revert Criteria**: Revert if AutoDJ becomes repetitive with movie album tracks or early skips increase by $\ge 3\%$.

---

### 8. `tasteArtistMix`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.tasteArtistMix`
* **Description**: Interleaves tracks from the user's top liked/downloaded artists into continuous AutoDJ queue extensions based on the discovery slider.
* **What It Changes**:
  - Located in `src/lib/autodj-taste-mix.ts` and `src/routes/index.tsx`.
  - When `true`, dynamically computes the user's top 5 taste artists from library likes and downloads. AutoDJ injects $\sim 1$ in 3 tracks (modulated by discovery ratio: $1 - 0.5 \times \text{discoveryRatio}$) from taste artist radios, tagging them with `source: autodj-taste`.
  - When `false`, AutoDJ draws candidates strictly from recent seed song radio (`autodj-radio`).
* **How to Measure**:
  - Surfaces: Compare `autodj-taste` vs `autodj-radio`.
  - Metrics: Completion rate and like rate on `autodj-taste` tracks compared to `autodj-radio`. `autodj-taste` completion rate is expected to be $\ge$ baseline `autodj-radio`.
* **Revert Criteria**: Revert if `autodj-taste` early-skip rate is worse than `autodj-radio` by $\ge 3\%$ or if users complain about queue predictability.

---

### 9. `languageQuotas`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.languageQuotas`
* **Description**: Proportional quota allocation for multi-language feed queries and candidate recommendations using Hare-Niemeyer largest-remainder allocation.
* **What It Changes**:
  - Located in `src/lib/language-quotas.ts`, `src/lib/music.functions.ts`, and `src/routes/index.tsx`.
  - When `true`, feeds (`Made For You`, `Daily Mix`, explore queries) allocate candidate slots proportionally to preferred language weights:
    - Guaranteed minimum of 1 slot per configured language.
    - Uses ~1.5x over-fetch buffer to ensure minority language candidates survive deduplication and freshness filtering.
  - When `false`, feeds use equal unweighted slicing or legacy single-language dominant queries.
* **How to Measure**:
  - Surface: `made-for-you` and `daily-mix` for multilingual users.
  - Metric: Starts and completions across all configured languages; confirm zero minority language starvation.
* **Revert Criteria**: Revert if feed load latency increases significantly or if majority language listeners skip minority language recommendations at rates $> 25\%$.

---

### 10. `webAudioEq`
* **Default Value**: `false`
* **Storage Key**: `melodymap.flag.webAudioEq`
* **Description**: Routes playback through a 10-band Web Audio `BiquadFilterNode` equalizer graph and implements gain crossfading on HTML5 audio. The equalizer works only for same-origin (e.g. stream proxy `/api/stream/*`), offline (`blob:*`), and CORS-enabled sources (`Access-Control-Allow-Origin: *` like Audius). Sources lacking CORS headers bypass the Web Audio graph and play directly through HTML5 audio to prevent browser silence.
* **What It Changes**:
  - Located in `src/lib/web-audio-equalizer.ts`, `src/hooks/use-audio-player.ts`, and `src/components/music/EqualizerModal.tsx`.
  - When `true`:
    - Ensures `audio.crossOrigin = "anonymous"` is configured strictly before `audio.src` is assigned whenever the graph is used.
    - Connects `<audio>` element to a 10-band filter cascade (31Hz lowshelf, 62Hz–8kHz peaking, 16kHz highshelf) plus preamp gain.
    - Inspects CDN source origin with `isSourceWebAudioEligible` against measured CORS results (checked against `Origin: https://melodymap-pi.vercel.app`). If an unproxied source lacks CORS headers, cleanly bypasses the Web Audio graph to prevent silence while raising a user notice.
    - Permanent `MediaElementAudioSourceNode` creation prevents browser IllegalState errors.
    - Android WebView `visibilitychange` listener resumes suspended `AudioContext` on app foregrounding.
    - Applies equal-power gain curves for track start fade-in and track end fade-out.
  - When `false`: Direct HTML5 audio playback with zero Web Audio processing.
* **How to Measure**:
  - Verification: Manual playback listening on desktop Chrome/Firefox and Android WebView.
  - Verify no audio cutouts or stutters during track transitions.
  - Verify background playback continues uninterrupted when phone screen is locked.
* **Revert Criteria**: Revert immediately if audio fails to play on Android WebView, if background audio is killed by Android OS, or if CORS silence is encountered.

---

## 3. Step-by-Step Guide for Running a Weekly Experiment

1. **Baseline Phase (Week 1)**:
   - Ensure all experimental flags are in their default state (`false` except `singlePassRanking` and `trainOnFullTrack`).
   - Listen to music normally for 7 days.
   - At the end of Day 7, open Settings $\to$ Export Rec Metrics JSON $\to$ Save as `baseline_week1.json`.
2. **Experimental Phase (Week 2)**:
   - Unlock developer controls: Tap version number 7 times in Settings.
   - Enable **exactly one** flag under test (e.g., `tasteArtistMix`).
   - Confirm `configChangedAt` updates.
   - Listen to music normally for 7 days.
   - At the end of Day 7, open Settings $\to$ Export Rec Metrics JSON $\to$ Save as `experiment_flagname_week2.json`.
3. **Comparison & Evaluation**:
   - Compare matching weekdays (e.g., Week 1 Mon–Fri vs. Week 2 Mon–Fri).
   - Compute metrics for the target surface:
     $$\Delta \text{EarlySkip} = \text{EarlySkip}_{\text{exp}} - \text{EarlySkip}_{\text{base}}$$
     $$\Delta \text{Completion} = \text{Completion}_{\text{exp}} - \text{Completion}_{\text{base}}$$
   - If $\Delta \text{EarlySkip} \le 0$ and $\Delta \text{Completion} \ge 0$, the experiment is a success.
   - If $\Delta \text{EarlySkip} \ge +3\%$ or $\Delta \text{Completion} \le -5\%$, revert the flag.
