package com.melodymap.music;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static MainActivity instance;
    private GoogleAuthBridge googleAuthBridge;

    public static MainActivity getInstance() {
        return instance;
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        instance = this;

        // Ensure system status bar and navigation bars do not overlap web content
        try {
            androidx.core.view.WindowCompat.setDecorFitsSystemWindows(getWindow(), true);
        } catch (Exception ignored) {}

        // Allow media autoplay without requiring immediate user gesture on each track transition
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);

                // Native app feel: disable browser-style pinch/zoom controls.
                // The layout already fits the viewport; zooming only breaks it.
                settings.setSupportZoom(false);
                settings.setBuiltInZoomControls(false);
                settings.setDisplayZoomControls(false);

                String currentUa = settings.getUserAgentString();
                if (currentUa != null && !currentUa.contains("MelodyMapApp")) {
                    settings.setUserAgentString(currentUa + " MelodyMapApp");
                }

                // Register SleepTimer JavaScript interface bridge
                webView.addJavascriptInterface(new SleepTimerBridge(this), "AndroidSleepTimer");

                // Register Native Google Play Services Authentication bridge
                googleAuthBridge = new GoogleAuthBridge(this);
                webView.addJavascriptInterface(googleAuthBridge, "AndroidGoogleAuth");

                // Register Spotify-style background playback bridge
                webView.addJavascriptInterface(new PlaybackBridge(this), "AndroidPlayback");
            }
        } catch (Exception ignored) {}

        // NOTE: no unconditional Activity-owned wake lock and no unconditional
        // startForegroundService here. Locks and the foreground notification are
        // now owned by MediaPlaybackService and only held while audio is playing
        // (via PlaybackBridge.onPlay/onPause). A service that shows a
        // notification without active playback gets killed by modern Android,
        // and an always-on wake lock drains the battery.

        // Request POST_NOTIFICATIONS runtime permission on Android 13+ (API 33+) for foreground media notification
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 1002);
                }
            }
        } catch (Exception ignored) {}
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

    /**
     * Forward a media button command (play/pause/next/prev/seek) from the
     * MediaSession / notification / headset into the web player.
     */
    public void dispatchMediaCommand(String command) {
        if (command == null || command.isEmpty()) return;
        runOnUiThread(() -> {
            try {
                WebView webView = getBridge() != null ? getBridge().getWebView() : null;
                if (webView != null) {
                    String escaped = command
                            .replace("\\", "\\\\")
                            .replace("'", "\\'");
                    webView.evaluateJavascript(
                            "if (window.__melodymap_media_command) { window.__melodymap_media_command('" + escaped + "'); }",
                            null);
                }
            } catch (Exception ignored) {}
        });
    }

    public void handleSleepTimerExpired() {
        // Sleep timer fired: stop playback and tear down the media session so
        // the device can actually sleep (dispatches the stop into the WebView).
        stopMediaPlaybackService();

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
                webView.onResume();
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
                webView.onResume();
                webView.resumeTimers();
            }
        } catch (Exception ignored) {}
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        // Prevent WebView from suspending audio decoding when notification shade drops or screen locks
        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                webView.onResume();
                webView.resumeTimers();
            }
        } catch (Exception ignored) {}
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    private void handleDeepLink(Intent intent) {
        if (intent != null && intent.getData() != null) {
            String url = intent.getData().toString();
            if (url.startsWith("com.melodymap.music") || url.contains("callback")) {
                runOnUiThread(() -> {
                    try {
                        WebView webView = getBridge().getWebView();
                        if (webView != null) {
                            webView.evaluateJavascript(
                                "if (window.__melodymap_handle_auth_callback) { window.__melodymap_handle_auth_callback('" + url.replace("'", "\\'") + "'); }",
                                null
                            );
                        }
                    } catch (Exception ignored) {}
                });
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (googleAuthBridge != null && googleAuthBridge.handleActivityResult(requestCode, resultCode, data)) {
            return;
        }
    }

    @Override
    public void onDestroy() {
        stopMediaPlaybackService();
        if (instance == this) {
            instance = null;
        }
        super.onDestroy();
    }
}
