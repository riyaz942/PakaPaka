# Grammar Build Mistake Explanations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a grammar Build answer grades `incorrect`, mark each mistake on the learner's own sentence and explain it in one line that names the place, with no AI.

**Architecture:** The curriculum build cuts every accepted Build answer (the sentence and its `valid` alternates) into *answer units* (word / particle / other) with the fugashi tokenizer and stores them in a new `grammar_answer_units` table, plus a hand-checked transitive / intransitive partner per verb (`items.transitivity_partner_id`). On the device, a pure diagnoser lines up the learner's text with each answer's units (dynamic programming; each unit can match exactly, match a known wrong *variant*, be missing, or be replaced), keeps the cheapest alignment, and turns it into marks and lines. A new `BuildMistakeMarks` component renders them on the "Incorrect" screen.

**Tech Stack:** Python 3.12 + fugashi / unidic-lite (`curriculum/_build/.venv`), `unittest`; TypeScript compile script (`tsx`, `better-sqlite3`, jest at repo root); Expo / React Native, expo-sqlite, NativeWind, jest + @testing-library/react-native in `mobile/`.

**Spec:** `docs/superpowers/specs/2026-10-27-grammar-mistake-explanations-design.md`

## Global Constraints

- Offline. No AI, no network, no tokenizer on the device (units come from the build).
- The grade never changes: diagnosis runs only for `incorrect`, after grading. `correct` and `other_grammar` are untouched.
- No guessing: return no diagnosis when **more than 3 marks**, or when **fewer than half** of the answer's non-particle units match exactly. No-place lines (word order, grammar point not used) do not count toward the 3.
- Check **all** accepted answers (sentence, `valid` alternates, the learner's saved answers): no mark where any of them allows the learner's text; name every correct particle at a place ("needs に or へ").
- Explanations write the learner's words **as typed** (kana if typed in kana); the correct form is written as in the answer.
- Never write to `curriculum.db` from the app. Old `curriculum.db` without `grammar_answer_units` → screen exactly as now (no "Your answer", no marks).
- `Result<T, AppError>` for fallible async ops; nothing throws across async boundaries. (Repository reads here are sync `getAllSync`, like `grammarPoolRepository.ts`.)
- Semantic NativeWind tokens only: `bg-feedback-incorrect-soft`, `text-feedback-incorrect-deep`, `bg-feedback-incorrect-fill`, `text-on-primary`, `border-feedback-incorrect`, `border-feedback-incorrect-deep`. No raw hex.
- `npm run lint` in `mobile/` (a11y) and `npm run check-contrast` at the root must pass.

## Review Focus

1. **Katakana or punctuation in the learner's answer** (コート, 「」, 、) — marks must sit on the right characters of the text *as typed*, not the normalized text. Pinned in Task 6 (`normalizeWithMap`) and Task 10.
2. **A particle that an alternate allows** (家へ where the sentence has 家に) next to a real mistake elsewhere — no mark on へ. Pinned in Task 8.
3. **A saved "My answer is correct too" answer** that differs from every stored answer — its differences must not be marked on a later wrong answer. Pinned in Task 8.
4. **A learner who types only kana for kanji words** (がっこうに for 学校で) — the unit still matches by reading and the particle mark names がっこう. Pinned in Task 7.
5. **Empty or one-character input / sentence with no particles** — no crash, `null` diagnosis. Pinned in Task 8.

---

## File Structure

Build (repo root):
- Create `curriculum/_build/generate_content/answer_units.py` — cuts one plain sentence into units.
- Create `curriculum/_build/generate_content/test_answer_units.py`.
- Create `curriculum/_build/import/find_transitivity_pairs.py` — prints candidate pairs not yet in the pairs file.
- Create `curriculum/_build/vocab_transitivity_pairs.json` — `{slug: partner_slug}`, both directions, hand-checked.
- Modify `curriculum/_build/generate.py` — emit `answer_units` and alternate `units`; emit `transitivity_partner`.
- Modify `curriculum/schema/curriculum.schema.json`, `scripts/curriculum-schema.ts`, `scripts/compile-curriculum.ts`, `scripts/compile-curriculum.test.ts`.

App (`mobile/src`):
- Create `core/grammar/mistakes/mistake.types.ts` — all shared types.
- Create `core/grammar/mistakes/normalize.ts` (+ test) — normalized text with a map back to raw offsets.
- Create `core/grammar/mistakes/unitVariants.ts` (+ test) — known wrong forms of one unit.
- Create `core/grammar/mistakes/alignUnits.ts` (+ test) — DP alignment of input to one answer.
- Create `core/grammar/mistakes/diagnoseBuildAnswer.ts` (+ test) — all answers, limits, alternatives, order, grammar point.
- Create `core/grammar/mistakes/explainMistake.ts` (+ test) — the copy.
- Create `data/curriculum/grammarAnswerUnitsRepository.ts` (+ test).
- Modify `core/srs/srs.types.ts` (`GrammarSentenceCard.diagnosisKey`), `data/grammarReviewCards.ts`.
- Create `components/review/BuildMistakeMarks.tsx` (+ test).
- Modify `components/review/IncorrectReveal.tsx`.
- Modify `docs/working-history.md`.

---

### Task 1: Answer units in the build

**Files:**
- Create: `curriculum/_build/generate_content/answer_units.py`
- Test: `curriculum/_build/generate_content/test_answer_units.py`

**Interfaces:**
- Consumes: `spans.tokens_with_offsets(text)`, `spans.derive_spans(text, forms_by_slug)`, `spans.merge_spans`, `spans.build_stem_spans`, `furigana.katakana_to_hiragana`, token reading as in `furigana._token_reading` (kana feature, hiragana).
- Produces: `answer_units(text: str, forms_by_slug: dict[str, str], grammar_span: dict | None) -> list[dict]`. Each unit: `{"surface": str, "reading": str, "role": "word" | "particle" | "other", "vocabulary_slug": str | None, "in_grammar": bool}`.

Cutting rules, applied to tokens in order (word spans = `merge_spans(derive_spans(...), build_stem_spans(...))`, the same as `_grammar_example`):
1. Drop tokens with `pos1` 補助記号 or 空白.
2. A token that starts a word span starts a `word` unit (`vocabulary_slug` = the span's slug); every token inside that span joins it.
3. A token with `pos1` 助動詞 or 接尾辞, or `pos1` 助詞 + `pos2` 接続助詞 with surface て / で, joins the previous unit (if there is one).
4. Else a token with `pos1` 助詞 outside the grammar span is its own `particle` unit.
5. Else a token inside the grammar span joins the previous unit if that unit is an `other` unit with `in_grammar`, otherwise starts one.
6. Else the token joins the previous unit if that unit is an `other` unit outside the grammar, otherwise starts one.
- `in_grammar` = the unit's character range overlaps `grammar_span` (`False` for all units when `grammar_span` is `None`).
- `reading` = concatenated hiragana token readings; when a token has no reading, use its surface.

- [ ] **Step 1: Write the failing tests**

```python
class AnswerUnitsTest(unittest.TestCase):
    def test_particles_words_and_masu_tail(self):
        units = answer_units.answer_units(
            "今年は学校で日本語を勉強します。",
            {"kotoshi": "今年", "gakkou": "学校", "nihongo": "日本語", "benkyou-suru": "勉強する"},
            {"start": 13, "end": 15})
        self.assertEqual([(u["surface"], u["role"]) for u in units], [
            ("今年", "word"), ("は", "particle"), ("学校", "word"), ("で", "particle"),
            ("日本語", "word"), ("を", "particle"), ("勉強します", "word")])
        self.assertEqual(units[1]["reading"], "は")
        self.assertEqual(units[2]["reading"], "がっこう")
        self.assertEqual([u["in_grammar"] for u in units], [False] * 6 + [True])

    def test_grammar_particles_form_one_other_unit(self):
        units = answer_units.answer_units(
            "昼ご飯を作ったのに、友達はもう食べました。",
            {"hirugohan": "昼ご飯", "tsukuru": "作る", "tomodachi": "友達", "mou": "もう", "taberu": "食べる"},
            {"start": 7, "end": 9})
        self.assertEqual([(u["surface"], u["role"], u["in_grammar"]) for u in units], [
            ("昼ご飯", "word", False), ("を", "particle", False), ("作った", "word", False),
            ("のに", "other", True), ("友達", "word", False), ("は", "particle", False),
            ("もう", "word", False), ("食べました", "word", False)])

    def test_units_rebuild_the_text_without_punctuation(self):
        text = "家へ帰ったのに、友達はもう食べました。"
        units = answer_units.answer_units(text, {"ie": "家", "kaeru": "帰る"}, None)
        self.assertEqual("".join(u["surface"] for u in units), "家へ帰ったのに友達はもう食べました")

    def test_te_form_joins_its_verb(self):
        units = answer_units.answer_units("手を洗って食べます。", {"te": "手", "arau": "洗う", "taberu": "食べる"}, None)
        self.assertIn(("洗って", "word"), [(u["surface"], u["role"]) for u in units])
```

(Use the real slugs from `vocab_conjugation_classes.json` if a test word needs them; the dicts above only have to map slug → dictionary form.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_answer_units -v`
Expected: FAIL — `ModuleNotFoundError: answer_units`.

- [ ] **Step 3: Implement `answer_units` in `generate_content/answer_units.py`** with the six rules above. Import pattern as in `grammar_sentences.py` (`sys.path` insert of the build dir).

- [ ] **Step 4: Run tests to verify they pass**

Run: same command. Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate_content/answer_units.py curriculum/_build/generate_content/test_answer_units.py
git commit -m "feat(curriculum): cut Build answers into word/particle units"
```

---

### Task 2: Emit and compile answer units

**Files:**
- Modify: `curriculum/_build/generate.py` (`_grammar_example`, ~line 623–668)
- Modify: `curriculum/schema/curriculum.schema.json` (example sentence object, ~line 205–240)
- Modify: `scripts/curriculum-schema.ts` (after `grammar_sentence_answers`, ~line 147; index list ~line 229)
- Modify: `scripts/compile-curriculum.ts` (`ExampleSentence` type ~line 132; `insertExamples` ~line 700)
- Test: `curriculum/_build/generate_content/test_generate_grammar_level.py`, `scripts/compile-curriculum.test.ts`

**Interfaces:**
- Consumes: `answer_units(...)` (Task 1); `grammar_sentences_lib.grammar_span(plain, accepted_forms, form)`; `furigana_lib.strip_furigana`.
- Produces: table

```sql
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
CREATE INDEX idx_grammar_answer_units_sentence ON grammar_answer_units(sentence_id);
```

- JSON: pool example sentences get `"answer_units": [unit, ...]`; each `valid` entry of `build_alternates` gets `"units": [unit, ...]` (`other_grammar` entries get none). JSON unit: `{surface, reading, role, vocabulary_slug?, in_grammar}` (`vocabulary_slug` omitted when null).
- Alternates: units from `strip_furigana(alternate_furigana)` with the sentence's `vocabulary_slugs` forms; grammar span from `grammar_span(plain, g["accepted_forms"], example.get("form"))`, `None` when it raises `ValueError`.
- Compile: resolve `vocabulary_slug` → item id (throw `Unresolved answer unit vocabulary: <owner> example[i] -> vocabulary:<slug>`); insert with `position` = index; throw `Answer units do not rebuild sentence: <owner> example[i]` when the joined `surface`s ≠ the answer's plain text with `、。！？!?,.「」『』` and spaces removed.

- [ ] **Step 1: Write the failing tests**
  - Python, in `test_generate_grammar_level.py`: `test_pool_sentence_carries_answer_units` — build one level with one pool sentence 今年は学校で日本語を勉強します。 and one `valid` alternate 今年は学校で日本語を勉強しました。; assert `sentence["answer_units"][1] == {"surface": "は", "reading": "は", "role": "particle", "in_grammar": False}` and `sentence["build_alternates"][0]["units"][-1]["surface"] == "勉強しました"`. Follow the fixture style already in that file.
  - TS, beside `'compiles grammar pool fields, build alternates and grammar meanings'`: `it('compiles answer units for the sentence and its valid alternates')` — assert `SELECT answer_id, position, surface, role, item_id, in_grammar FROM grammar_answer_units ORDER BY answer_id IS NOT NULL, answer_id, position` returns the sentence units with `answer_id` null first and the alternate's with its `grammar_sentence_answers.id`; `item_id` equals the vocab item's id. And `it('throws when answer units do not rebuild the sentence')`.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level -v` and `npx jest scripts/compile-curriculum.test.ts -t "answer units"` (repo root).
Expected: FAIL (missing key / missing table).

- [ ] **Step 3: Implement** the generate.py emission, the schema JSON entries (`answer_units` and alternate `units`, `additionalProperties: false`, `role` enum), the SQL table + index, and the compile insert (after all item rows exist, like `pendingExampleSpans`).

- [ ] **Step 4: Run tests to verify they pass**, then `npm run validate-schema`. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate.py curriculum/schema/curriculum.schema.json scripts/ curriculum/_build/generate_content/test_generate_grammar_level.py
git commit -m "feat(curriculum): store Build answer units for each accepted answer"
```

---

### Task 3: Transitive / intransitive partners

**Files:**
- Create: `curriculum/_build/import/find_transitivity_pairs.py`
- Create: `curriculum/_build/vocab_transitivity_pairs.json`
- Modify: `curriculum/_build/generate.py` (`_build_vocab_level`, beside `conjugation_class`), `curriculum/schema/curriculum.schema.json` (vocab item), `scripts/curriculum-schema.ts` (`items`), `scripts/compile-curriculum.ts`
- Test: `curriculum/_build/import/test_transitivity_pairs.py`, `scripts/compile-curriculum.test.ts`

**Interfaces:**
- Produces: vocab JSON field `"transitivity_partner": "<slug>"`; column `items.transitivity_partner_id INTEGER REFERENCES items(id)` (comment it like `conjugation_class`); `find_transitivity_pairs.candidates(word_types: dict[str, list[str]], forms: dict[str, str], known: dict[str, str]) -> list[tuple[str, str]]` — (transitive slug, intransitive slug) for verbs whose dictionary forms share the same first kanji and same kanji run, one tagged `transitive verb` and the other `intransitive verb`, and not already in `known`.

- [ ] **Step 1: Write the failing tests**
  - `test_candidates_pair_akeru_and_aku`: `candidates({"akeru": ["ichidan verb", "transitive verb"], "aku": ["godan verb", "intransitive verb"], "taberu": ["ichidan verb", "transitive verb"]}, {"akeru": "開ける", "aku": "開く", "taberu": "食べる"}, {})` → `[("akeru", "aku")]`.
  - `test_candidates_skip_known_pairs`: same input with `known={"akeru": "aku", "aku": "akeru"}` → `[]`.
  - Generate: `test_vocab_item_carries_transitivity_partner` (in the vocab-level test file that tests `conjugation_class`).
  - Compile: `it('links transitivity partners both ways')` — two vocab items with partners; each row's `transitivity_partner_id` is the other's id. `it('throws on an unresolved transitivity partner')`.

- [ ] **Step 2: Run tests to verify they fail** (`.venv/bin/python -m unittest import.test_transitivity_pairs -v`, jest `-t transitivity`). Expected: FAIL.

- [ ] **Step 3: Implement** `candidates` and a `main()` that loads `vocab_word_types.json`, the vocab forms, and the pairs file, then prints each new candidate as `開ける (akeru) ↔ 開く (aku)`. Load the pairs file in `generate.py` like `_load_vocab_conjugation_classes()` (missing file → `{}`); compile writes the column in a second pass after all items exist.

- [ ] **Step 4: Run tests to verify they pass.** Expected: PASS.

- [ ] **Step 5: Make the pairs list.** Run `cd curriculum/_build && .venv/bin/python import/find_transitivity_pairs.py`. Remove wrong pairs (same kanji, unrelated meaning). Write the rest to `vocab_transitivity_pairs.json`, both directions, keys sorted.

- [ ] **Step 6: STOP — maintainer check.** Show the maintainer the list as `開ける ↔ 開く` lines, one per pair. Apply their removals. Do not continue until they approve the list.

- [ ] **Step 7: Commit**

```bash
git add curriculum/_build/import/ curriculum/_build/vocab_transitivity_pairs.json curriculum/_build/generate.py curriculum/schema/curriculum.schema.json scripts/
git commit -m "feat(curriculum): transitive/intransitive verb partners"
```

---

### Task 4: Rebuild the curriculum

**Files:**
- Modify (generated): `curriculum/grammar/n5.json`, `curriculum/grammar/n4.json`, `curriculum/vocabulary/*.json`, `mobile/assets/curriculum-seed/curriculum.db` (Git LFS), `curriculum-seed.json`

- [ ] **Step 1: Regenerate.** Run (repo root): `for l in n5 n4 n3 n2 n1; do curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level $l; done` then `npm run validate-schema && npm run compile-curriculum`. Expected: no errors.

- [ ] **Step 2: Check the data.** Run:
  `sqlite3 mobile/assets/curriculum-seed/curriculum.db "SELECT count(DISTINCT sentence_id) FROM grammar_answer_units; SELECT count(*) FROM grammar_sentence_answers a WHERE kind='valid' AND NOT EXISTS (SELECT 1 FROM grammar_answer_units u WHERE u.answer_id=a.id); SELECT count(*) FROM items WHERE transitivity_partner_id IS NOT NULL;"`
  Expected: first number = number of pool sentences (1529 today); second = 0; third = 2 × pairs in the JSON.

- [ ] **Step 3: Commit**

```bash
git add curriculum/ mobile/assets/curriculum-seed/
git commit -m "chore(curriculum): rebuild with answer units and verb partners"
```

---

### Task 5: Load the diagnosis data with the Build card

**Files:**
- Create: `mobile/src/core/grammar/mistakes/mistake.types.ts`
- Create: `mobile/src/data/curriculum/grammarAnswerUnitsRepository.ts`
- Test: `mobile/src/data/curriculum/grammarAnswerUnitsRepository.test.ts`, existing `mobile/src/data/grammarReviewCards.test.ts` (create if absent)
- Modify: `mobile/src/core/srs/srs.types.ts` (`GrammarSentenceCard`), `mobile/src/data/grammarReviewCards.ts`

**Interfaces:**
- Produces (`mistake.types.ts`):

```ts
export type AnswerUnitRole = 'word' | 'particle' | 'other';
export type AnswerUnit = { surface: string; reading: string; role: AnswerUnitRole; itemId: string | null; inGrammar: boolean };
export type DiagnosisWordForm = { primaryForm: string; furigana: string | null; conjugationClass: ConjugationClass | null };
export type DiagnosisWord = DiagnosisWordForm & {
  itemId: string;
  transitivity: 'transitive' | 'intransitive' | null; // from items.word_type
  partner: DiagnosisWordForm | null;                   // items.transitivity_partner_id
  homophones: DiagnosisWordForm[];                     // other vocabulary with the same reading, different primary_form
};
/** answers[0] = the sentence; then `valid` alternates in sort_order. */
export type BuildDiagnosisKey = { answers: AnswerUnit[][]; words: Record<string, DiagnosisWord> };
```

- `getBuildDiagnosisKey(db: SQLiteDatabase, sentenceId: string): BuildDiagnosisKey | null` — `null` when the table `grammar_answer_units` does not exist (`sqlite_master` check) or the sentence has no units. Homophones: vocabulary items whose `accepted_answers` reading equals the word's reading.
- `GrammarSentenceCard.diagnosisKey: BuildDiagnosisKey | null` — filled for `grammarBuild`, `null` for `grammarRead`.

- [ ] **Step 1: Write the failing tests** (in-memory DB fixture as in other `data/curriculum/*.test.ts`):
  - `returns null when the units table is missing`.
  - `returns the sentence units first, then valid alternates in sort order` — `answers[0].map(u => u.surface)` equals `['今年', 'は', ...]`; `answers[1]` is the alternate.
  - `loads conjugation class, transitivity, partner and homophones` — 開ける gets `transitivity: 'transitive'`, `partner.primaryForm: '開く'`; 会う gets a homophone 合う.
  - `buildGrammarCards` test: `grammarBuild.diagnosisKey?.answers.length` > 0 and `grammarRead.diagnosisKey` is `null`.

- [ ] **Step 2: Run** `cd mobile && npx jest src/data/curriculum/grammarAnswerUnitsRepository.test.ts src/data/grammarReviewCards.test.ts`. Expected: FAIL.

- [ ] **Step 3: Implement** the types, the repository, the card field, and the `buildGrammarCards` call. Update every `GrammarSentenceCard` fixture the type check finds (`npx tsc --noEmit` in `mobile/`) with `diagnosisKey: null`.

- [ ] **Step 4: Run** the tests and `npx tsc --noEmit`. Expected: PASS, no type errors.

- [ ] **Step 5: Commit** — `git commit -m "feat(review): load Build answer units with the grammar card"`

---

### Task 6: Normalized text with raw offsets, and unit variants

**Files:**
- Create: `mobile/src/core/grammar/mistakes/normalize.ts`, `unitVariants.ts`
- Modify: `mobile/src/core/grammar/mistakes/mistake.types.ts`
- Test: `normalize.test.ts`, `unitVariants.test.ts`

**Interfaces:**
- Consumes: `normalizeBuildText` rules (`buildEvaluator.ts`: katakana → hiragana, drop `\s、。！？!?,.　「」『』`), `conjugate`, `CONJUGATION_FORMS`, `ConjugationForm` (`core/content/conjugation.ts`).
- Produces:

```ts
// normalize.ts
export type NormalizedText = { text: string; rawIndex: number[] }; // rawIndex[i] = raw offset of text[i]; rawIndex[text.length] = raw length
export function normalizeWithMap(raw: string): NormalizedText;

// mistake.types.ts (add)
export type UnitForm = ConjugationForm | 'te';
export type FormDims = { register?: 'polite' | 'plain'; tense?: 'past' | 'non-past'; polarity?: 'negative' | 'positive' };
export type VariantKind =
  | 'particle_wrong' | 'form' | 'verb_group' | 'te_ta' | 'adjective_type'
  | 'transitivity' | 'homophone_kanji' | 'spelling_sokuon' | 'spelling_long_vowel';
export type UnitVariant = { text: string; kind: VariantKind; dims?: FormDims; dictForm?: string };

// unitVariants.ts
export const PARTICLES: readonly string[]; // は が を に で へ と も の から まで より や か ね よ
export function unitForm(unit: AnswerUnit, word: DiagnosisWord | null): { form: UnitForm; base: DiagnosisWordForm } | null;
export function unitVariants(unit: AnswerUnit, word: DiagnosisWord | null): UnitVariant[];
```

Rules for `unitForm`: find the form whose `surface` or reading (furigana brackets resolved) equals the unit's surface or reading, using the word's class; `'te'` = `plainPast` with final た → て / だ → で. If none matches and the unit surface ends in い, use `{ primaryForm: unit.surface, furigana: null, conjugationClass: 'adj-i' }` as base (covers 食べたい → 食べたかった).

Rules for `unitVariants` (every `text` is normalized hiragana or the surface; emit both surface and reading spellings; drop variants equal to the unit itself):
- `particle` unit → every other `PARTICLES` entry, kind `particle_wrong`.
- Unit with a form F → every other of the 8 forms, kind `form`, `dims` = only the dimensions that differ from F. (No `form` variants when F is `'te'`.)
- `verb_group`: godan ↔ ichidan swapped class, form F only (帰る → 帰ます).
- `te_ta`: godan, F is `'te'` or `plainPast` → stem + each wrong tail from `って いて いで して んで` (and the た / だ versions), `dictForm` = dictionary form.
- `adjective_type`: adj-na ↔ adj-i swapped class, form F only (きれい → きれいくない).
- `transitivity`: partner in form F.
- `homophone_kanji`: each homophone in form F (or its primary form when the word has no class).
- `spelling_sokuon`: reading with one っ removed. `spelling_long_vowel`: reading with one long-vowel kana removed (ー; う after an o-row kana; い after an e-row kana; a vowel kana that repeats the previous kana's vowel).

- [ ] **Step 1: Write the failing tests**
  - `normalizeWithMap('コート、着ます')` → `text: 'こーときます'`, `rawIndex: [0, 1, 2, 3, 5, 6, 7]`.
  - `unitVariants(particle は)` contains `{ text: 'が', kind: 'particle_wrong' }` and not `'は'`.
  - 食べました (taberu, ichidan, F = politePast): contains `{ text: '食べる', kind: 'form', dims: { register: 'plain', tense: 'non-past' } }` and `{ text: '食べます', kind: 'form', dims: { tense: 'non-past' } }`.
  - 帰ります (kaeru, godan, F = polite): contains `{ text: '帰ます', kind: 'verb_group' }`.
  - 書いて (kaku, godan, F = te): contains `{ text: '書って', kind: 'te_ta', dictForm: '書く' }`.
  - きれいじゃない (adj-na, F = plainNegative): contains `{ text: 'きれいくない', kind: 'adjective_type' }`.
  - 開けます with partner 開く: contains `{ text: '開きます', kind: 'transitivity' }`.
  - 会います with homophone 合う: contains `{ text: '合います', kind: 'homophone_kanji' }`.
  - unit reading きって: contains `{ text: 'きて', kind: 'spelling_sokuon' }`; reading こうこう: contains `{ text: 'ここう', kind: 'spelling_long_vowel' }`.
  - 食べたい (other unit, in grammar, no word): contains `{ text: '食べたかった', kind: 'form', dims: { tense: 'past' } }`.

- [ ] **Step 2: Run** `cd mobile && npx jest src/core/grammar/mistakes`. Expected: FAIL.
- [ ] **Step 3: Implement** `normalizeWithMap`, `unitForm`, `unitVariants`.
- [ ] **Step 4: Run** the same command. Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(review): known wrong forms of a Build answer unit"`

---

### Task 7: Align the learner's text with one answer

**Files:**
- Create: `mobile/src/core/grammar/mistakes/alignUnits.ts`
- Modify: `mistake.types.ts`
- Test: `alignUnits.test.ts`

**Interfaces:**
- Produces:

```ts
export type StepKind = 'exact' | 'allowed' | VariantKind | 'missing' | 'extra' | 'replaced';
/** One alignment step. `from`/`to` are offsets in the normalized input (from === to for a missing unit). unitIndex is null for 'extra'. */
export type AlignStep = { kind: StepKind; unitIndex: number | null; from: number; to: number; variant?: UnitVariant };
export type Alignment = { steps: AlignStep[]; cost: number };
/** allowed[unitIndex] = extra texts accepted at that unit with cost 0 ('' = may be absent). */
export function alignUnits(
  input: string,
  units: AnswerUnit[],
  words: Record<string, DiagnosisWord>,
  allowed?: Record<number, string[]>,
): Alignment;
```

Costs (pin these; ties prefer the earlier kind in this list): `exact` 0, `allowed` 0, any variant 1, `missing` 1, `extra` 1, `replaced` 1.5. A unit matches `exact` when the input slice equals `normalizeBuildText(unit.surface)` or `unit.reading` (so katakana units match hiragana-folded input). `extra` and `replaced` consume 1–8 input characters. DP over (unit index, input offset); the alignment must consume the whole input.

- [ ] **Step 1: Write the failing tests** (units of 今年は学校で日本語を勉強します from Task 1, words for 勉強する):
  - `'今年は学校で日本語を勉強します'` → cost 0, every step `exact`.
  - `'今年学校に日本語を勉強する'` → steps include `{ kind: 'missing', unitIndex: 1 }`, `{ kind: 'particle_wrong', unitIndex: 3, variant.text 'に' }`, `{ kind: 'form', unitIndex: 6 }`; cost 3.
  - Kana input `'ことしはがっこうでにほんごをべんきょうする'` → unit 2 `exact` with `from`/`to` covering `がっこう`; unit 6 `form`.
  - `'今年は明日学校で日本語を勉強します'` → one `extra` step covering `明日`.
  - `allowed: { 3: ['へ'] }` and input with へ at unit 3 → that step is `allowed`, cost 0.
- [ ] **Step 2: Run** `npx jest src/core/grammar/mistakes/alignUnits.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `alignUnits`.** Precompute `unitVariants` once per unit.
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(review): align a Build answer with answer units"`

---

### Task 8: Diagnose a Build answer

**Files:**
- Create: `mobile/src/core/grammar/mistakes/diagnoseBuildAnswer.ts`
- Modify: `mistake.types.ts`
- Test: `diagnoseBuildAnswer.test.ts`

**Interfaces:**
- Consumes: `normalizeWithMap`, `alignUnits`, `BuildDiagnosisKey`, `GrammarSentenceCard.userAnswers`.
- Produces:

```ts
export type MistakeKind =
  | 'particle_missing' | 'particle_wrong' | 'particle_extra'
  | Exclude<VariantKind, 'particle_wrong'>
  | 'grammar_not_used' | 'wrong_word' | 'word_missing' | 'word_extra' | 'word_order';
export type Mistake = {
  kind: MistakeKind;
  rawStart: number; rawEnd: number;  // offsets in the raw input; equal for a gap
  typed: string;                     // raw input slice ('' for a gap)
  expected: string[];                // correct text(s) at this place, answer surface; [] for word_extra / word_order
  before: string | null;             // learner's raw text of the previous matched unit
  after: string | null;              // learner's raw text of the next matched unit
  dims?: FormDims; dictForm?: string; transitivity?: 'transitive' | 'intransitive';
};
export type BuildDiagnosis = { marks: Mistake[]; lines: Mistake[] };
export function diagnoseBuildAnswer(input: string, card: GrammarSentenceCard, grammarLabel: string): BuildDiagnosis | null;
```

Steps of the function:
1. `null` when `card.diagnosisKey` is null or the normalized input is empty.
2. **Saved answers → allowances.** Align each `card.userAnswers` entry with each answer; for every non-exact step of an alignment within the limits, add the saved text at that unit to `allowed[answerIndex][unitIndex]` (`''` for `missing`).
3. Align the input with every answer (with its allowances); keep the lowest cost; on a tie keep the lower answer index.
4. Map steps to mistakes: particle unit + `missing` → `particle_missing`; `particle_wrong` → `particle_wrong`; `extra` whose text is one `PARTICLES` entry → `particle_extra`, else `word_extra`; non-particle `missing` → `word_missing`; `replaced` → `wrong_word`; other variant kinds keep their kind.
5. **Grammar point not used:** when every mistake is on an `inGrammar` unit and each is `wrong_word`, `word_missing` or `word_extra`, replace them with one `grammar_not_used` line.
6. **Particle alternatives:** for `particle_wrong` / `particle_missing` at unit i of answer A, add the particle at i of every other answer whose units equal A's except at i.
7. **Limits:** `null` when marks > 3, or when exact non-particle units × 2 < non-particle units.
8. **Word order:** when step 7 returns `null`, check whether the input is the concatenation of one answer's units (each exactly once, surface or reading) in another order; if so return `{ marks: [], lines: [word_order mistake] }`.
9. Marks in input order.

- [ ] **Step 1: Write the failing tests**
  - `'今年学校に日本語を勉強する'` → 3 marks: `particle_missing` (`before: '今年'`, `after: '学校'`, `expected: ['は']`, `rawStart === rawEnd === 2`), `particle_wrong` (`typed: 'に'`, `expected: ['で']`), `form` (`typed: '勉強する'`, `dims: { register: 'polite' }`).
  - Alternate 家へ帰りました beside 家に帰りました; input `'家へ帰ります'` → one `form` mark, no particle mark; input `'家で帰りました'` → `particle_wrong` with `expected: ['に', 'へ']`.
  - `userAnswers: ['今年は学校で日本語を勉強しました']` (saved past) and input `'今年学校で日本語を勉強しました'` → only `particle_missing`, no `form` mark.
  - Five mistakes → `null`. Input `'私は'` for the long sentence → `null`. Input `''` → `null`. `diagnosisKey: null` → `null`.
  - `'学校で日本語を今年は勉強します'` → `{ marks: [], lines: [{ kind: 'word_order' }] }`.
  - Grammar のに sentence, input `'昼ご飯を作ったけど友達はもう食べました'` → `{ marks: [], lines: [{ kind: 'grammar_not_used' }] }`.
  - Katakana: answer コートを着ます, input `'コート、きます'` → `particle_missing` with `before: 'コート'` and `rawStart: 4` (a gap sits at the raw offset of the next normalized character, き; the 、 is skipped).
- [ ] **Step 2: Run** `npx jest src/core/grammar/mistakes/diagnoseBuildAnswer.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `diagnoseBuildAnswer`.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(review): diagnose Build answer mistakes"`

---

### Task 9: Explanation copy

**Files:**
- Create: `mobile/src/core/grammar/mistakes/explainMistake.ts`
- Test: `explainMistake.test.ts`

**Interfaces:**
- Produces: `explainMistake(mistake: Mistake, grammarLabel: string): string`.

Copy (fixed; `{alts}` = `expected` joined with " or "; `{expected}` = `expected[0]`; for te_ta, `{last kana}` = last kana of `dictForm` and `{tail}` = the part of `{expected}` after the stem it shares with `dictForm`):

| kind | text |
|---|---|
| particle_missing | `Between {before} and {after}, you need {alts}. Your answer has no particle there.` — no `after`: `After {before}, you need {alts}. Your answer has no particle there.` |
| particle_wrong | `After {before}, you used {typed}. This sentence needs {alts}.` |
| particle_extra | `After {before}, you added {typed}. This sentence has no particle there.` |
| form, one dim | register: `You wrote {typed}. This card asks for {polite\|plain} form: {expected}.` · tense: `You wrote {typed}. The English is {past\|not past}: {expected}.` · polarity: `You wrote {typed}. The English is {negative\|positive}: {expected}.` |
| form, 2+ dims | `You wrote {typed}. This card asks for {dims}: {expected}.` — dims in order register, tense, polarity, words `polite`/`plain`, `past`/`non-past`, `negative`/`positive`, space-joined (`polite past`) |
| verb_group | `You wrote {typed}. {dictForm} is a {う-verb\|る-verb}: {expected}.` |
| te_ta | `You wrote {typed}. {last kana} verbs change to {tail}: {expected}.` (godan-iku: `You wrote {typed}. 行く is special: {expected}.`) |
| adjective_type | `You wrote {typed}. {dictForm} is a {な-adjective\|い-adjective}: {expected}.` |
| transitivity | `You wrote {typed}. This sentence needs the {transitive\|intransitive} verb {expected}.` |
| grammar_not_used | `This card tests {grammarLabel}.` |
| wrong_word | `You wrote {typed}. This sentence needs {expected}.` |
| word_missing | `You did not write {expected}.` |
| word_extra | `You added {typed}. This sentence does not have it.` |
| word_order | `All words are correct. The order is not.` |
| spelling_sokuon | `Small っ is missing: {expected}.` |
| spelling_long_vowel | `Long vowel is missing: {expected}.` |
| homophone_kanji | `Same sound, different kanji: {expected}.` |

`Mistake` needs `dictForm` for verb_group / adjective_type / te_ta and `transitivity` for transitivity — Task 8 fills them from the variant and the word.

- [ ] **Step 1: Write the failing tests** — one per row; pin these exact strings from the spec:
  - `Between 今年 and 学校, you need は. Your answer has no particle there.`
  - `After 学校, you used に. This sentence needs で.`
  - `After 家, you used で. This sentence needs に or へ.`
  - `You wrote 食べる. This card asks for polite form: 食べます.`
  - `You wrote 行きます. The English is past: 行きました.`
  - `You wrote 食べる. This card asks for polite past: 食べました.`
  - `You wrote 帰ます. 帰る is a う-verb: 帰ります.`
  - `You wrote 書って. く verbs change to いて: 書いて.`
  - `You wrote きれいくない. きれい is a な-adjective: きれいじゃない.`
  - `This card tests 〜たい.`
- [ ] **Step 2: Run** `npx jest src/core/grammar/mistakes/explainMistake.test.ts`. Expected: FAIL.
- [ ] **Step 3: Implement `explainMistake`.**
- [ ] **Step 4: Run.** Expected: PASS.
- [ ] **Step 5: Commit** — `git commit -m "feat(review): Build mistake explanation copy"`

---

### Task 10: `BuildMistakeMarks` component

**Files:**
- Create: `mobile/src/components/review/BuildMistakeMarks.tsx`
- Test: `mobile/src/components/review/BuildMistakeMarks.test.tsx`

**Interfaces:**
- Consumes: `BuildDiagnosis`, `explainMistake`.
- Produces: `BuildMistakeMarks({ input, diagnosis, grammarLabel }: { input: string; diagnosis: BuildDiagnosis | null; grammarLabel: string })`.

Layout (spec "The screen"):
- Label `YOUR ANSWER — TAP A MARK` (just `YOUR ANSWER` when there are no marks), caption style like other review labels.
- The raw input split at mark offsets: plain text, `wrong`/`extra` marks (the `typed` slice), gap marks (`rawStart === rawEnd`, an underlined empty slot ~ one character wide).
- Unselected mark: `bg-feedback-incorrect-soft text-feedback-incorrect-deep`; gap: `border-b-2 border-feedback-incorrect`.
- Selected mark: `bg-feedback-incorrect-fill text-on-primary` + `border-2 border-feedback-incorrect-deep`; selected gap: `border-b-4 border-feedback-incorrect-deep` + outline box.
- First mark selected on mount; tapping another selects it.
- Explanation box below: `bg-feedback-incorrect-soft border-2 border-feedback-incorrect rounded-radius-md`, a pointer triangle (a rotated square `View`) whose left offset is the selected mark's center (from `onLayout`), text = `explainMistake(...)`, and `{n} of {m}` right-aligned caption.
- `diagnosis.lines` render as plain text lines below, always visible, not counted in `m`.
- `diagnosis === null` → the label `YOUR ANSWER` and the raw input, nothing else.
- Each mark: `accessibilityRole="button"`, `accessibilityLabel` = its explanation, `accessibilityState={{ selected }}`, min touch height 44, `testID="build-mistake-mark-{i}"`.

- [ ] **Step 1: Write the failing tests**
  - Renders three marks for the Task 8 three-mistake diagnosis; mark 0 has `accessibilityState.selected === true`; the box text is the particle_missing explanation and shows `1 of 3`.
  - `fireEvent.press(mark 1)` → box shows `After 学校, you used に. This sentence needs で.` and `2 of 3`; mark 1 selected, mark 0 not.
  - Word-order diagnosis → no mark, the line `All words are correct. The order is not.` is shown.
  - `diagnosis={null}` → shows the raw input and no `build-mistake-mark-*`.
- [ ] **Step 2: Run** `npx jest src/components/review/BuildMistakeMarks.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement the component.**
- [ ] **Step 4: Run** the test and `npm run lint` in `mobile/`. Expected: PASS, no lint errors.
- [ ] **Step 5: Commit** — `git commit -m "feat(review): mistake marks on the Build Incorrect screen"`

---

### Task 11: Show it on the "Incorrect" screen

**Files:**
- Modify: `mobile/src/components/review/IncorrectReveal.tsx` (grammar card block, ~line 112–128)
- Modify: `docs/working-history.md`
- Test: `mobile/src/components/review/ReviewCard.test.tsx` (or a new `IncorrectReveal.test.tsx`)

**Interfaces:**
- Consumes: `diagnoseBuildAnswer(rejectedAnswer, item.grammarBuild, item.primaryForm)`, `BuildMistakeMarks`.

- [ ] **Step 1: Write the failing tests**
  - Grammar production item with a `diagnosisKey` and `rejectedAnswer '今年学校に日本語を勉強する'` → `build-mistake-mark-0` exists and appears before the correct sentence (`grammar-build-answer` testID prefix).
  - Same item with `diagnosisKey: null` → no "YOUR ANSWER" text (screen as now).
  - "Don't know" (empty `rejectedAnswer`) → no "YOUR ANSWER" text.
  - Grammar Read (meaning) card → unchanged.
- [ ] **Step 2: Run** `npx jest src/components/review`. Expected: FAIL.
- [ ] **Step 3: Implement.** Inside the `grammarCard` block, for `item.promptType === 'production'` with a non-empty `rejectedAnswer` and `item.grammarBuild.diagnosisKey`, render `<BuildMistakeMarks>` above `<GrammarBuildCard>`. Compute the diagnosis with `useMemo` on `rejectedAnswer` and the card.
- [ ] **Step 4: Run** `npx jest` and `npm run lint` in `mobile/`, `npm run check-contrast` at the root. Expected: all PASS.
- [ ] **Step 5: Check in the app.** Run the app (the `run` skill), answer a Build card with a wrong particle and a plain form, and confirm the marks, the tap highlight, the pointer and `N of M`. Take a screenshot.
- [ ] **Step 6: Update `docs/working-history.md`** — add this plan with status **Done** (or **Partial** with leftovers, one line each).
- [ ] **Step 7: Commit** — `git commit -m "feat(review): explain Build mistakes on the Incorrect screen"`
