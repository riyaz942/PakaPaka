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
  -- Part of speech, vocabulary only ("い adjective", "adverb, noun"). Distilled
  -- from JMdict by curriculum/_build/import/build_vocab_word_types.py; null on
  -- every other item type, and on the compound forms taught as grammar.
  word_type TEXT,
  -- How the conjugator inflects the word, verbs and い / な adjectives only
  -- ("godan", "ichidan", "godan-iku", "adj-ii", ...). Derived from JMdict's first
  -- sense plus a reviewed override list by build_vocab_word_types.py; null when
  -- the word gets no conjugation table.
  conjugation_class TEXT,
  -- The verb that is this one's transitive / intransitive counterpart (開ける <->
  -- 開く), vocabulary only. Hand-checked pairs from vocab_transitivity_pairs.json,
  -- linked both ways; null for every other word.
  transitivity_partner_id INTEGER REFERENCES items(id),
  -- How the reading is built, vocabulary only ("Jukugo — 人（じん）＋口（こう）,
  -- each kanji read with its on'yomi."). Computed from the word's kanji and
  -- their KANJIDIC readings by mnemonic_context.reading_composition, which is
  -- why most words ship no reading_mnemonic: this states the derivation, and a
  -- reading mnemonic is written only where the sound needs a memory hook.
  reading_composition TEXT,
  mnemonic_text TEXT,
  meaning_mnemonic TEXT,
  reading_mnemonic TEXT,
  description TEXT,
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
  accepted_forms TEXT NOT NULL,
  family TEXT CHECK(family IN ('particles', 'copula', 'conjugations', 'connectors', 'patterns')),
  explanation_markdown TEXT,
  caution_notes TEXT,
  uses TEXT,
  -- 1 for a card that is read once and never reviewed (the conjugation primer):
  -- finishing its lesson marks it known instead of seeding SRS.
  read_once INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE grammar_related_links (
  id INTEGER PRIMARY KEY NOT NULL,
  grammar_item_id INTEGER NOT NULL REFERENCES items(id),
  related_item_id INTEGER NOT NULL REFERENCES items(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Data-derived look-alike pairs on radical/kanji items (content pipeline
-- Rev 1). Stored directional per item in authored order; the pair dataset
-- itself is symmetric.
CREATE TABLE visually_similar_links (
  id INTEGER PRIMARY KEY NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  similar_item_id INTEGER NOT NULL REFERENCES items(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE example_sentences (
  id INTEGER PRIMARY KEY NOT NULL,
  item_id INTEGER NOT NULL REFERENCES items(id),
  japanese TEXT NOT NULL,
  furigana TEXT,
  english TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  reinforcement_tags TEXT,
  -- Grammar sentence pool (grammar Read + Build cards): where the grammar sits
  -- in japanese (same offsets as example_sentence_spans) and whether the
  -- sentence is polite or plain. Null on every non-grammar row.
  grammar_start INTEGER,
  grammar_end INTEGER,
  register TEXT CHECK(register IN ('polite', 'plain'))
);

-- Authored vocabulary links on example sentences (Plan 11.6). Which characters
-- each link covers lives in example_sentence_spans below; a link with no span
-- has no occurrence the pipeline could locate and stays inert.
CREATE TABLE example_sentence_vocab (
  id INTEGER PRIMARY KEY NOT NULL,
  sentence_id INTEGER NOT NULL REFERENCES example_sentences(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Word boundaries into example_sentences.japanese (feedback 14.1a), the
-- example-sentence twin of passage_word_spans: same UTF-16 offsets, same
-- ordered non-overlapping contract, same inflection column. Derived at build
-- time by the curriculum pipeline, never at runtime — a conjugated surface
-- (来ます) cannot be found by matching the linked item's primary_form (来る).
CREATE TABLE example_sentence_spans (
  id INTEGER PRIMARY KEY NOT NULL,
  sentence_id INTEGER NOT NULL REFERENCES example_sentences(id),
  item_id INTEGER NOT NULL REFERENCES items(id),
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  inflection TEXT CHECK(inflection IN ('masu', 'te', 'nai', 'ta')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Other accepted Build-card answers for a grammar pool sentence, in furigana
-- bracket notation. 'other_grammar' answers are correct Japanese that use a
-- different same-family grammar point; the app answers them with a retry
-- nudge instead of a grade. The sentence's own furigana is the main answer.
CREATE TABLE grammar_sentence_answers (
  id INTEGER PRIMARY KEY NOT NULL,
  sentence_id INTEGER NOT NULL REFERENCES example_sentences(id),
  answer_furigana TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('valid', 'other_grammar')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Build-card answer units (grammar mistake explanations spec): each accepted
-- answer cut into word / particle / other runs at build time, because the app
-- has no tokenizer. answer_id NULL = the sentence itself.
CREATE TABLE grammar_answer_units (
  id INTEGER PRIMARY KEY NOT NULL,
  sentence_id INTEGER NOT NULL REFERENCES example_sentences(id),
  answer_id INTEGER REFERENCES grammar_sentence_answers(id),
  position INTEGER NOT NULL,
  surface TEXT NOT NULL,
  reading TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('word', 'particle', 'other')),
  item_id INTEGER REFERENCES items(id),
  in_grammar INTEGER NOT NULL DEFAULT 0
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
  english_translation TEXT,
  summary_ja TEXT,
  summary_en TEXT,
  word_count INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- Word boundaries into reading_passages.body (Story 3.2 / FR70). Offsets are
-- UTF-16 (JavaScript string) indices into the body, inclusive start and
-- exclusive end, so body.slice(start_offset, end_offset) is the surface form.
-- Spans are derived by the curriculum pipeline, never auto-segmented at
-- runtime; unspanned text stays inert.
--
-- The inflection column is NULL when the surface is the item's dictionary form, and
-- otherwise names the taught inflection family the surface belongs to
-- (feedback 14.1a): 'masu' 来ます, 'te' 走って, 'nai' 食べない, 'ta' 開けた. An
-- inflected span still points at the *base* vocabulary item.
CREATE TABLE passage_word_spans (
  id INTEGER PRIMARY KEY NOT NULL,
  passage_id INTEGER NOT NULL REFERENCES reading_passages(id),
  vocabulary_item_id INTEGER NOT NULL REFERENCES items(id),
  start_offset INTEGER NOT NULL,
  end_offset INTEGER NOT NULL,
  inflection TEXT CHECK(inflection IN ('masu', 'te', 'nai', 'ta')),
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE passage_grammar_links (
  id INTEGER PRIMARY KEY NOT NULL,
  passage_id INTEGER NOT NULL REFERENCES reading_passages(id),
  grammar_item_id INTEGER NOT NULL REFERENCES items(id)
);

CREATE TABLE passage_vocabulary_links (
  id INTEGER PRIMARY KEY NOT NULL,
  passage_id INTEGER NOT NULL REFERENCES reading_passages(id),
  vocabulary_item_id INTEGER NOT NULL REFERENCES items(id)
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

CREATE INDEX idx_grammar_related_links_item ON grammar_related_links(grammar_item_id);
CREATE INDEX idx_visually_similar_links_item ON visually_similar_links(item_id);
CREATE INDEX idx_passage_grammar_links_passage ON passage_grammar_links(passage_id);
CREATE INDEX idx_passage_vocabulary_links_passage ON passage_vocabulary_links(passage_id);
CREATE INDEX idx_passage_word_spans_passage ON passage_word_spans(passage_id);
CREATE INDEX idx_example_sentence_spans_sentence ON example_sentence_spans(sentence_id);
CREATE INDEX idx_grammar_sentence_answers_sentence ON grammar_sentence_answers(sentence_id);
CREATE INDEX idx_grammar_answer_units_sentence ON grammar_answer_units(sentence_id);
CREATE INDEX idx_kanji_readings_item ON kanji_readings(item_id);
CREATE INDEX idx_accepted_answers_item ON accepted_answers(item_id, answer_type);
CREATE INDEX idx_accepted_answers_text ON accepted_answers(answer_type, answer_text);
CREATE INDEX idx_items_item_type ON items(item_type);
CREATE INDEX idx_items_jlpt_level ON items(jlpt_level);
CREATE INDEX idx_item_relationships_parent ON item_relationships(parent_item_id);
CREATE INDEX idx_item_relationships_child ON item_relationships(child_item_id);
CREATE INDEX idx_external_id_mappings_source_external_id ON external_id_mappings(source, external_id);
`;

export type ItemType = 'radical' | 'kanji' | 'vocabulary' | 'grammar';

export type RelationshipType = 'requires' | 'builds_on' | 'reinforces';
