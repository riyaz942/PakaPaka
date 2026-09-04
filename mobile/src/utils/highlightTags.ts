/**
 * Highlight tags the mnemonic pipeline emits (content pipeline Rev 2, extended
 * to radical `mnemonic_text` in Rev 3 and to `<vocabulary>` in vocab Rev 5).
 *
 * Each tag names one of four ideas, and every layer marks the same two things:
 * the pieces it borrows from the layer below, and the word its own story lands
 * on. A kanji borrows `<radical>` and lands on `<kanji>`; a word borrows
 * `<kanji>` and lands on `<vocabulary>`. `<reading>` is the sound, at any layer.
 *
 * `AnnotatedText` renders them in the content accent colors. Anywhere the same
 * prose is consumed as a plain string instead — an accessibility label, the
 * caption an illustration falls back to — the markup has to come off first, or
 * a screen reader reads out "less-than radical greater-than".
 */
export const HIGHLIGHT_TAG_RE = /<(radical|kanji|vocabulary|reading)>([\s\S]*?)<\/\1>/g;

/** The prose with its highlight markup removed and nothing else changed. */
export function stripHighlightTags(text: string): string {
  return text.replace(HIGHLIGHT_TAG_RE, '$2');
}
