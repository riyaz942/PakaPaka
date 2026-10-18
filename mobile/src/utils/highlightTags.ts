import { WORD_MARKER_RE } from '@/core/markdown/parseLessonMarkdown';

/**
 * Highlight tags the mnemonic pipeline emits (content pipeline Rev 2, extended
 * to radical `mnemonic_text` in Rev 3 and to `<vocabulary>` in vocab Rev 5).
 *
 * Each tag names one of four ideas, and every layer marks the same two things:
 * the pieces it borrows from the layer below, and the word its own story lands
 * on. A kanji borrows `<radical>` and lands on `<kanji>`; a word borrows
 * `<kanji>` and lands on `<vocabulary>`. `<reading>` is the sound, at any layer.
 * A radical that combines other radicals (動 = 重 + 力) borrows `<part>` and
 * lands on `<radical>`. A grammar mnemonic marks its meaning with `<grammar>`
 * (grammar mnemonics spec, 2026-10-17).
 *
 * A tag may also carry the character it stands for, in a `form` attribute:
 * `a <kanji form="少">few</kanji> <kanji form="年">years</kanji>` renders as
 * "a few (少) years (年)". The glyph lives in the attribute rather than in the
 * prose so the parenthesis, the Japanese font and the screen-reader label are
 * ours to decide. `<reading>` never carries one — its own text is the kana —
 * and every mnemonic written before the attribute existed simply has none.
 *
 * `AnnotatedText` renders them in the content accent colors. Anywhere the same
 * prose is consumed as a plain string instead — an accessibility label, the
 * caption an illustration falls back to — the markup has to come off first, or
 * a screen reader reads out "less-than radical greater-than".
 */
export const HIGHLIGHT_TAG_RE =
  /<(radical|part|kanji|vocabulary|reading|grammar)(?: form="([^"<>]*)")?>([\s\S]*?)<\/\1>/g;

/**
 * The prose with its highlight markup removed and nothing else changed. The
 * `form` glyph goes with the markup: it is a rendering instruction, not a word
 * of the sentence, and a screen reader announcing "(少)" mid-sentence reads the
 * character in the wrong language.
 */
export function stripHighlightTags(text: string): string {
  // A grammar mnemonic's example also carries lesson word markers
  // (`{{id|inflection|text}}`); like the tags, they are rendering instructions.
  return text.replace(HIGHLIGHT_TAG_RE, '$3').replace(WORD_MARKER_RE, '$3');
}
