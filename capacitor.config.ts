import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env['NODE_ENV'] === 'development' || process.env['CAPACITOR_ENV'] === 'development';

const config: CapacitorConfig = {
  appId: 'com.melodymap.music',
  appName: 'MelodyMap',
  webDir: '.output/public',
  server: {
    url: 'https://melodymap-pi.vercel.app',
    cleartext: isDev,
  },
  android: {
    allowMixedContent: isDev,
    backgroundColor: '#0a0a0f',
    // NOTE: `android.adjustMarginsForEdgeToEdge` is not a Capacitor option —
    // it is absent from CapConfig.java and the CLI config type, so it was
    // silently ignored and never kept the WebView out of the system bars.
    // Edge-to-edge insets are handled by the built-in SystemBars plugin
    // (configured below), which is what Android 15+ (targetSdk 36) requires.
  },
  plugins: {
    /**
     * Android 15+ enforces edge-to-edge for apps targeting SDK 35+, so the
     * WebView draws underneath the status and navigation bars.
     *
     * SystemBars is registered automatically by the Capacitor 8 bridge and
     * takes care of the insets: on Chromium < 140 it pads the WebView natively
     * and reports `env(safe-area-inset-*)` as 0, and on Chromium >= 140 it lets
     * `viewport-fit=cover` hand correct safe-area values to the page.
     */
    SystemBars: {
      // "css" (default behaviour, pinned explicitly) = the native handling
      // above plus injected `--safe-area-inset-*` CSS variables, which the web
      // stylesheet consumes as a fallback next to `env()`.
      insetsHandling: 'css',
      // The document already declares `viewport-fit=cover`; declaring it here
      // too removes the startup layout jump while Capacitor detects the tag.
      initialViewportFitValueHint: 'cover',
      // Dark UI -> light system-bar icons.
      style: 'DARK',
    },
  },
};

export default config;
