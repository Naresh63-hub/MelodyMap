package com.melodymap.music;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioManager;

/**
 * BroadcastReceiver triggered by Android AlarmManager when a sleep timer expires.
 * Executes natively regardless of whether WebView is foregrounded, backgrounded, or screen is off.
 */
public class SleepTimerReceiver extends BroadcastReceiver {
    public static final String ACTION_SLEEP_TIMER_EXPIRED = "com.melodymap.music.SLEEP_TIMER_EXPIRED";
    private static final String PREFS_NAME = "melodymap_sleep_timer";
    private static final String KEY_ACTIVE = "is_active";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || !ACTION_SLEEP_TIMER_EXPIRED.equals(intent.getAction())) {
            return;
        }

        // 1. Clear active status in preferences
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit().putBoolean(KEY_ACTIVE, false).apply();
        } catch (Exception ignored) {}

        // 2. Abandon audio focus at Android OS level to immediately pause media playback system-wide
        try {
            AudioManager audioManager = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
            if (audioManager != null) {
                audioManager.abandonAudioFocus(null);
            }
        } catch (Exception ignored) {}

        // 3. Notify MainActivity instance if running to halt playback, release wake locks, and update UI
        MainActivity activity = MainActivity.getInstance();
        if (activity != null) {
            activity.handleSleepTimerExpired();
        }
    }
}
