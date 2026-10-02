package com.melodymap.music;

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
    }

    public void releaseAudioWakeLock() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
            }
        } catch (Exception ignored) {}
    }

    public void handleSleepTimerExpired() {
        // Release wake lock when sleep timer fires so device can enter deep sleep
        releaseAudioWakeLock();

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
    public void onDestroy() {
        releaseAudioWakeLock();
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }
}
