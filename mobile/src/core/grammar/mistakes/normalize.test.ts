import { normalizeBuildText } from '@/core/grammar/buildEvaluator';

import { normalizeWithMap } from './normalize';

describe('normalizeWithMap', () => {
  it('maps kept characters to raw offsets and ends at the raw length', () => {
    expect(normalizeWithMap('コート、着ます')).toEqual({
      text: 'こーと着ます',
      rawIndex: [0, 1, 2, 4, 5, 6, 7],
    });
  });

  it('gives the same text as normalizeBuildText', () => {
    const raw = ' コート、「着ます」。 Hello! ガ ギ　ヶ ';
    expect(normalizeWithMap(raw).text).toBe(normalizeBuildText(raw));
  });

  it('handles empty and fully ignored input', () => {
    expect(normalizeWithMap('')).toEqual({ text: '', rawIndex: [0] });
    expect(normalizeWithMap(' 。')).toEqual({ text: '', rawIndex: [2] });
  });
});
