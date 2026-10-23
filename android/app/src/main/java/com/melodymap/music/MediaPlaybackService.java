package com.melodymap.music;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.net.wifi.WifiManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.os.SystemClock;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;

import org.json.JSONObject;

/**
 * Foreground media service for Spotify-style background playback.
 *
 * The web player drives it through {@link PlaybackBridge}:
 *  - ACTION_PLAY    → show/update the media notification with real track info,
 *                     hold wake/wifi locks, request audio focus, activate the
 *                     MediaSession (lockscreen + headset + notification controls).
 *  - ACTION_PAUSE   → mark paused, release locks, stop foreground after a
 *                     30-second grace period if the user never resumes.
 *  - ACTION_STOP    → tear everything down immediately.
 *  - ACTION_UPDATE_POSITION → refresh the lockscreen progress bar (throttled
 *                     to ~5s by the JS side).
 *
 * Media button events (notification actions, lockscreen, headset) arrive here
 * and are forwarded into the WebView player via
 * {@code window.__melodymap_media_command} — the web player remains the single
 * source of truth for the queue.
 */
public class MediaPlaybackService extends Service {
    public static final String ACTION_START = "com.melodymap.music.action.START";
    public static final String ACTION_PLAY = "com.melodymap.music.action.PLAY";
    public static final String ACTION_PAUSE = "com.melodymap.music.action.PAUSE";
    public static final String ACTION_STOP = "com.melodymap.music.action.STOP";
    public static final String ACTION_UPDATE_POSITION = "com.melodymap.music.action.UPDATE_POSITION";
    public static final String ACTION_NEXT = "com.melodymap.music.action.NEXT";
    public static final String ACTION_PREV = "com.melodymap.music.action.PREV";
    public static final String ACTION_LIKE = "com.melodymap.music.action.LIKE";
    public static final String ACTION_UPDATE_LIKED = "com.melodymap.music.action.UPDATE_LIKED";
    public static final String CUSTOM_ACTION_LIKE = "com.melodymap.music.action.CUSTOM_LIKE";
    public static final String CUSTOM_ACTION_PREV = "com.melodymap.music.action.CUSTOM_PREV";

    public static final String EXTRA_PAYLOAD = "payload";
    public static final String EXTRA_POSITION = "position";
    public static final String EXTRA_LIKED = "liked";

    public static final String CHANNEL_ID = "melodymap_media_playback";
    public static final int NOTIFICATION_ID = 1001;

    /** How long a paused session keeps its notification before cleaning up. */
    private static final long PAUSED_STOP_GRACE_MS = 30_000L;

    /**
     * Guards the lock-screen Like/Unlike button against accidental duplicate taps.
     * A rapid double tap must not queue two library writes. The window is tracked
     * per track id, so skipping to the next song makes its heart instantly usable.
     */
    private static final long LIKE_TAP_DEBOUNCE_MS = 400L;

    private PowerManager.WakeLock wakeLock;
    private WifiManager.WifiLock wifiLock;
    private MediaSessionCompat mediaSession;
    private AudioManager audioManager;
    private AudioFocusRequest audioFocusRequest;
    private AudioManager.OnAudioFocusChangeListener focusChangeListener;
    private BroadcastReceiver noisyReceiver;
    private final Handler graceStopHandler = new Handler(Looper.getMainLooper());
    private final Runnable graceStopRunnable = this::graceStopIfStillPaused;

    // Last known playback info (survives service restarts for re-notification).
    private String trackId = "";
    private String trackTitle = "";
    private String trackArtist = "";
    private double trackDurationSec = 0;
    private double trackPositionSec = 0;
    private boolean isJsPlaying = false;
    private boolean isTrackLiked = false;
    private long lastLikeTapAt = 0L;
    private boolean resumeOnFocusGain = false;
    private long lastFocusLossAt = 0;
    private String lastLikeTrackId = "";

    private static final long FOCUS_LOSS_DEBOUNCE_MS = 500;
    private boolean started = false;

    private static volatile boolean isRunning = false;

