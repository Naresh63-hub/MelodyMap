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
  },
};

export default config;
