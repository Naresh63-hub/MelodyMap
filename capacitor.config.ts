import type { CapacitorConfig } from '@capacitor/cli';

const isDev = process.env.NODE_ENV === 'development' || process.env.CAPACITOR_ENV === 'development';

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
    // targetSdk 36 → Android 15+ enforces edge-to-edge: the WebView draws
    // under the status/navigation bars. 'auto' adjusts WebView margins at
    // runtime (API 35+ only) so content sits between the system bars.
    adjustMarginsForEdgeToEdge: 'auto',
  },
};

export default config;
