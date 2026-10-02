package com.melodymap.music;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.SystemClock;
import android.webkit.JavascriptInterface;

/**
 * JavaScript interface exposed to WebView (window.AndroidSleepTimer).
 * Bridges web sleep timer requests directly to native Android AlarmManager.
 */
public class SleepTimerBridge {
    private static final String PREFS_NAME = "melodymap_sleep_timer";
    private static final String KEY_ACTIVE = "is_active";
    private static final String KEY_EXPIRY_WALL = "expiry_wall_ms";
    private static final String KEY_EXPIRY_ELAPSED = "expiry_elapsed_ms";
    private static final int REQUEST_CODE = 9021;

    private final Context context;

    public SleepTimerBridge(Context context) {
        this.context = context.getApplicationContext();
    }

    @JavascriptInterface
    public void scheduleSleepTimer(long durationMs) {
        if (durationMs <= 0) {
            cancelSleepTimer();
            return;
        }

        long nowElapsed = SystemClock.elapsedRealtime();
        long nowWall = System.currentTimeMillis();
        long targetElapsed = nowElapsed + durationMs;
        long targetWall = nowWall + durationMs;

        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean(KEY_ACTIVE, true)
                .putLong(KEY_EXPIRY_ELAPSED, targetElapsed)
                .putLong(KEY_EXPIRY_WALL, targetWall)
                .apply();
        } catch (Exception ignored) {}

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            Intent intent = new Intent(context, SleepTimerReceiver.class);
            intent.setAction(SleepTimerReceiver.ACTION_SLEEP_TIMER_EXPIRED);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);

            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && !alarmManager.canScheduleExactAlarms()) {
                        alarmManager.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsed, pendingIntent);
                    } else {
                        alarmManager.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsed, pendingIntent);
                    }
                } else {
                    alarmManager.setExact(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsed, pendingIntent);
                }
            } catch (SecurityException se) {
                alarmManager.set(AlarmManager.ELAPSED_REALTIME_WAKEUP, targetElapsed, pendingIntent);
            }
        }
    }

    @JavascriptInterface
    public void cancelSleepTimer() {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            prefs.edit()
                .putBoolean(KEY_ACTIVE, false)
                .remove(KEY_EXPIRY_ELAPSED)
                .remove(KEY_EXPIRY_WALL)
                .apply();
        } catch (Exception ignored) {}

        AlarmManager alarmManager = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarmManager != null) {
            Intent intent = new Intent(context, SleepTimerReceiver.class);
            intent.setAction(SleepTimerReceiver.ACTION_SLEEP_TIMER_EXPIRED);
            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags);
            alarmManager.cancel(pendingIntent);
        }
    }

    @JavascriptInterface
    public boolean isTimerActive() {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            boolean active = prefs.getBoolean(KEY_ACTIVE, false);
            if (!active) return false;
            long expiryWall = prefs.getLong(KEY_EXPIRY_WALL, 0);
            if (System.currentTimeMillis() >= expiryWall) {
                prefs.edit().putBoolean(KEY_ACTIVE, false).apply();
                return false;
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    @JavascriptInterface
    public long getRemainingSeconds() {
        try {
            SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            if (!prefs.getBoolean(KEY_ACTIVE, false)) return 0;
            long expiryWall = prefs.getLong(KEY_EXPIRY_WALL, 0);
            long remaining = (expiryWall - System.currentTimeMillis()) / 1000;
            return Math.max(0, remaining);
        } catch (Exception ignored) {
            return 0;
        }
    }
}
