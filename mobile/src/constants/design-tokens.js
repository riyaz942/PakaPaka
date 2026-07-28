/**
 * Shared hex values for tailwind.config.js and programmatic StyleSheet use.
 * Prefer NativeWind className tokens in new UI; use these when APIs require raw colors.
 */

/** Expo template splash/icon branding — not part of UX-DR2 semantic palette */
const expoBrand = {
  splash: '#208aef',
  splashGradientStart: '#3c9ffe',
  splashGradientEnd: '#0274df',
};

/**
 * UX-DR2 semantic palette for APIs that need raw hex (e.g. NativeTabs).
 * Keep in sync with `src/global.css` :root / prefers-color-scheme dark overrides.
 */
const semanticColors = {
  light: {
    background: '#f8f8fa',
    surface: '#ffffff',
    border: '#d8d8e0',
    primary: '#1a1a2e',
    secondary: '#686878',
    muted: '#9898a8',
    onPrimary: '#ffffff',
    feedbackInfo: '#2d6fc9',
  },
  dark: {
    background: '#0a0a0f',
    surface: '#141420',
    border: '#2a2a3c',
    primary: '#eeeef0',
    secondary: '#9898a8',
    muted: '#5c5c6e',
    onPrimary: '#0a0a0f',
    feedbackInfo: '#4488ee',
  },
};

module.exports = {
  expoBrand,
  semanticColors,
};
