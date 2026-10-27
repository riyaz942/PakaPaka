import { isIgnoredBuildChar, toHiragana } from '@/core/grammar/buildEvaluator';

/** `rawIndex[i]` = raw offset of `text[i]`; `rawIndex[text.length]` = raw length. */
export type NormalizedText = { text: string; rawIndex: number[] };

/** Same text as `normalizeBuildText`, plus where each kept character sat in the raw input. */
export function normalizeWithMap(raw: string): NormalizedText {
  let text = '';
  const rawIndex: number[] = [];
  for (let i = 0; i < raw.length; i++) {
    if (isIgnoredBuildChar(raw[i])) continue;
    text += toHiragana(raw[i]);
    rawIndex.push(i);
  }
  rawIndex.push(raw.length);
  return { text, rawIndex };
}