    public static boolean isServiceRunning() {
        return isRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        ensureMediaSession();
        registerNoisyReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // stopForegroundService() releases the session and nulls it. If a fresh intent
        // is delivered to this same (not yet destroyed) service instance, onCreate()
        // never runs again -- without this the MediaSession would stay null and the
        // lock-screen controls (including the Like custom action) would silently
        // disappear for the rest of the process lifetime.
        ensureMediaSession();

        String action = intent != null ? intent.getAction() : null;
        if (action == null) {
            // Sticky restart (e.g. process death): re-show with last known info.
            handlePlay(null);
            return START_STICKY;
        }

        switch (action) {
            case ACTION_STOP:
                stopForegroundService();
                return START_NOT_STICKY;
            case ACTION_PLAY:
                if (intent == null || !intent.hasExtra(EXTRA_PAYLOAD)) {
                    dispatchMediaCommand("play");
                }
                handlePlay(intent != null ? intent.getStringExtra(EXTRA_PAYLOAD) : null);
                break;
            case ACTION_PAUSE:
                if (intent == null || !intent.hasExtra(EXTRA_PAYLOAD)) {
                    dispatchMediaCommand("pause");
                }
                handlePause();
                break;
            case ACTION_UPDATE_POSITION:
                if (intent != null && intent.hasExtra(EXTRA_POSITION)) {
                    trackPositionSec = intent.getDoubleExtra(EXTRA_POSITION, trackPositionSec);
                    refreshMediaSession();
                    updateNotification();
                }
                break;
            case ACTION_NEXT:
                dispatchMediaCommand("next");
                break;
            case ACTION_PREV:
                dispatchMediaCommand("prev");
                break;
            case ACTION_LIKE:
                handleLikeTap();
                break;
            case ACTION_UPDATE_LIKED:
                if (intent != null && intent.hasExtra(EXTRA_LIKED)) {
                    isTrackLiked = intent.getBooleanExtra(EXTRA_LIKED, isTrackLiked);
                    refreshMediaSession();
                    updateNotification();
                }
                break;
            case ACTION_START:
            default:
                handlePlay(intent != null ? intent.getStringExtra(EXTRA_PAYLOAD) : null);
                break;
        }
        return START_STICKY;
    }

    // ─── Playback-state handling ─────────────────────────────────────────

    private void handlePlay(String payloadJson) {
        applyPayload(payloadJson);
        isJsPlaying = true;
        resumeOnFocusGain = false;
        cancelGraceStop();
        // Re-assert ownership: the session can be dropped by the framework after a
        // focus loss / inactive period, and the SystemUI media player only renders
        // PlaybackState custom actions for an active session.
        try {
            if (mediaSession != null && !mediaSession.isActive()) {
                mediaSession.setActive(true);
            }
        } catch (Exception ignored) {}

        // Publish the MediaSession state FIRST. On Android 13+ (this app targets
        // API 36) SystemUI derives the whole media panel — including the custom
        // Like action — from PlaybackState, so the notification must never be
        // posted ahead of the state it is meant to advertise.
        acquireLocks();
        refreshMediaSession();

        if (!started) {
            startForegroundWithNotification();
            started = true;
        } else {
            updateNotification();
        }
        isRunning = true;
    }

    private void handlePause() {
        isJsPlaying = false;
        // A real pause (user, notification, headset, or focus loss) must never be
        // silently auto-resumed later by a stale transient-focus-loss flag.
        resumeOnFocusGain = false;
        refreshMediaSession();
        updateNotification();
        releaseLocks();
        graceStopHandler.postDelayed(graceStopRunnable, PAUSED_STOP_GRACE_MS);
    }

    private void graceStopIfStillPaused() {
        if (!isJsPlaying) {
            stopForegroundService();
        }
    }

    private void cancelGraceStop() {
        graceStopHandler.removeCallbacks(graceStopRunnable);
    }

    private void applyPayload(String payloadJson) {
        if (payloadJson == null || payloadJson.isEmpty()) return;
        try {
            JSONObject payload = new JSONObject(payloadJson);
            // Track identity first: a track change must clear the Like debounce so the
            // new song's heart is tappable immediately.
            String newId = payload.optString("id", trackId);
            if (newId == null) newId = "";
            if (!newId.equals(trackId)) {
                trackId = newId;
                lastLikeTapAt = 0;
                lastLikeTrackId = "";
            }
            trackTitle = payload.optString("title", trackTitle);
            trackArtist = payload.optString("artist", trackArtist);
            trackDurationSec = payload.optDouble("duration", trackDurationSec);
            if (payload.has("position")) {
                trackPositionSec = payload.optDouble("position", trackPositionSec);
            }
            if (payload.has("liked")) {
                isTrackLiked = payload.optBoolean("liked", isTrackLiked);
            }
            if (!payload.isNull("id")) {
                trackTitle = trackTitle == null || trackTitle.isEmpty()
                        ? payload.optString("id", "MelodyMap")
                        : trackTitle;
            }
        } catch (Exception ignored) {
            // Malformed payload: keep previous metadata.
        }
    }

