package com.melodymap.music;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.Settings;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import java.io.BufferedInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Android JavaScript bridge for In-App APK Updates.
 * Exposed to WebView as `window.AndroidUpdate`.
 * 
 * Supports:
 * - Querying installed app version name
 * - Checking and requesting REQUEST_INSTALL_PACKAGES permission (Android 8.0+)
 * - Streaming download of APK asset with real-time progress callbacks to WebView
 * - Automated handoff to Android's native package installer screen (Option B)
 */
public class UpdateBridge {
    private static final String TAG = "MelodyMapUpdate";
    private final Activity activity;

    public UpdateBridge(Activity activity) {
        this.activity = activity;
    }

    @JavascriptInterface
    public String getInstalledVersion() {
        try {
            PackageManager pm = activity.getPackageManager();
            PackageInfo pi = pm.getPackageInfo(activity.getPackageName(), 0);
            return pi.versionName != null ? pi.versionName : "1.3.8";
        } catch (Exception e) {
            Log.e(TAG, "Error getting installed version", e);
            return "1.3.8";
        }
    }

    @JavascriptInterface
    public boolean canRequestPackageInstalls() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                return activity.getPackageManager().canRequestPackageInstalls();
            } catch (Exception e) {
                Log.e(TAG, "Error checking package install permission", e);
                return false;
            }
        }
        return true;
    }

    @JavascriptInterface
    public void openInstallPermissionSettings() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                intent.setData(Uri.parse("package:" + activity.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                Log.e(TAG, "Error opening install permission settings", e);
            }
        }
    }

    @JavascriptInterface
    public void downloadAndInstall(final String apkUrl, final String versionName) {
        new Thread(() -> {
            File downloadedFile = null;
            try {
                Log.i(TAG, "Starting APK download: " + apkUrl);
                sendWebProgress(1, "Starting download...");

                // Prepare target directory and file
                File targetDir = activity.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
                if (targetDir == null) {
                    targetDir = activity.getCacheDir();
                }
                if (!targetDir.exists()) {
                    targetDir.mkdirs();
                }

                String safeVersion = versionName != null ? versionName.replaceAll("[^a-zA-Z0-9._-]", "") : "update";
                downloadedFile = new File(targetDir, "MelodyMap-" + safeVersion + ".apk");
                if (downloadedFile.exists()) {
                    downloadedFile.delete();
                }

                // Connect and follow redirects (GitHub releases redirect to S3/CDN)
                String currentUrl = apkUrl;
                HttpURLConnection connection = null;
                int redirects = 0;
                while (redirects < 6) {
                    URL url = new URL(currentUrl);
                    connection = (HttpURLConnection) url.openConnection();
                    connection.setInstanceFollowRedirects(true);
                    connection.setRequestProperty("User-Agent", "MelodyMap-AppUpdate/1.0");
                    connection.setConnectTimeout(15000);
                    connection.setReadTimeout(30000);
                    connection.connect();

                    int responseCode = connection.getResponseCode();
                    if (responseCode == HttpURLConnection.HTTP_MOVED_PERM ||
                        responseCode == HttpURLConnection.HTTP_MOVED_TEMP ||
                        responseCode == HttpURLConnection.HTTP_SEE_OTHER ||
                        responseCode == 307 || responseCode == 308) {
                        currentUrl = connection.getHeaderField("Location");
                        redirects++;
                        connection.disconnect();
                    } else if (responseCode == HttpURLConnection.HTTP_OK) {
                        break;
                    } else {
                        throw new Exception("Server returned HTTP " + responseCode);
                    }
                }

                if (connection == null) {
                    throw new Exception("Unable to establish connection to download server");
                }

                int fileLength = connection.getContentLength();
                InputStream input = new BufferedInputStream(connection.getInputStream(), 8192);
                OutputStream output = new FileOutputStream(downloadedFile);

                byte[] data = new byte[8192];
                long total = 0;
                int count;
                long lastProgressUpdate = 0;

                while ((count = input.read(data)) != -1) {
                    total += count;
                    output.write(data, 0, count);

                    if (fileLength > 0) {
                        int progress = (int) ((total * 100) / fileLength);
                        long now = System.currentTimeMillis();
                        if (now - lastProgressUpdate > 200 || progress == 100) {
                            lastProgressUpdate = now;
                            sendWebProgress(progress, "Downloading (" + progress + "%)...");
                        }
                    }
                }

                output.flush();
                output.close();
                input.close();
                connection.disconnect();

                Log.i(TAG, "Download finished. File size: " + downloadedFile.length() + " bytes");
                sendWebProgress(100, "Download complete. Preparing installation...");

                // Launch package installer
                installApk(downloadedFile);

            } catch (Exception e) {
                Log.e(TAG, "Failed to download and install APK", e);
                sendWebError(e.getMessage() != null ? e.getMessage() : "Download failed");
            }
        }).start();
    }

    private void installApk(File apkFile) {
        activity.runOnUiThread(() -> {
            try {
                if (apkFile == null || !apkFile.exists()) {
                    sendWebError("APK file not found");
                    return;
                }

                // If Android 8.0+ and cannot request installs, guide user to enable permission
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (!activity.getPackageManager().canRequestPackageInstalls()) {
                        sendWebPermissionNeeded();
                        openInstallPermissionSettings();
                        return;
                    }
                }

                // Option B: Automatically trigger Android's native installation screen
                Intent installIntent = new Intent(Intent.ACTION_VIEW);
                Uri apkUri = FileProvider.getUriForFile(
                    activity,
                    activity.getPackageName() + ".fileprovider",
                    apkFile
                );

                installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
                installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(installIntent);

                sendWebComplete();
            } catch (Exception e) {
                Log.e(TAG, "Error launching package installer", e);
                sendWebError("Failed to open package installer: " + e.getMessage());
            }
        });
    }

    private void sendWebProgress(final int progress, final String status) {
        runOnWebThread("if (window.__melodymap_update_progress) window.__melodymap_update_progress(" + progress + ", " + quote(status) + ");");
    }

    private void sendWebComplete() {
        runOnWebThread("if (window.__melodymap_update_complete) window.__melodymap_update_complete();");
    }

    private void sendWebPermissionNeeded() {
        runOnWebThread("if (window.__melodymap_update_permission_needed) window.__melodymap_update_permission_needed();");
    }

    private void sendWebError(final String errorMsg) {
        runOnWebThread("if (window.__melodymap_update_error) window.__melodymap_update_error(" + quote(errorMsg) + ");");
    }

    private void runOnWebThread(final String jsCode) {
        activity.runOnUiThread(() -> {
            try {
                if (activity instanceof MainActivity) {
                    WebView webView = ((MainActivity) activity).getBridge().getWebView();
                    if (webView != null) {
                        webView.evaluateJavascript(jsCode, null);
                    }
                }
            } catch (Exception ignored) {}
        });
    }

    private String quote(String text) {
        if (text == null) return "''";
        return "'" + text.replace("\\", "\\\\").replace("'", "\\'").replace("\n", "\\n").replace("\r", "") + "'";
    }
}
