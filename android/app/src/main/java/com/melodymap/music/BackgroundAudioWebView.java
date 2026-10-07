package com.melodymap.music;

import android.content.Context;
import android.util.AttributeSet;
import android.view.View;
import com.getcapacitor.CapacitorWebView;

/**
 * Custom WebView that prevents Android and Chromium from suspending audio decoding,
 * timers, and media playback when the device screen locks or the app is minimized.
 */
public class BackgroundAudioWebView extends CapacitorWebView {

    public BackgroundAudioWebView(Context context, AttributeSet attrs) {
        super(context, attrs);
    }

    @Override
    protected void onWindowVisibilityChanged(int visibility) {
        // Prevent Chromium from detecting that the window is hidden/locked,
        // which stops Chromium's internal video/audio decoders from pausing in the background.
        super.onWindowVisibilityChanged(View.VISIBLE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasWindowFocus) {
        // Report that window focus is always retained to avoid background suspension
        super.onWindowFocusChanged(true);
    }

    @Override
    protected void onVisibilityChanged(View changedView, int visibility) {
        super.onVisibilityChanged(changedView, View.VISIBLE);
    }

    @Override
    public void onPause() {
        // Do NOT pause the WebView when Activity pauses or screen turns off.
        // Keeping the WebView unpaused allows audio playback and JavaScript timers
        // to run continuously in the background under MediaPlaybackService.
    }

    @Override
    public void pauseTimers() {
        // Keep timers active in the background for continuous playback and auto-advance.
    }
}