    // ─── MediaSession ────────────────────────────────────────────────────

    private void ensureMediaSession() {
        if (mediaSession != null) return;
        try {
            mediaSession = new MediaSessionCompat(this, "MelodyMapMediaSession");
            mediaSession.setFlags(
                    MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS
                            | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS);
            mediaSession.setCallback(new MediaSessionCompat.Callback() {
                @Override
                public void onPlay() {
                    dispatchMediaCommand("play");
                }

                @Override
                public void onPause() {
                    dispatchMediaCommand("pause");
                }

                @Override
                public void onSkipToNext() {
                    dispatchMediaCommand("next");
                }

                @Override
                public void onSkipToPrevious() {
                    dispatchMediaCommand("prev");
                }

                @Override
                public void onSeekTo(long pos) {
                    dispatchMediaCommand("seek:" + (pos / 1000.0));
                }

                @Override
                public void onStop() {
                    dispatchMediaCommand("stop");
                }

                @Override
                public void onCustomAction(String action, android.os.Bundle extras) {
                    if (CUSTOM_ACTION_LIKE.equals(action) || "like".equalsIgnoreCase(action) || "toggle_like".equalsIgnoreCase(action)) {
                        handleLikeTap();
                    } else if (CUSTOM_ACTION_PREV.equals(action) || "prev".equalsIgnoreCase(action)) {
                        // Previous was demoted out of the compact transport slot to make
                        // room for the Like button; it still reaches us as a custom action
                        // from the expanded notification (slot 4) and must keep working.
                        dispatchMediaCommand("prev");
                    }
                }
            });
            mediaSession.setActive(true);
            refreshMediaSession();
        } catch (Exception ignored) {}
    }

