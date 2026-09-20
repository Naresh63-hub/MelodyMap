import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.melodymap.music',
  appName: 'MelodyMap',
  webDir: 'dist/client',
  server: {
    url: 'https://melodymap-pi.vercel.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#0a0a0f',
  },
};

export default config;
