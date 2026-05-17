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
        'srs-apprentice': '#dd4488',
        'srs-guru': '#8844cc',
        'srs-master': '#3388dd',
        'srs-enlightened': '#00aadd',
        'srs-burned': '#ccaa00',

        // UX-DR2 — feedback
        'feedback-correct': '#22cc88',
        'feedback-incorrect': '#ee4466',
        'feedback-warning': '#eeaa22',
        'feedback-info': '#4488ee',

        // UX-DR2 — cognitive load ring stops
        'ring-start': '#22cc88',
        'ring-mid': '#eecc44',
        'ring-end': '#ee8833',
        'ring-complete': '#44bbee',

        // UX-DR2 — content-type accents
        'content-radical': '#44aaee',
        'content-kanji': '#ee4488',
        'content-vocabulary': '#aa44dd',
        'content-grammar': '#22bbaa',
        'content-reading': '#eeaa22',

        // UX-DR2 — reinforcement
        'reinforcement-text': '#6688bb',
        'reinforcement-bg': '#1a2233',
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
  plugins: [
    function ({ addVariant }) {
      addVariant('light', '@media (prefers-color-scheme: light)');
    },
  ],
};
