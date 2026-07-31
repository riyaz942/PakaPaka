import { stripHighlightTags } from '@/utils/highlightTags';

/**
 * The label read out for a mnemonic illustration, and the text shown in its
 * place when there is no image. Highlight markup is stripped: this is a plain
 * string, so a `<radical>` left in it would be announced verbatim.
 */
export function buildMnemonicAccessibilityLabel(
  mnemonicText?: string | null,
  meaning?: string | null,
  primaryForm?: string | null,
): string {
  if (mnemonicText?.trim()) {
    return stripHighlightTags(mnemonicText.trim());
  }

  if (meaning?.trim() && primaryForm?.trim()) {
    return `${meaning.trim()} (${primaryForm.trim()})`;
  }

  if (meaning?.trim()) {
    return meaning.trim();
  }

  if (primaryForm?.trim()) {
    return primaryForm.trim();
  }

  return 'Mnemonic image unavailable';
}
