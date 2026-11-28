/**
 * One-off: creates curriculum/id-registry.json from an existing compiled
 * curriculum.db, so the ids that build shipped with become permanent. It ran
 * one time, on the level-agnostic plan's phase 0 build (curriculum version 22).
 * After that, the compiler owns the registry (`--update-registry`).
 *
 * Usage: npx tsx scripts/seed-id-registry.ts [path/to/curriculum.db]
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

import { ID_REGISTRY_FILE, type IdRegistrySection, writeIdRegistry } from './id-registry';

const REPO_ROOT = process.cwd();
const CURRICULUM_DIR = path.join(REPO_ROOT, 'curriculum');
const DEFAULT_SOURCE = path.join(REPO_ROOT, 'mobile', 'assets', 'curriculum-seed', 'curriculum.db');

type SourcePassage = { slug: string; title: string; questions?: unknown[] };

function sectionFrom(ids: Record<string, number>): IdRegistrySection {
  const maxId = Math.max(0, ...Object.values(ids));
  return { next_id: maxId + 1, ids, retired: {}, aliases: {} };
}

function main(): void {
  const sourcePath = path.resolve(process.argv[2] ?? DEFAULT_SOURCE);
  if (fs.existsSync(path.join(CURRICULUM_DIR, ID_REGISTRY_FILE))) {
    throw new Error(`curriculum/${ID_REGISTRY_FILE} already exists. This script only creates it.`);
  }

  const db = new Database(sourcePath, { readonly: true });
  try {
    const itemIds: Record<string, number> = {};
    for (const row of db
      .prepare('SELECT item_type, slug, id FROM items ORDER BY id')
      .all() as { item_type: string; slug: string; id: number }[]) {
      itemIds[`${row.item_type}:${row.slug}`] = row.id;
    }

    // Passages had no slug in the build, so each row is matched to the slug the
    // source JSON now carries, by title (a passage's level is on the passage, and
    // a level move must not break the match).
    const slugByTitle = new Map<string, SourcePassage>();
    for (const name of fs.readdirSync(path.join(CURRICULUM_DIR, 'readings'))) {
      const file = JSON.parse(
        fs.readFileSync(path.join(CURRICULUM_DIR, 'readings', name), 'utf8'),
      ) as { passages: SourcePassage[] };
      for (const passage of file.passages) {
        if (slugByTitle.has(passage.title)) {
          throw new Error(`Two passages have the title ${passage.title}`);
        }
        slugByTitle.set(passage.title, passage);
      }
    }

    const passageIds: Record<string, number> = {};
    const passageById = new Map<number, SourcePassage>();
    for (const row of db
      .prepare('SELECT id, title FROM reading_passages ORDER BY id')
      .all() as { id: number; title: string }[]) {
      const passage = slugByTitle.get(row.title);
      if (!passage) {
        throw new Error(`No source passage for "${row.title}" (id ${row.id})`);
      }
      passageIds[`passage:${passage.slug}`] = row.id;
      passageById.set(row.id, passage);
    }
    if (passageById.size !== slugByTitle.size) {
      throw new Error(
        `The build has ${passageById.size} passages, the source JSON has ${slugByTitle.size}`,
      );
    }

    const questionIds: Record<string, number> = {};
    const questionCount = new Map<number, number>();
    for (const row of db
      .prepare('SELECT id, passage_id, sort_order FROM passage_questions ORDER BY passage_id, id')
      .all() as { id: number; passage_id: number; sort_order: number }[]) {
      const index = questionCount.get(row.passage_id) ?? 0;
      if (row.sort_order !== index) {
        throw new Error(`Question ${row.id} has sort_order ${row.sort_order}, expected ${index}`);
      }
      questionCount.set(row.passage_id, index + 1);
      questionIds[`${passageById.get(row.passage_id)!.slug}#${index}`] = row.id;
    }
    for (const [passageId, passage] of passageById) {
      const expected = passage.questions?.length ?? 0;
      if ((questionCount.get(passageId) ?? 0) !== expected) {
        throw new Error(`Passage ${passage.slug}: the build and the source JSON differ in question count`);
      }
    }

    writeIdRegistry(CURRICULUM_DIR, {
      items: sectionFrom(itemIds),
      passages: sectionFrom(passageIds),
      passage_questions: sectionFrom(questionIds),
    });
    console.log(
      `Wrote curriculum/${ID_REGISTRY_FILE}: ${Object.keys(itemIds).length} items, ` +
        `${Object.keys(passageIds).length} passages, ${Object.keys(questionIds).length} questions.`,
    );
  } finally {
    db.close();
  }
}

main();
