import { semanticColors } from './semantic-colors';

/** Values must match `src/global.css` CSS variables. */
const globalCssSemantic = {
  dark: {
    background: '#0a0a0f',
    primary: '#eeeef0',
    secondary: '#9898a8',
  },
  light: {
    background: '#f8f8fa',
    primary: '#1a1a2e',
    secondary: '#686878',
  },
} as const;

describe('semanticColors', () => {
  it.each(['dark', 'light'] as const)('matches global.css for %s scheme', (scheme) => {
    expect(semanticColors[scheme]).toEqual(globalCssSemantic[scheme]);
  });
});
