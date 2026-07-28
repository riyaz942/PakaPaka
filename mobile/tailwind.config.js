const { expoBrand } = require('./src/constants/design-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // UX-DR2 — surfaces & text. Tokens are channel triplets in global.css so the
        // `<alpha-value>` wrapper lets opacity modifiers (`bg-surface/15`) compile.
        // Light is the base palette; dark overrides live in the media query.
        background: 'rgb(var(--color-background) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-elevated': 'rgb(var(--color-surface-elevated) / <alpha-value>)',
        'surface-hover': 'rgb(var(--color-surface-hover) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        muted: 'rgb(var(--color-muted) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',

        // UX-DR2 — SRS stages
        'srs-apprentice': 'rgb(var(--color-srs-apprentice) / <alpha-value>)',
        'srs-guru': 'rgb(var(--color-srs-guru) / <alpha-value>)',
        'srs-master': 'rgb(var(--color-srs-master) / <alpha-value>)',
        'srs-enlightened': 'rgb(var(--color-srs-enlightened) / <alpha-value>)',
        'srs-burned': 'rgb(var(--color-srs-burned) / <alpha-value>)',

        // UX-DR2 — feedback
        'feedback-correct': 'rgb(var(--color-feedback-correct) / <alpha-value>)',
        'feedback-incorrect': 'rgb(var(--color-feedback-incorrect) / <alpha-value>)',
        'feedback-warning': 'rgb(var(--color-feedback-warning) / <alpha-value>)',
        'feedback-info': 'rgb(var(--color-feedback-info) / <alpha-value>)',

        // UX-DR2 — cognitive load ring stops
        'ring-start': 'rgb(var(--color-ring-start) / <alpha-value>)',
        'ring-mid': 'rgb(var(--color-ring-mid) / <alpha-value>)',
        'ring-end': 'rgb(var(--color-ring-end) / <alpha-value>)',
        'ring-complete': 'rgb(var(--color-ring-complete) / <alpha-value>)',

        // UX-DR2 — content-type accents
        'content-radical': 'rgb(var(--color-content-radical) / <alpha-value>)',
        'content-kanji': 'rgb(var(--color-content-kanji) / <alpha-value>)',
        'content-vocabulary': 'rgb(var(--color-content-vocabulary) / <alpha-value>)',
        'content-grammar': 'rgb(var(--color-content-grammar) / <alpha-value>)',
        'content-reading': 'rgb(var(--color-content-reading) / <alpha-value>)',

        // UX-DR2 — reinforcement
        'reinforcement-text': 'rgb(var(--color-reinforcement-text) / <alpha-value>)',
        'reinforcement-bg': 'rgb(var(--color-reinforcement-bg) / <alpha-value>)',

        // Expo template splash/icon (design-tokens.js — programmatic StyleSheet only)
        'expo-splash': expoBrand.splash,
        'expo-splash-light': expoBrand.splashGradientStart,
        'expo-splash-dark': expoBrand.splashGradientEnd,
      },
      // UX-DR3 — typography scale
      fontSize: {
        display: ['48px', { lineHeight: '1.1', fontWeight: '700' }],
        'title-lg': ['28px', { lineHeight: '1.2', fontWeight: '700' }],
        title: ['22px', { lineHeight: '1.3', fontWeight: '600' }],
        'body-lg': ['18px', { lineHeight: '1.5', fontWeight: '400' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
        caption: ['12px', { lineHeight: '1.3', fontWeight: '500' }],
        overline: ['11px', { lineHeight: '1.2', fontWeight: '600' }],
        furigana: ['9px', { lineHeight: '1.1', fontWeight: '400' }],
      },
      // UX-DR3 — spacing (4px base)
      spacing: {
        'space-xs': '4px',
        'space-sm': '8px',
        'space-md': '16px',
        'space-lg': '24px',
        'space-xl': '32px',
        'space-2xl': '48px',
      },
      // UX-DR3 — radii
      borderRadius: {
        'radius-sm': '6px',
        'radius-md': '12px',
        'radius-lg': '20px',
        'radius-full': '9999px',
      },
    },
  },
};
