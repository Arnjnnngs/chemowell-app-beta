import type { CapacitorConfig } from '@capacitor/cli';

// APP-BETA native shell (Capacitor). Loads the SAME live GitHub Pages build the
// installed PWA uses (server.url below) instead of bundling a local copy of
// index.html — this means our normal push-via-Chrome workflow keeps updating
// the app instantly, with no rebuild/resideload needed for content or UI
// changes. Only native-only concerns (this config, the android/ project, and
// notification bridging code in index.html gated by isNativeApp()) require a
// rebuild. See README.md version history for what changed and why.
const config: CapacitorConfig = {
  appId: 'com.chemowell.app',
  appName: 'ChemoWell',
  webDir: 'www',
  server: {
    url: 'https://arnjnnngs.github.io/chemowell-app-beta/',
    cleartext: false
  },
  plugins: {
    LocalNotifications: {
      smallIcon: 'ic_stat_chemowell',
      iconColor: '#C77800'
    }
  }
};

export default config;
