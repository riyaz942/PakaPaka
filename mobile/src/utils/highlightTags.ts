/**
 * Highlight tags the mnemonic pipeline emits (content pipeline Rev 2, extended
 * to radical `mnemonic_text` in Rev 3).
 *
 * `AnnotatedText` renders them in the content accent colors. Anywhere the same
 * prose is consumed as a plain string instead — an accessibility label, the
 * caption an illustration falls back to — the markup has to come off first, or
 * a screen reader reads out "less-than radical greater-than".
 */
export const HIGHLIGHT_TAG_RE = /<(radical|kanji|reading)>([\s\S]*?)<\/\1>/g;

/** The prose with its highlight markup removed and nothing else changed. */
export function stripHighlightTags(text: string): string {
  return text.replace(HIGHLIGHT_TAG_RE, '$2');
}
