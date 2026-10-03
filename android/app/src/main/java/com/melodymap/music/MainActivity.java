package com.melodymap.music;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.os.PowerManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;
    private PowerManager.WakeLock wakeLock;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // Allow media autoplay without requiring immediate user gesture on each track transition
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Register SleepTimer JavaScript interface bridge
                webView.addJavascriptInterface(new SleepTimerBridge(this), "AndroidSleepTimer");
            }
        } catch (Exception ignored) {}

        // Keep CPU awake while screen is turned off so continuous audio does not suspend
        try {
            PowerManager powerManager = (PowerManager) getSystemService(POWER_SERVICE);
            if (powerManager != null) {
                wakeLock = powerManager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "MelodyMap::AudioWakeLock");
                wakeLock.acquire();
            }
        } catch (Exception ignored) {}

        startMediaPlaybackService();
    }

    public void startMediaPlaybackService() {
        try {
            Intent serviceIntent = new Intent(this, MediaPlaybackService.class);
            serviceIntent.setAction(MediaPlaybackService.ACTION_START);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception ignored) {}
    }

    public void stopMediaPlaybackService() {
        try {
            Intent serviceIntent = new Intent(this, MediaPlaybackService.class);
            serviceIntent.setAction(MediaPlaybackService.ACTION_STOP);
            startService(serviceIntent);
        } catch (Exception ignored) {}
    }

    public void releaseAudioWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
    }

    public void handleSleepTimerExpired() {
        // Release wake lock and stop foreground service when sleep timer fires so device can sleep
        releaseAudioWakeLock();
        stopMediaPlaybackService();

        // Dispatch stop event into WebView javascript engine on UI thread
        runOnUiThread(() -> {
            try {
                WebView webView = getBridge().getWebView();
                if (webView != null) {
                    webView.evaluateJavascript(
                        "if (window.__melodymap_sleep_timer_expire) { window.__melodymap_sleep_timer_expire(); }",
                        null
                    );
                }
            } catch (Exception ignored) {}
        });
    }

    @Override
    public void onPause() {
        super.onPause();
        // Prevent WebView from freezing audio processing and JS timers when screen turns off
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.resumeTimers();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onStop() {
        super.onStop();
        // Prevent WebView from freezing audio processing and JS timers when app is minimized
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.resumeTimers();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onDestroy() {
        stopMediaPlaybackService();
        releaseAudioWakeLock();
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }
}
