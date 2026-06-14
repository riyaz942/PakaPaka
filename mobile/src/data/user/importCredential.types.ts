export type ImportCredentialSource = 'wanikani' | 'bunpro';

export const IMPORT_CREDENTIAL_KEYS: Record<ImportCredentialSource, string> = {
  wanikani: 'import_credential_wanikani',
  bunpro: 'import_credential_bunpro',
};

export function isImportCredentialSource(value: string): value is ImportCredentialSource {
  return value === 'wanikani' || value === 'bunpro';
}
