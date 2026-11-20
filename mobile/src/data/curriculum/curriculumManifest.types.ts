export type CurriculumManifest = {
  version: string;
  url: string;
  sha256: string;
  size_bytes?: number;
  published_at?: string;
};

export type CurriculumUpdateSource = 'bundled' | 'downloaded';

/** A verified, signed curriculum release (see core/curriculum/manifestSignature.ts). */
export type CurriculumRelease = {
  schema: number;
  version: number;
  sha256: string;
  sizeBytes: number;
  publishedAt: string;
  keyId: string;
};
