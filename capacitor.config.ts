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
    },
    // Fixes a native-only bug (Aaron caught it on-device, v14): unlike a browser tab, the native
    // WebView has no chrome of its own pushing content down, so anything pinned to the very top of
    // the page — the app header, and especially the tour guide banner — renders underneath/behind
    // the phone's own status bar (clock, battery, signal icons) instead of below it. Applied here
    // (native-launch config, before any JS runs) so there's no flash of the wrong layout on cold
    // start; also called at runtime in index.html as a redundant safety net in case this config key
    // isn't honored by this plugin version.
    StatusBar: {
      overlaysWebView: false,
      backgroundColor: '#F8E8EE'
    }
  }
};

export default config;
