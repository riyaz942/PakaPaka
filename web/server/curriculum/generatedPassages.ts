import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import type { SidecarMeta } from './types.js';

/**
 * Read-only view over the Phase 4 reading-passage build artifact.
 *
 * This is deliberately separate from `loader.ts`: that indexes *shipped*
 * curriculum under `curriculum/` (and skips `_build/`), while these passages
 * live at `curriculum/_build/generate_content/passages/level-NN.json` and do
 * not ship until a human reads the whole level and performs the wire-in
 * documented in docs/content/phase-4-reading-passage-tooling.md. Keeping them
 * out of the index is what stops them counting toward targets, appearing in
 * the graph, or being reachable by the bulk "Mark reviewed" action.
 *
 * Nothing here writes. Phase 5 review status is not Studio's to set.
 */

/** One planned passage from `reading_seeds.py`, generated or not. */
export type GeneratedSeedRow = {
  seed: string;
  position: number;
  tone: string;
  topic: string;
  targetWords: [number, number];
  questionCount: number;
  requiredGrammar: string[];
  /** The enriched passage, or null when this seed has not been generated. */
  passage: Record<string, unknown> | null;
  meta: SidecarMeta | undefined;
  wordCount: number | null;
};

export type GeneratedLevel = {
  /** Ladder level. */
  level: number;
  total: number;
  generated: number;
  rows: GeneratedSeedRow[];
};

export type GeneratedResponse =
  | { ok: true; levels: GeneratedLevel[] }
  | { ok: false; error: string };

/**
 * Printed by the venv Python so the seed ladder has exactly one source of
 * truth (`reading_seeds.py`). Inline rather than a checked-in script because
 * the generation lanes own that package and this is a consumer of it.
 */
const SEEDS_SCRIPT = `
import json, sys
sys.path.insert(0, '.')
from generate_content import reading_seeds as rs
out = {}
for level in sorted({rs.seed_level(s['slug']) for s in rs.SEEDS}):
    out[level] = [
        {
            'seed': s['slug'],
            'position': s['position'],
            'tone': s['tone'],
            'topic': s['topic'],
            'targetWords': list(s['target_words']),
            'questionCount': s['question_count'],
            'requiredGrammar': list(s.get('required_grammar', [])),
        }
        for s in rs.seeds_for(level)
    ]
print(json.dumps(out, ensure_ascii=False))
`;

type SeedRecord = Omit<GeneratedSeedRow, 'passage' | 'meta' | 'wordCount'>;

type ArtifactEntry = {
  seed?: string;
  position?: number;
  tone?: string;
  passage?: Record<string, unknown>;
};

function readSeeds(root: string): { ok: true; seeds: Record<string, SeedRecord[]> } | { ok: false; error: string } {
  const buildDir = path.join(root, 'curriculum', '_build');
  const pythonBin = path.join(buildDir, '.venv', 'bin', 'python');
  if (!fs.existsSync(pythonBin)) {
    return {
      ok: false,
      error: `Python venv not found at ${pythonBin} — run curriculum/_build's setup first`,
    };
  }

  // spawnSync is fine here where audit.ts needs async: this imports one plain
  // Python module with no tokenizer behind it (~80ms), not a multi-minute run.
  const result = spawnSync(pythonBin, ['-c', SEEDS_SCRIPT], {
    cwd: buildDir,
    encoding: 'utf8',
    maxBuffer: 8 * 1024 * 1024,
  });

  if (result.error) {
    return { ok: false, error: result.error.message };
  }
  if (result.status !== 0) {
    return {
      ok: false,
      error: result.stderr?.trim() || `reading_seeds read exited with code ${result.status}`,
    };
  }

  try {
    return { ok: true, seeds: JSON.parse(result.stdout) as Record<string, SeedRecord[]> };
  } catch {
    return { ok: false, error: 'reading_seeds did not print valid JSON' };
  }
}

function asMeta(meta: unknown): SidecarMeta | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  return meta as SidecarMeta;
}

function readArtifact(root: string, level: number): Map<string, ArtifactEntry> {
  const filePath = path.join(
    root, 'curriculum', '_build', 'generate_content', 'passages',
    `level-${String(level).padStart(2, '0')}.json`,
  );
  const bySeed = new Map<string, ArtifactEntry>();
  if (!fs.existsSync(filePath)) {
    return bySeed;
  }
  // Read fresh on every request rather than cached like `loader.ts`: the file
  // is rewritten by an ingest in another terminal and is a few KB per level,
  // so staleness costs more than the read does.
  const file = JSON.parse(fs.readFileSync(filePath, 'utf8')) as { passages?: ArtifactEntry[] };
  for (const entry of file.passages ?? []) {
    if (typeof entry.seed === 'string') {
      bySeed.set(entry.seed, entry);
    }
  }
  return bySeed;
}

export function loadGeneratedPassages(root: string): GeneratedResponse {
  const seeds = readSeeds(root);
  if (!seeds.ok) {
    return seeds;
  }

  const levels: GeneratedLevel[] = [];
  for (const [levelKey, seedRows] of Object.entries(seeds.seeds)) {
    const level = Number(levelKey);
    const bySeed = readArtifact(root, level);
    const rows: GeneratedSeedRow[] = [...seedRows]
      .sort((a, b) => a.position - b.position)
      .map((seed) => {
        const passage = bySeed.get(seed.seed)?.passage ?? null;
        const wordCount = passage && typeof passage.word_count === 'number' ? passage.word_count : null;
        return { ...seed, passage, meta: asMeta(passage?._meta), wordCount };
      });

    levels.push({
      level,
      total: rows.length,
      generated: rows.filter((row) => row.passage !== null).length,
      rows,
    });
  }

  levels.sort((a, b) => a.level - b.level);
  return { ok: true, levels };
}
