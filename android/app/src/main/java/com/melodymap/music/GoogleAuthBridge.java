package com.melodymap.music;

import android.app.Activity;
import android.content.Intent;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import com.google.android.gms.auth.api.signin.GoogleSignIn;
import com.google.android.gms.auth.api.signin.GoogleSignInAccount;
import com.google.android.gms.auth.api.signin.GoogleSignInClient;
import com.google.android.gms.auth.api.signin.GoogleSignInOptions;
import com.google.android.gms.auth.api.signin.GoogleSignInStatusCodes;
import com.google.android.gms.common.ConnectionResult;
import com.google.android.gms.common.GoogleApiAvailability;
import com.google.android.gms.common.api.ApiException;
import com.google.android.gms.common.api.CommonStatusCodes;
import com.google.android.gms.tasks.Task;
import org.json.JSONObject;

/**
 * JavaScript Interface bridge for native Android Google Play Services Sign-In.
 * Enables 1-tap Google Authentication directly within the native Android app,
 * bypassing external browser redirects and avoiding WebView "disallowed_useragent" restrictions.
 */
public class GoogleAuthBridge {
    private static final String TAG = "MelodyMapGoogleAuth";
    public static final int RC_GOOGLE_SIGN_IN = 9002;

    private final MainActivity activity;
    private GoogleSignInClient googleSignInClient;

    public GoogleAuthBridge(MainActivity activity) {
        this.activity = activity;
    }

    /**
     * Checks if Google Play Services is available on this Android device.
     */
    @JavascriptInterface
    public boolean isAvailable() {
        try {
            GoogleApiAvailability availability = GoogleApiAvailability.getInstance();
            int resultCode = availability.isGooglePlayServicesAvailable(activity);
            return resultCode == ConnectionResult.SUCCESS;
        } catch (Exception e) {
            Log.e(TAG, "Error checking Google Play Services availability", e);
            return false;
        }
    }

    /**
     * Initiates native Google Sign-In with the specified Web Client ID.
     * Google Play Services displays the native account chooser modal directly over the app.
     *
     * @param serverClientId The OAuth 2.0 Web Client ID registered in Google Cloud Console & Supabase.
     */
    @JavascriptInterface
    public void signIn(String serverClientId) {
        if (serverClientId == null || serverClientId.trim().isEmpty()) {
            notifyError("Google Web Client ID is required for native Google Sign-In");
            return;
        }

        final String clientId = serverClientId.trim();

        activity.runOnUiThread(() -> {
            try {
                GoogleSignInOptions gso = new GoogleSignInOptions.Builder(GoogleSignInOptions.DEFAULT_SIGN_IN)
                        .requestIdToken(clientId)
                        .requestEmail()
                        .build();

                googleSignInClient = GoogleSignIn.getClient(activity, gso);

                // Sign out previous session first so the account chooser is always shown if tapped
                googleSignInClient.signOut().addOnCompleteListener(activity, task -> {
                    try {
                        Intent signInIntent = googleSignInClient.getSignInIntent();
                        activity.startActivityForResult(signInIntent, RC_GOOGLE_SIGN_IN);
                    } catch (Exception e) {
                        Log.e(TAG, "Failed to launch Google Sign-In intent", e);
                        notifyError("Failed to launch Google Sign-In: " + e.getMessage());
                    }
                });
            } catch (Exception e) {
                Log.e(TAG, "Failed to initialize Google Sign-In", e);
                notifyError("Google Sign-In initialization failed: " + e.getMessage());
            }
        });
    }

    /**
     * Signs out of the Google Sign-In client.
     */
    @JavascriptInterface
    public void signOut() {
        activity.runOnUiThread(() -> {
            if (googleSignInClient != null) {
                googleSignInClient.signOut();
            }
        });
    }

    /**
     * Handles the result of the Google Sign-In intent from MainActivity.onActivityResult.
     */
    public boolean handleActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode != RC_GOOGLE_SIGN_IN) {
            return false;
        }

        Task<GoogleSignInAccount> task = GoogleSignIn.getSignedInAccountFromIntent(data);
        try {
            GoogleSignInAccount account = task.getResult(ApiException.class);
            if (account != null && account.getIdToken() != null) {
                String idToken = account.getIdToken();
                String email = account.getEmail() != null ? account.getEmail() : "";
                String displayName = account.getDisplayName() != null ? account.getDisplayName() : "";
                notifySuccess(idToken, email, displayName);
            } else {
                notifyError("No ID token returned by Google Play Services");
            }
        } catch (ApiException e) {
            int statusCode = e.getStatusCode();
            String errorMsg;
            if (statusCode == GoogleSignInStatusCodes.SIGN_IN_CANCELLED) {
                errorMsg = "Sign-in cancelled by user";
            } else if (statusCode == CommonStatusCodes.DEVELOPER_ERROR) {
                errorMsg = "Configuration error: Ensure SHA-1 fingerprint and Web Client ID match Google Cloud Console settings.";
            } else if (statusCode == CommonStatusCodes.NETWORK_ERROR) {
                errorMsg = "Network error during Google Sign-In. Check your internet connection.";
            } else {
                errorMsg = "Google Sign-In failed (" + statusCode + "): " + CommonStatusCodes.getStatusCodeString(statusCode);
            }
            Log.w(TAG, errorMsg);
            notifyError(errorMsg);
        } catch (Exception e) {
            Log.e(TAG, "Unexpected error handling Google Sign-In result", e);
            notifyError("Unexpected Google Sign-In error: " + e.getMessage());
        }

        return true;
    }

    private void notifySuccess(String idToken, String email, String displayName) {
        activity.runOnUiThread(() -> {
            try {
                WebView webView = activity.getBridge() != null ? activity.getBridge().getWebView() : null;
                if (webView != null) {
                    String js = String.format(
                            "if (window.__melodymap_handle_google_id_token) { window.__melodymap_handle_google_id_token(%s, %s, %s); }",
                            JSONObject.quote(idToken),
                            JSONObject.quote(email),
                            JSONObject.quote(displayName)
                    );
                    webView.evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to dispatch Google token to WebView", e);
            }
        });
    }

    private void notifyError(String errorMessage) {
        activity.runOnUiThread(() -> {
            try {
                WebView webView = activity.getBridge() != null ? activity.getBridge().getWebView() : null;
                if (webView != null) {
                    String js = String.format(
                            "if (window.__melodymap_handle_google_error) { window.__melodymap_handle_google_error(%s); }",
                            JSONObject.quote(errorMessage)
                    );
                    webView.evaluateJavascript(js, null);
                }
            } catch (Exception e) {
                Log.e(TAG, "Failed to dispatch Google error to WebView", e);
            }
        });
    }
}
