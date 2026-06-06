export function buildMnemonicAccessibilityLabel(
  mnemonicText?: string | null,
  meaning?: string | null,
  primaryForm?: string | null,
): string {
  if (mnemonicText?.trim()) {
    return mnemonicText.trim();
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

export function isValidMnemonicImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) {
    return false;
  }

  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
