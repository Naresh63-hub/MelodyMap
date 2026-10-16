package com.melodymap.music;

import android.webkit.JavascriptInterface;

/**
 * JavaScript interface exposed to the WebView as {@code window.AndroidTheme}.
 *
 * Synchronizes web theme state with Android system bars (status bar and navigation bar).
 * When the app is in light theme, Android displays dark icons (time, battery, WiFi)
 * so they are crisp and readable against the light surface. When in dark theme,
 * it switches to light icons.
 */
public class ThemeBridge {
    private final MainActivity activity;

    public ThemeBridge(MainActivity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public void setStatusBarTheme(boolean isLight) {
        if (activity != null) {
            activity.setStatusBarStyle(isLight);
        }
    }
}
