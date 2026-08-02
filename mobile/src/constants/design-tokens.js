/**
 * Shared hex values for tailwind.config.js and programmatic StyleSheet use.
 * Prefer NativeWind className tokens in new UI; use these when APIs require raw colors.
 */

/** Expo template splash/icon branding — not part of the v2 semantic palette */
const expoBrand = {
  splash: '#208aef',
  splashGradientStart: '#3c9ffe',
  splashGradientEnd: '#0274df',
};

/**
 * Design System v2 palette for APIs that need raw hex (e.g. NativeTabs, SVG props).
 * Keep in sync with `src/global.css` :root / prefers-color-scheme dark overrides,
 * which store the same colors as sRGB channel triplets rather than hex.
 * `semantic-colors.test.ts` fails if the two drift apart.
 */
const semanticColors = {
  light: {
    background: '#f7f5f2',
    surface: '#ffffff',
    surfaceElevated: '#f2efea',
    border: '#e7e2db',
    primary: '#23201c',
    secondary: '#46423b',
    muted: '#7c766c',
    faint: '#a8a199',
    onPrimary: '#ffffff',
    brand: '#159e77',
    brandFill: '#0e8163',
    brandText: '#0c654e',
    feedbackInfo: '#2f84d0',
  },
  dark: {
    background: '#1b1917',
    surface: '#24211e',
    surfaceElevated: '#2d2a26',
    border: '#3a362f',
    primary: '#f6f3ee',
    secondary: '#d8d3ca',
    muted: '#a29c90',
    faint: '#726c61',
    onPrimary: '#ffffff',
    brand: '#159e77',
    brandFill: '#0e8163',
    brandText: '#66cbab',
    feedbackInfo: '#2f84d0',
  },
};

module.exports = {
  expoBrand,
  semanticColors,
};
