export type DocumentPickerResult = {
  canceled: boolean;
  assets?: Array<{
    uri: string;
    name?: string;
    mimeType?: string;
    size?: number;
  }>;
};

let nextResult: DocumentPickerResult = { canceled: true };

export function __mockSetDocumentPickerResult(result: DocumentPickerResult) {
  nextResult = result;
}

export function __mockResetDocumentPicker() {
  nextResult = { canceled: true };
}

export async function getDocumentAsync(
  _options?: Record<string, unknown>,
): Promise<DocumentPickerResult> {
  return nextResult;
}
