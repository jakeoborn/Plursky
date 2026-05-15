import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.plursky.app',
  appName: 'Plursky',
  webDir: 'dist',
  ios: {
    // `never`: the WKWebView's UIScrollView does NOT apply safe-area insets,
    // because the page already handles them in CSS via env(safe-area-inset-*)
    // (see `--top-pad` in index.html and `paddingTop` on the app shell in
    // app.jsx). With `always` we got double-counted insets — the tab bar
    // ended up clipped below the visible area and the page's internal
    // ScrollBody fought the WebView's outer scroll, making the app feel
    // unscrollable on iPhone.
    contentInset: 'never',
  },
};

export default config;
