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

    public static final String EXTRA_PAYLOAD = "payload";
    public static final String EXTRA_POSITION = "position";

    public static final String CHANNEL_ID = "melodymap_media_playback";
    public static final int NOTIFICATION_ID = 1001;

    /** How long a paused session keeps its notification before cleaning up. */
    private static final long PAUSED_STOP_GRACE_MS = 30_000L;

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
    private String trackTitle = "";
    private String trackArtist = "";
    private double trackDurationSec = 0;
    private double trackPositionSec = 0;
    private boolean isJsPlaying = false;
    private boolean resumeOnFocusGain = false;
    private boolean started = false;

    private static volatile boolean isRunning = false;

    public static boolean isServiceRunning() {
        return isRunning;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
        initMediaSession();
        requestAudioFocus();
        registerNoisyReceiver();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
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
                handlePlay(intent != null ? intent.getStringExtra(EXTRA_PAYLOAD) : null);
                break;
            case ACTION_PAUSE:
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

        if (!started) {
            startForegroundWithNotification();
            started = true;
        } else {
            updateNotification();
        }
        acquireLocks();
        refreshMediaSession();
        isRunning = true;
    }

    private void handlePause() {
        isJsPlaying = false;
        updateNotification();
        refreshMediaSession();
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
            trackTitle = payload.optString("title", trackTitle);
            trackArtist = payload.optString("artist", trackArtist);
            trackDurationSec = payload.optDouble("duration", trackDurationSec);
            if (payload.has("position")) {
                trackPositionSec = payload.optDouble("position", trackPositionSec);
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

    private void initMediaSession() {
        try {
            mediaSession = new MediaSessionCompat(this, "MelodyMapMediaSession");
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
                                    | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
                                    | PlaybackStateCompat.ACTION_SEEK_TO
                                    | PlaybackStateCompat.ACTION_STOP)
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
        Notification notification = buildNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
        } else {
            startForeground(NOTIFICATION_ID, notification);
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
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentIntent(contentIntent)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .addAction(R.mipmap.ic_launcher, "Prev", serviceActionIntent(ACTION_PREV))
                .addAction(R.mipmap.ic_launcher,
                        isJsPlaying ? "Pause" : "Play",
                        serviceActionIntent(isJsPlaying ? ACTION_PAUSE : ACTION_PLAY))
                .addAction(R.mipmap.ic_launcher, "Next", serviceActionIntent(ACTION_NEXT));

        if (mediaSession != null) {
            builder.setStyle(new MediaStyle()
                    .setMediaSession(mediaSession.getSessionToken())
                    .setShowActionsInCompactView(0, 1, 2));
        }
        return builder.build();
    }

    // ─── Media button dispatch into the WebView player ──────────────────

    private void dispatchMediaCommand(String command) {
        MainActivity activity = MainActivity.getInstance();
        if (activity == null) return;
        activity.dispatchMediaCommand(command);
    }

    // ─── Audio focus ─────────────────────────────────────────────────────

    private void requestAudioFocus() {
        try {
            audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            if (audioManager == null) return;

            focusChangeListener = focusChange -> {
                switch (focusChange) {
                    case AudioManager.AUDIOFOCUS_LOSS:
                        resumeOnFocusGain = false;
                        if (isJsPlaying) {
                            dispatchMediaCommand("pause");
                        }
                        handlePause();
                        break;
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:
                    case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK:
                        // We cannot duck WebView audio from the native side —
                        // pause instead, and auto-resume when focus returns.
                        resumeOnFocusGain = isJsPlaying;
                        if (isJsPlaying) {
                            dispatchMediaCommand("pause");
                        }
                        handlePause();
                        break;
                    case AudioManager.AUDIOFOCUS_GAIN:
                        if (resumeOnFocusGain) {
                            resumeOnFocusGain = false;
                            dispatchMediaCommand("play");
                        }
                        break;
                    default:
                        break;
                }
            };

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                AudioAttributes playbackAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build();
                audioFocusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                        .setAudioAttributes(playbackAttributes)
                        .setAcceptsDelayedFocusGain(true)
                        .setOnAudioFocusChangeListener(focusChangeListener)
                        .build();
                audioManager.requestAudioFocus(audioFocusRequest);
            } else {
                audioManager.requestAudioFocus(
                        focusChangeListener, AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            }
        } catch (Exception ignored) {}
    }

    private void abandonAudioFocus() {
        try {
            if (audioManager == null) return;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && audioFocusRequest != null) {
                audioManager.abandonAudioFocusRequest(audioFocusRequest);
                audioFocusRequest = null;
            } else if (focusChangeListener != null) {
                audioManager.abandonAudioFocus(focusChangeListener);
            }
        } catch (Exception ignored) {}
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
