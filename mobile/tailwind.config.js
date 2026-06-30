const { expoBrand } = require('./src/constants/design-tokens');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // UX-DR2 — surfaces & text (CSS variables; dark-first in global.css :root)
        background: 'var(--color-background)',
        surface: 'var(--color-surface)',
        'surface-elevated': 'var(--color-surface-elevated)',
        'surface-hover': 'var(--color-surface-hover)',
        border: 'var(--color-border)',
        primary: 'var(--color-primary)',
        secondary: 'var(--color-secondary)',
        muted: 'var(--color-muted)',

        // UX-DR2 — SRS stages
        'srs-apprentice': 'var(--color-srs-apprentice)',
        'srs-guru': 'var(--color-srs-guru)',
        'srs-master': 'var(--color-srs-master)',
        'srs-enlightened': 'var(--color-srs-enlightened)',
        'srs-burned': 'var(--color-srs-burned)',

        // UX-DR2 — feedback
        'feedback-correct': 'var(--color-feedback-correct)',
        'feedback-incorrect': 'var(--color-feedback-incorrect)',
        'feedback-warning': 'var(--color-feedback-warning)',
        'feedback-info': 'var(--color-feedback-info)',

        // UX-DR2 — cognitive load ring stops
        'ring-start': 'var(--color-ring-start)',
        'ring-mid': 'var(--color-ring-mid)',
        'ring-end': 'var(--color-ring-end)',
        'ring-complete': 'var(--color-ring-complete)',

        // UX-DR2 — content-type accents
        'content-radical': 'var(--color-content-radical)',
        'content-kanji': 'var(--color-content-kanji)',
        'content-vocabulary': 'var(--color-content-vocabulary)',
        'content-grammar': 'var(--color-content-grammar)',
        'content-reading': 'var(--color-content-reading)',

        // UX-DR2 — reinforcement
        'reinforcement-text': 'var(--color-reinforcement-text)',
        'reinforcement-bg': 'var(--color-reinforcement-bg)',

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
