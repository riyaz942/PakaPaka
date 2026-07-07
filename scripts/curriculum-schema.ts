/**
 * Target curriculum.db DDL — mirrors _bmad-output/planning-artifacts/db-schema-diagram.md
 */
export const CURRICULUM_DDL = `
CREATE TABLE curriculum_metadata (
  version TEXT PRIMARY KEY NOT NULL,
  build_date TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  radical_count INTEGER NOT NULL,
  kanji_count INTEGER NOT NULL,
  vocabulary_count INTEGER NOT NULL,
  grammar_count INTEGER NOT NULL
);

CREATE TABLE items (
  id INTEGER PRIMARY KEY NOT NULL,
  item_type TEXT NOT NULL CHECK(item_type IN ('radical', 'kanji', 'vocabulary', 'grammar')),
  jlpt_level TEXT NOT NULL,
  slug TEXT NOT NULL,
  primary_form TEXT NOT NULL,
  furigana TEXT,
  meaning TEXT NOT NULL,
  mnemonic_text TEXT,
  visual_mnemonic_url TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (item_type, slug)
);

CREATE TABLE kanji_readings (
  id INTEGER PRIMARY KEY NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  reading_type TEXT NOT NULL CHECK(reading_type IN ('onyomi', 'kunyomi')),
  reading TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE accepted_answers (
  id INTEGER PRIMARY KEY NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  answer_type TEXT NOT NULL CHECK(answer_type IN ('meaning', 'reading', 'production')),
  answer_text TEXT NOT NULL,
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE grammar_rules (
  id INTEGER PRIMARY KEY NOT NULL,
  item_id INTEGER NOT NULL UNIQUE REFERENCES items(id),
  structure TEXT NOT NULL,
  conjugation_rules TEXT NOT NULL,
  accepted_forms TEXT NOT NULL
);

CREATE TABLE example_sentences (
  id INTEGER PRIMARY KEY NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  japanese TEXT NOT NULL,
  furigana TEXT,
  english TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  reinforcement_tags TEXT
);

CREATE TABLE item_relationships (
  id INTEGER PRIMARY KEY NOT NULL,
  parent_item_id INTEGER NOT NULL REFERENCES items(id),
  child_item_id INTEGER NOT NULL REFERENCES items(id),
  relationship_type TEXT NOT NULL CHECK(relationship_type IN ('requires', 'builds_on', 'reinforces'))
);

CREATE TABLE grammar_vocabulary_links (
  id INTEGER PRIMARY KEY NOT NULL,
  grammar_item_id INTEGER NOT NULL REFERENCES items(id),
  vocabulary_item_id INTEGER NOT NULL REFERENCES items(id)
);

CREATE TABLE reading_passages (
  id INTEGER PRIMARY KEY NOT NULL,
  jlpt_level TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  body_furigana TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE passage_questions (
  id INTEGER PRIMARY KEY NOT NULL,
  passage_id INTEGER NOT NULL REFERENCES reading_passages(id),
  prompt TEXT NOT NULL,
  prompt_furigana TEXT,
  accepted_answers TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE external_id_mappings (
  id INTEGER PRIMARY KEY NOT NULL,
  source TEXT NOT NULL CHECK(source IN ('wanikani', 'bunpro', 'anki')),
  external_id TEXT NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id)
);

CREATE INDEX idx_items_item_type ON items(item_type);
CREATE INDEX idx_items_jlpt_level ON items(jlpt_level);
CREATE INDEX idx_item_relationships_parent ON item_relationships(parent_item_id);
CREATE INDEX idx_item_relationships_child ON item_relationships(child_item_id);
CREATE INDEX idx_external_id_mappings_source_external_id ON external_id_mappings(source, external_id);
`;

export type ItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export type RelationshipType = 'requires' | 'builds_on' | 'reinforces';
