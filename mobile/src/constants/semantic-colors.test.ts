import { semanticColors } from './semantic-colors';

/** Values must match `src/global.css` CSS variables. */
const globalCssSemantic = {
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
} as const;

describe('semanticColors', () => {
  it.each(['dark', 'light'] as const)('matches global.css for %s scheme', (scheme) => {
    expect(semanticColors[scheme]).toEqual(globalCssSemantic[scheme]);
  });
});
