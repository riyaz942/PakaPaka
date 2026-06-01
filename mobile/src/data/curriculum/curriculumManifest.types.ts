export type CurriculumManifest = {
  version: string;
  url: string;
  sha256: string;
  size_bytes?: number;
  published_at?: string;
};

export type CurriculumUpdateSource = 'bundled' | 'downloaded';