    private void refreshMediaSession() {
        if (mediaSession == null) return;
        try {
            MediaMetadataCompat.Builder metaBuilder = new MediaMetadataCompat.Builder();
            if (trackTitle != null && !trackTitle.isEmpty()) {
                metaBuilder.putString(MediaMetadataCompat.METADATA_KEY_TITLE, trackTitle);
            }
            if (trackArtist != null && !trackArtist.isEmpty()) {
                metaBuilder.putString(MediaMetadataCompat.METADATA_KEY_ARTIST, trackArtist);
            }
            metaBuilder.putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "MelodyMap");
            if (trackDurationSec > 0) {
                metaBuilder.putLong(
                        MediaMetadataCompat.METADATA_KEY_DURATION,
                        (long) (trackDurationSec * 1000L));
            }
            mediaSession.setMetadata(metaBuilder.build());

            // Compact lock-screen layout experiment (branch experiment/lockscreen-like-slot):
            // Android 13+ renders only the FIRST THREE PlaybackState slots on the lock
            // screen (slot 1 = Play/Pause, slot 2 = Previous, slot 3 = Next); custom
            // actions overflow to slots 4-5, which compact mode hides. That is why the
            // heart never appeared before. Per the official media-controls documentation,
            // slot 2 falls back to the first *unplaced custom action* when
            // ACTION_SKIP_TO_PREVIOUS is NOT advertised. So we deliberately omit
            // ACTION_SKIP_TO_PREVIOUS and register Like as the first custom action: the
            // heart is promoted into the compact "back" slot -> [Like][Play/Pause][Next].
            // Previous is registered as the SECOND custom action, landing in slot 4, so it
            // stays reachable from the expanded notification (and in-app) while being
            // omitted from the compact row by design. This is fully reversible: restoring
            // ACTION_SKIP_TO_PREVIOUS and dropping prevCustomAction returns the old layout.
            PlaybackStateCompat.CustomAction likeCustomAction = new PlaybackStateCompat.CustomAction.Builder(
                    CUSTOM_ACTION_LIKE,
                    isTrackLiked ? "Unlike" : "Like",
                    isTrackLiked ? R.drawable.ic_heart_like : R.drawable.ic_heart_unlike)
                    .setExtras(new android.os.Bundle())
                    .build();
            PlaybackStateCompat.CustomAction prevCustomAction = new PlaybackStateCompat.CustomAction.Builder(
                    CUSTOM_ACTION_PREV,
                    "Previous",
                    R.drawable.ic_skip_previous)
                    .setExtras(new android.os.Bundle())
                    .build();

            int state = isJsPlaying
                    ? PlaybackStateCompat.STATE_PLAYING
                    : PlaybackStateCompat.STATE_PAUSED;
            float speed = isJsPlaying ? 1.0f : 0f;
            PlaybackStateCompat playbackState = new PlaybackStateCompat.Builder()
                    .setActions(
                            PlaybackStateCompat.ACTION_PLAY
                                    | PlaybackStateCompat.ACTION_PAUSE
                                    | PlaybackStateCompat.ACTION_PLAY_PAUSE
                                    | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
                                    | PlaybackStateCompat.ACTION_SEEK_TO
                                    | PlaybackStateCompat.ACTION_STOP)
                    .addCustomAction(likeCustomAction)
                    .addCustomAction(prevCustomAction)
                    .setState(state, (long) (trackPositionSec * 1000L), speed,
                            SystemClock.elapsedRealtime())
                    .build();
            mediaSession.setPlaybackState(playbackState);
        } catch (Exception ignored) {}
    }

    // ─── Notification ────────────────────────────────────────────────────

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "MelodyMap Playback",
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription("Media controls for music playing in the background");
            channel.setShowBadge(false);
            channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }

    private PendingIntent serviceActionIntent(String action) {
        Intent intent = new Intent(this, MediaPlaybackService.class);
        intent.setAction(action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getService(this, action.hashCode(), intent, flags);
    }

    private void startForegroundWithNotification() {
        try {
            Notification notification = buildNotification();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            // Defense-in-depth: keep foreground running cleanly even on abnormal OEM notification parser errors
        }
    }

    private void updateNotification() {
        if (!started) {
            startForegroundWithNotification();
            started = true;
            return;
        }
        try {
            NotificationManager manager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (manager != null) {
                manager.notify(NOTIFICATION_ID, buildNotification());
            }
        } catch (Exception ignored) {
            // A failed in-place update must never break playback.
        }
    }

    private Notification buildNotification() {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent contentIntent = PendingIntent.getActivity(
                this, 0, launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);

        String title = trackTitle == null || trackTitle.isEmpty() ? "MelodyMap" : trackTitle;
        String text = trackArtist == null || trackArtist.isEmpty()
                ? (isJsPlaying ? "Playing" : "Paused")
                : trackArtist;

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                .setSmallIcon(R.drawable.ic_stat_melodymap)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(
                        isTrackLiked ? R.drawable.ic_heart_like : R.drawable.ic_heart_unlike,
                        isTrackLiked ? "Unlike" : "Like",
                        serviceActionIntent(ACTION_LIKE))
                .addAction(R.drawable.ic_skip_previous, "Prev", serviceActionIntent(ACTION_PREV))
                .addAction(
                        isJsPlaying ? R.drawable.ic_pause : R.drawable.ic_play,
                        isJsPlaying ? "Pause" : "Play",
                        serviceActionIntent(isJsPlaying ? ACTION_PAUSE : ACTION_PLAY))
                .addAction(R.drawable.ic_skip_next, "Next", serviceActionIntent(ACTION_NEXT));

        if (mediaSession != null) {
            // Notification actions are added in this order:
            //   0 = Like/Unlike, 1 = Previous, 2 = Play/Pause, 3 = Next
            //
            // Two rendering paths exist and both are covered here:
            //
            //  * Android 13+ (this app targets API 36): SystemUI builds the media
            //    panel from the session PlaybackState, NOT from these notification
            //    actions. Preview/Next claim slots 2-3, so the Like custom action
            //    lands in slot 4 of the 5 available slots:
            //    [ Prev ] [ Play/Pause ] [ Next ] [ Like ] [ 5th slot ]
            //
            //  * Legacy path: the notification action row is used, and
            //    setShowActionsInCompactView() picks at most THREE indices for the
            //    collapsed/compact layout. Passing more than three throws
            //    IllegalArgumentException, so exactly three are passed: Like (0),
            //    Play/Pause (2), Next (3).
            //
            // Keeping the Like action at index 0 is what guarantees it appears in
            // the compact layout on the legacy path.
            builder.setStyle(new MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 2, 3));
        }
        return builder.build();
    }

    // ─── Media button dispatch into the WebView player ──────────────────

    /** @return true when the command actually reached the WebView player. */
    private boolean dispatchMediaCommand(String command) {
        MainActivity activity = MainActivity.getInstance();
        if (activity == null) return false;
        return activity.dispatchMediaCommand(command);
    }

    /**
     * Lock-screen / notification Like/Unlike tap.
     *
     * <p>Three guarantees, in order:
     * <ol>
     *   <li>No identifiable track means no action -- the tap is dropped instead of
     *       guessing which song the user meant.</li>
     *   <li>Repeated taps on the same track inside {@link #LIKE_TAP_DEBOUNCE_MS} are
     *       ignored, so a double tap cannot write the library twice.</li>
     *   <li>The command carries the track id, letting the web player verify that the
     *       song it is about to like is still the one the lock screen is showing.</li>
     * </ol>
     *
     * <p>The heart reflects the saved state the web player reports back through
     * {@link #ACTION_UPDATE_LIKED} -- never the tap itself -- so a failed write can
     * not leave the icon lying. Dispatch is best-effort: if the WebView is gone the
     * debounce is rolled back so a later tap can still work, and playback is
     * unaffected either way.
     */
    private void handleLikeTap() {
        if (trackId == null || trackId.isEmpty()) return;
        long now = SystemClock.elapsedRealtime();
        if (trackId.equals(lastLikeTrackId) && now - lastLikeTapAt < LIKE_TAP_DEBOUNCE_MS) return;
        lastLikeTapAt = now;
        lastLikeTrackId = trackId;
        if (!dispatchMediaCommand("like:" + trackId)) {
            // No player to receive it: undo the guard rather than swallow the tap.
            lastLikeTapAt = 0;
            lastLikeTrackId = "";
        }
    }

    // ─── Audio focus ─────────────────────────────────────────────────────
    // Chromium WebView (CapacitorWebView) manages its own native AudioFocus on STREAM_MUSIC.
    // Handling focus here caused duplicate intra-process focus collisions and premature pauses.

    private void abandonAudioFocus() {
        // Safe no-op: Chromium owns the underlying AudioTrack focus.
    }

    // ─── Noisy receiver (headphone unplug → pause) ───────────────────────

    private void registerNoisyReceiver() {
        try {
            noisyReceiver = new BroadcastReceiver() {
                @Override
                public void onReceive(Context context, Intent intent) {
                    if (AudioManager.ACTION_AUDIO_BECOMING_NOISY.equals(intent.getAction())
                            && isJsPlaying) {
                        dispatchMediaCommand("pause");
                    }
                }
            };
            registerReceiver(noisyReceiver, new IntentFilter(AudioManager.ACTION_AUDIO_BECOMING_NOISY));
        } catch (Exception ignored) {}
    }

    private void unregisterNoisyReceiver() {
        try {
            if (noisyReceiver != null) {
                unregisterReceiver(noisyReceiver);
                noisyReceiver = null;
            }
        } catch (Exception ignored) {}
    }

    // ─── Locks ───────────────────────────────────────────────────────────

    private void acquireLocks() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && wakeLock == null) {
                wakeLock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MelodyMap::PlaybackServiceWakeLock");
                wakeLock.setReferenceCounted(false);
            }
            if (wakeLock != null && !wakeLock.isHeld()) {
                wakeLock.acquire();
            }
        } catch (Exception ignored) {}

        try {
            WifiManager wm = (WifiManager) getApplicationContext().getSystemService(Context.WIFI_SERVICE);
            if (wm != null && wifiLock == null) {
                wifiLock = wm.createWifiLock(WifiManager.WIFI_MODE_FULL_HIGH_PERF, "MelodyMap::PlaybackWifiLock");
                wifiLock.setReferenceCounted(false);
            }
            if (wifiLock != null && !wifiLock.isHeld()) {
                wifiLock.acquire();
            }
        } catch (Exception ignored) {}
    }

    private void releaseLocks() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
        try {
            if (wifiLock != null && wifiLock.isHeld()) {
                wifiLock.release();
            }
        } catch (Exception ignored) {}
    }

    // ─── Teardown ────────────────────────────────────────────────────────

    private void stopForegroundService() {
        isRunning = false;
        started = false;
        isJsPlaying = false;
        cancelGraceStop();
        releaseLocks();
        abandonAudioFocus();
        unregisterNoisyReceiver();
        if (mediaSession != null) {
            try {
                mediaSession.setActive(false);
            } catch (Exception ignored) {}
            try {
                mediaSession.release();
            } catch (Exception ignored) {}
            mediaSession = null;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopForegroundService();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
