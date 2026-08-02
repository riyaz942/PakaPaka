/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // v2 — surfaces & text. Tokens are channel triplets in global.css so the
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
        faint: 'rgb(var(--color-faint) / <alpha-value>)',
        'on-primary': 'rgb(var(--color-on-primary) / <alpha-value>)',

        // v2 — brand jade. `brand-600` is the filled-button step (white labels
        // clear AA on it); `brand-text` is jade *text* on background/surface.
        'brand-50': 'rgb(var(--color-brand-50) / <alpha-value>)',
        'brand-100': 'rgb(var(--color-brand-100) / <alpha-value>)',
        'brand-200': 'rgb(var(--color-brand-200) / <alpha-value>)',
        'brand-300': 'rgb(var(--color-brand-300) / <alpha-value>)',
        'brand-400': 'rgb(var(--color-brand-400) / <alpha-value>)',
        'brand-500': 'rgb(var(--color-brand-500) / <alpha-value>)',
        'brand-600': 'rgb(var(--color-brand-600) / <alpha-value>)',
        'brand-700': 'rgb(var(--color-brand-700) / <alpha-value>)',
        'brand-800': 'rgb(var(--color-brand-800) / <alpha-value>)',
        'brand-900': 'rgb(var(--color-brand-900) / <alpha-value>)',
        'brand-text': 'rgb(var(--color-brand-text) / <alpha-value>)',
        'brand-soft': 'rgb(var(--color-brand-soft) / <alpha-value>)',
        'brand-soft-strong': 'rgb(var(--color-brand-soft-strong) / <alpha-value>)',

        // v2 — SRS stages
        'srs-apprentice': 'rgb(var(--color-srs-apprentice) / <alpha-value>)',
        'srs-guru': 'rgb(var(--color-srs-guru) / <alpha-value>)',
        'srs-master': 'rgb(var(--color-srs-master) / <alpha-value>)',
        'srs-enlightened': 'rgb(var(--color-srs-enlightened) / <alpha-value>)',
        'srs-enlightened-deep': 'rgb(var(--color-srs-enlightened-deep) / <alpha-value>)',
        'srs-burned': 'rgb(var(--color-srs-burned) / <alpha-value>)',

        // v2 — feedback: base = icon/border, soft = fill, deep = text on soft
        'feedback-correct': 'rgb(var(--color-feedback-correct) / <alpha-value>)',
        'feedback-correct-soft': 'rgb(var(--color-feedback-correct-soft) / <alpha-value>)',
        'feedback-correct-deep': 'rgb(var(--color-feedback-correct-deep) / <alpha-value>)',
        'feedback-incorrect': 'rgb(var(--color-feedback-incorrect) / <alpha-value>)',
        'feedback-incorrect-soft': 'rgb(var(--color-feedback-incorrect-soft) / <alpha-value>)',
        'feedback-incorrect-deep': 'rgb(var(--color-feedback-incorrect-deep) / <alpha-value>)',
        'feedback-incorrect-fill': 'rgb(var(--color-feedback-incorrect-fill) / <alpha-value>)',
        'feedback-warning': 'rgb(var(--color-feedback-warning) / <alpha-value>)',
        'feedback-warning-soft': 'rgb(var(--color-feedback-warning-soft) / <alpha-value>)',
        'feedback-warning-deep': 'rgb(var(--color-feedback-warning-deep) / <alpha-value>)',
        'feedback-info': 'rgb(var(--color-feedback-info) / <alpha-value>)',
        'feedback-info-soft': 'rgb(var(--color-feedback-info-soft) / <alpha-value>)',
        'feedback-info-deep': 'rgb(var(--color-feedback-info-deep) / <alpha-value>)',

        // v2 — the goal ring: one jade fill, no band stops
        ring: 'rgb(var(--color-ring) / <alpha-value>)',

        // v2 — content types: base = glyph/chip/edge, soft = fill, deep = text on soft
        'content-radical': 'rgb(var(--color-content-radical) / <alpha-value>)',
        'content-radical-soft': 'rgb(var(--color-content-radical-soft) / <alpha-value>)',
        'content-radical-deep': 'rgb(var(--color-content-radical-deep) / <alpha-value>)',
        'content-kanji': 'rgb(var(--color-content-kanji) / <alpha-value>)',
        'content-kanji-soft': 'rgb(var(--color-content-kanji-soft) / <alpha-value>)',
        'content-kanji-deep': 'rgb(var(--color-content-kanji-deep) / <alpha-value>)',
        'content-vocabulary': 'rgb(var(--color-content-vocabulary) / <alpha-value>)',
        'content-vocabulary-soft': 'rgb(var(--color-content-vocabulary-soft) / <alpha-value>)',
        'content-vocabulary-deep': 'rgb(var(--color-content-vocabulary-deep) / <alpha-value>)',
        'content-grammar': 'rgb(var(--color-content-grammar) / <alpha-value>)',
        'content-grammar-soft': 'rgb(var(--color-content-grammar-soft) / <alpha-value>)',
        'content-grammar-deep': 'rgb(var(--color-content-grammar-deep) / <alpha-value>)',
        'content-passage': 'rgb(var(--color-content-passage) / <alpha-value>)',
        'content-passage-soft': 'rgb(var(--color-content-passage-soft) / <alpha-value>)',
        'content-passage-deep': 'rgb(var(--color-content-passage-deep) / <alpha-value>)',

        // v2 — reinforcement
        'reinforcement-text': 'rgb(var(--color-reinforcement-text) / <alpha-value>)',
        'reinforcement-bg': 'rgb(var(--color-reinforcement-bg) / <alpha-value>)',
      },
      // v2 — font families. Static Google Fonts register one family per weight, so
      // `font-bold` cannot switch face: pick the utility that carries the weight.
      fontFamily: {
        ui: ['PlusJakartaSans_400Regular'],
        'ui-medium': ['PlusJakartaSans_500Medium'],
        'ui-semibold': ['PlusJakartaSans_600SemiBold'],
        'ui-bold': ['PlusJakartaSans_700Bold'],
        'ui-extrabold': ['PlusJakartaSans_800ExtraBold'],
        jp: ['NotoSansJP_400Regular'],
        'jp-medium': ['NotoSansJP_500Medium'],
        'jp-bold': ['NotoSansJP_700Bold'],
        'jp-black': ['NotoSansJP_900Black'],
        'jp-round': ['ZenMaruGothic_500Medium'],
        'jp-round-bold': ['ZenMaruGothic_700Bold'],
        'jp-round-black': ['ZenMaruGothic_900Black'],
      },
      // v2 — typography scale
      fontSize: {
        display: ['40px', { lineHeight: '1.05', fontWeight: '800' }],
        'title-lg': ['28px', { lineHeight: '1.1', fontWeight: '800' }],
        title: ['20px', { lineHeight: '1.2', fontWeight: '700' }],
        'body-lg': ['18px', { lineHeight: '1.5', fontWeight: '400' }],
        body: ['16px', { lineHeight: '1.5', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.4', fontWeight: '400' }],
        label: ['14px', { lineHeight: '1.4', fontWeight: '600' }],
        caption: ['12px', { lineHeight: '1.4', fontWeight: '500' }],
        overline: ['12px', { lineHeight: '1.2', fontWeight: '700' }],
        furigana: ['9px', { lineHeight: '1.1', fontWeight: '400' }],
      },
      // v2 — spacing (4px base, 16 = screen gutter)
      spacing: {
        'space-xs': '4px',
        'space-sm': '8px',
        'space-md': '16px',
        'space-lg': '24px',
        'space-xl': '32px',
        'space-2xl': '48px',
      },
      // v2 — radii
      borderRadius: {
        'radius-sm': '10px',
        'radius-md': '14px',
        'radius-lg': '18px',
        'radius-xl': '24px',
        'radius-full': '9999px',
      },
      // v2 — elevation. NativeWind maps a `shadow-*` utility to React Native's
      // single-layer shadow, so each level is the spec's two CSS layers merged
      // into the one that carries the depth; `elevation` feeds Android.
      boxShadow: {
        e1: '0 1px 3px rgba(31, 29, 26, 0.1)',
        e2: '0 10px 28px rgba(31, 29, 26, 0.1)',
        e3: '0 10px 40px rgba(31, 29, 26, 0.14)',
        'cta-glow': '0 8px 20px rgba(21, 158, 119, 0.3)',
      },
      elevation: {
        e1: 1,
        e2: 6,
        e3: 14,
        'cta-glow': 6,
      },
    },
  },
};
