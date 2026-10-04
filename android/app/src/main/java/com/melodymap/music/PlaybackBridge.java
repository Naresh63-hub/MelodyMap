package com.melodymap.music;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import android.webkit.JavascriptInterface;

/**
 * JavaScript interface exposed to the WebView as {@code window.AndroidPlayback}.
 *
 * The web player (src/lib/native-playback.ts) calls these methods to drive the
 * foreground media service: start/stop Spotify-style background playback, sync
 * track metadata + position for the lockscreen, and request the one-time
 * battery-optimization exemption. Every method is defensive: a missing or
 * failing service must never break in-app playback.
 */
public class PlaybackBridge {
    private final MainActivity activity;

    public PlaybackBridge(MainActivity activity) {
        this.activity = activity;
    }

    /** User pressed play (or a track auto-advanced while playing). */
    @JavascriptInterface
    public void onPlay(String payloadJson) {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_PLAY);
        intent.putExtra(MediaPlaybackService.EXTRA_PAYLOAD, payloadJson == null ? "" : payloadJson);
        startService(intent, true);
    }

    /** User paused (or system paused: focus loss, headphone unplug, sleep timer). */
    @JavascriptInterface
    public void onPause(String payloadJson) {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_PAUSE);
        intent.putExtra(MediaPlaybackService.EXTRA_PAYLOAD, payloadJson == null ? "" : payloadJson);
        startService(intent, false);
    }

    /** Playback fully stopped — remove the media notification. */
    @JavascriptInterface
    public void onStop() {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_STOP);
        startService(intent, false);
    }

    /** Lightweight periodic position sync for the lockscreen progress bar. */
    @JavascriptInterface
    public void onPosition(double positionSeconds) {
        Intent intent = new Intent(activity, MediaPlaybackService.class);
        intent.setAction(MediaPlaybackService.ACTION_UPDATE_POSITION);
        intent.putExtra(MediaPlaybackService.EXTRA_POSITION, positionSeconds);
        startService(intent, false);
    }

    /**
     * One-time system prompt so battery savers on aggressive OEMs
     * (Xiaomi/Oppo/Realme/Vivo...) don't kill background playback after a few
     * minutes. Gated once-per-install on the JS side.
     */
    @JavascriptInterface
    public void requestIgnoreBatteryOptimizations() {
        activity.runOnUiThread(() -> {
            try {
                PowerManager pm = (PowerManager) activity.getSystemService(Context.POWER_SERVICE);
                String pkg = activity.getPackageName();
                if (pm != null && !pm.isIgnoringBatteryOptimizations(pkg)) {
                    Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    intent.setData(Uri.parse("package:" + pkg));
                    activity.startActivity(intent);
                }
            } catch (Exception ignored) {}
        });
    }

    /**
     * Deliver an intent to the media service. While the service is already
     * running (foreground), plain startService is safe from the background —
     * that is the auto-advance-while-screen-off path. The very first start
     * must be a foreground-service start, which is allowed because the user
     * just tapped play (app is in the foreground).
     */
    private void startService(Intent intent, boolean foregroundStart) {
        try {
            if (foregroundStart
                    && !MediaPlaybackService.isServiceRunning()
                    && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                activity.startForegroundService(intent);
            } else {
                activity.startService(intent);
            }
        } catch (Exception ignored) {
            // ForegroundServiceStartNotAllowedException on aggressive OEMs etc.
            // Audio keeps playing in-process; the media notification is
            // best-effort and must never break playback.
        }
    }
}
