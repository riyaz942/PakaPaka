# Conjugation Primer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (A) one read-once N5 grammar card "How words change", placed just before `masu`, and (B) an 8-form conjugation table on the details page of every verb and adjective.

**Architecture:** The content pipeline derives a fine-grained `conjugation_class` per vocabulary word from JMdict (plus a small override file) and compiles it into `items.conjugation_class`. A pure TypeScript conjugator turns `(primary_form, furigana, conjugation_class)` into 8 forms at runtime; a new section on `VocabularyDetail` renders them. Card A is a normal grammar item with a new `read_once` flag (`grammar_rules.read_once`); the lesson planner hides it from learners already past it, and finishing it marks it `known` instead of seeding SRS.

**Tech Stack:** Expo / React Native, TypeScript, expo-sqlite, NativeWind, Jest; Python 3 content pipeline (`curriculum/_build`, unittest); `tsx` compile scripts at repo root.

**Spec:** `docs/superpowers/specs/2026-10-24-conjugation-primer-design.md`

## Global Constraints

- Work on a branch `feat/conjugation-primer`, never on `main`.
- Fallible app ops return `Result<T, AppError>` (`mobile/src/types/result.types.ts`); never throw across async boundaries.
- Never write to `curriculum.db` from the app. `user.db` needs no migration for this plan.
- Styling: semantic NativeWind tokens only (`bg-background`, `text-secondary`, `text-content-vocabulary-deep`, …); no raw hex, no `Colors` from `src/constants/theme.ts`.
- Path alias `@/*` → `mobile/src/*`.
- A wrong form is never acceptable: when the conjugator or the pipeline is unsure, the word gets **no table**.
- The 8 forms, in this order: plain, plain negative, plain past, plain past negative, polite, polite negative, polite past, polite past negative. All 8 always shown.
- Table only for verbs (ichidan, godan, する, 来る) and い / な adjectives, at every JLPT level.
- Card A: read once, never reviewed, never counted as due, directly before `masu` in N5 order; not offered to a learner who has started any later N5 grammar item, or who started at N4.
- Old curriculum.db files without the new columns must not crash the app (follow the `getGrammarRule` column-fallback pattern: try/catch → empty result).
- Lint (`npm run lint` in `mobile/`) and contrast check (`npm run check-contrast` at root) must stay green.

## Review Focus

1. **Lesson with only card A in it** — the complete screen must not say "They're in your review queue now" or offer "Quiz me now" with nothing to quiz. → Task 6, Step 1 test `complete screen hides quiz when no reviewable items`.
2. **Learner past `masu` who finishes the rest of N5 grammar** — the hidden card A must not keep the grammar track stuck on N5. → Task 6, Step 1 test `grammar level advances past a hidden read-once item`.
3. **Kana-written words and furigana strings** (くる vs 来[く]る, 勉[べん]強[きょう]する) — cells must be right in both `surface` and `furigana`. → Task 1 tests.
4. **Older curriculum.db without `conjugation_class` / `read_once`** — no crash; no table, no read-once. → Task 3 and Task 6 repository tests.
5. **A class the conjugator cannot be sure about** (ある written 有る, an unknown class string) — no table, never a guessed form. → Task 1 test `returns null when unsure`, Task 3 test `unknown class string → null`.

---

### Task 1: Pure conjugator

**Files:**
- Create: `mobile/src/core/content/conjugation.ts`
- Test: `mobile/src/core/content/conjugation.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type ConjugationClass =
    | 'ichidan' | 'godan' | 'godan-iku' | 'godan-ru-irregular' | 'godan-honorific'
    | 'godan-u-special' | 'kuru' | 'suru' | 'adj-i' | 'adj-ii' | 'adj-na';
  export const CONJUGATION_CLASSES: readonly ConjugationClass[];
  export function parseConjugationClass(value: string | null | undefined): ConjugationClass | null;
  export type ConjugationForm =
    | 'plain' | 'plainNegative' | 'plainPast' | 'plainPastNegative'
    | 'polite' | 'politeNegative' | 'politePast' | 'politePastNegative';
  export const CONJUGATION_FORMS: readonly ConjugationForm[]; // order as in Global Constraints
  export type ConjugatedCell = { surface: string; furigana: string };
  export type ConjugationTable = Record<ConjugationForm, ConjugatedCell>;
  export type ConjugatableWord = { primaryForm: string; furigana: string | null };
  export function conjugate(word: ConjugatableWord, cls: ConjugationClass): ConjugationTable | null;
  export const WORD_GROUP_LABEL: Record<ConjugationClass, string>;
  export type LookAlike = { tag: string; note: string };
  export function lookAlike(word: ConjugatableWord, cls: ConjugationClass): LookAlike | null;
  ```

- [ ] **Step 1: Write the failing tests** (table-driven; `f` = furigana, `s` = surface)

```ts
const row = (t: ConjugationTable) => CONJUGATION_FORMS.map((k) => t[k].surface);

it('godan look-alike 知る', () => {
  expect(row(conjugate({ primaryForm: '知る', furigana: '知[し]る' }, 'godan')!)).toEqual(
    ['知る','知らない','知った','知らなかった','知ります','知りません','知りました','知りませんでした']);
  expect(conjugate({ primaryForm: '知る', furigana: '知[し]る' }, 'godan')!.plainPastNegative.furigana)
    .toBe('知[し]らなかった');
});
it('ichidan 食べる', () => expect(row(conjugate({ primaryForm: '食べる', furigana: '食[た]べる' }, 'ichidan')!))
  .toEqual(['食べる','食べない','食べた','食べなかった','食べます','食べません','食べました','食べませんでした']));
it.each([
  ['飲む', 'godan', '飲まない', '飲んだ', '飲みます'],
  ['買う', 'godan', '買わない', '買った', '買います'],
  ['書く', 'godan', '書かない', '書いた', '書きます'],
  ['泳ぐ', 'godan', '泳がない', '泳いだ', '泳ぎます'],
  ['話す', 'godan', '話さない', '話した', '話します'],
  ['待つ', 'godan', '待たない', '待った', '待ちます'],
  ['死ぬ', 'godan', '死なない', '死んだ', '死にます'],
  ['遊ぶ', 'godan', '遊ばない', '遊んだ', '遊びます'],
  ['行く', 'godan-iku', '行かない', '行った', '行きます'],
  ['ある', 'godan-ru-irregular', 'ない', 'あった', 'あります'],
  ['いらっしゃる', 'godan-honorific', 'いらっしゃらない', 'いらっしゃった', 'いらっしゃいます'],
  ['問う', 'godan-u-special', '問わない', '問うた', '問います'],
  ['する', 'suru', 'しない', 'した', 'します'],
  ['勉強する', 'suru', '勉強しない', '勉強した', '勉強します'],
  ['くる', 'kuru', 'こない', 'きた', 'きます'],
])('%s (%s)', (primaryForm, cls, neg, past, polite) => {
  const t = conjugate({ primaryForm, furigana: null }, cls as ConjugationClass)!;
  expect([t.plainNegative.surface, t.plainPast.surface, t.polite.surface]).toEqual([neg, past, polite]);
});
it('ある past negative is なかった', () =>
  expect(conjugate({ primaryForm: 'ある', furigana: null }, 'godan-ru-irregular')!.plainPastNegative.surface).toBe('なかった'));
it('来る keeps the kanji and changes its reading', () => {
  const t = conjugate({ primaryForm: '来る', furigana: '来[く]る' }, 'kuru')!;
  expect([t.plainNegative.furigana, t.plainPast.furigana, t.polite.furigana])
    .toEqual(['来[こ]ない', '来[き]た', '来[き]ます']);
  expect(t.plainNegative.surface).toBe('来ない');
});
it('する-verb furigana keeps the noun', () =>
  expect(conjugate({ primaryForm: '勉強する', furigana: '勉[べん]強[きょう]する' }, 'suru')!.plainPast.furigana)
    .toBe('勉[べん]強[きょう]した'));
it('い adjective 高い', () => expect(row(conjugate({ primaryForm: '高い', furigana: '高[たか]い' }, 'adj-i')!))
  .toEqual(['高い','高くない','高かった','高くなかった','高いです','高くないです','高かったです','高くなかったです']));
it('いい uses よ', () => expect(row(conjugate({ primaryForm: 'いい', furigana: null }, 'adj-ii')!))
  .toEqual(['いい','よくない','よかった','よくなかった','いいです','よくないです','よかったです','よくなかったです']));
it('かっこいい uses よ too', () =>
  expect(conjugate({ primaryForm: 'かっこいい', furigana: null }, 'adj-ii')!.plainNegative.surface).toBe('かっこよくない'));
it('な adjective 静か', () => expect(row(conjugate({ primaryForm: '静か', furigana: '静[しず]か' }, 'adj-na')!))
  .toEqual(['静かだ','静かじゃない','静かだった','静かじゃなかった','静かです','静かではありません','静かでした','静かではありませんでした']));
it('returns null when unsure', () => {
  expect(conjugate({ primaryForm: '有る', furigana: '有[あ]る' }, 'godan-ru-irregular')).toBeNull();
  expect(conjugate({ primaryForm: '食べ', furigana: null }, 'ichidan')).toBeNull(); // no る
  expect(conjugate({ primaryForm: '高', furigana: null }, 'adj-i')).toBeNull();     // no い
});
it('parseConjugationClass rejects unknown strings', () => {
  expect(parseConjugationClass('godan')).toBe('godan');
  expect(parseConjugationClass('v5r')).toBeNull();
  expect(parseConjugationClass(null)).toBeNull();
});
it('lookAlike', () => {
  expect(lookAlike({ primaryForm: '知る', furigana: '知[し]る' }, 'godan')).toEqual({
    tag: 'Exception: looks ichidan',
    note: 'It ends in い-sound + る, so it looks ichidan. But 知る is godan. る → ら for ない.',
  });
  expect(lookAlike({ primaryForm: '帰る', furigana: '帰[かえ]る' }, 'godan')!.note).toContain('え-sound');
  expect(lookAlike({ primaryForm: 'きれい', furigana: null }, 'adj-na')).toEqual({
    tag: 'Exception: looks like an い adjective',
    note: 'It ends in い, but it is a な adjective. きれいじゃない, not きれくない.',
  });
  expect(lookAlike({ primaryForm: '食べる', furigana: '食[た]べる' }, 'ichidan')).toBeNull();
  expect(lookAlike({ primaryForm: '飲む', furigana: '飲[の]む' }, 'godan')).toBeNull();
  expect(lookAlike({ primaryForm: '静か', furigana: '静[しず]か' }, 'adj-na')).toBeNull();
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd mobile && npx jest src/core/content/conjugation.test.ts`
Expected: FAIL — cannot find module `./conjugation`.

- [ ] **Step 3: Implement `mobile/src/core/content/conjugation.ts`**

Approach: one internal `conjugateText(text, cls)` applied to `primaryForm` and to `furigana ?? primaryForm`; the changing tail is always kana outside the `[...]` brackets, so the same string edit works on both. Exceptions:
- `kuru`: match a trailing `来[く]る` (furigana), `来る` (surface) or `くる` (kana); stems `来[こ]`/`来`/`こ` for ない-forms, `来[き]`/`来`/`き` for the rest.
- `suru`: strip trailing `する`, stems し (all 8 forms start with し).
- Godan tail map (last kana → a-row for ない, i-row for ます, た-form): う→わ/い/った, く→か/き/いた, ぐ→が/ぎ/いだ, す→さ/し/した, つ→た/ち/った, ぬ→な/に/んだ, ぶ→ば/び/んだ, む→ま/み/んだ, る→ら/り/った. `godan-iku` overrides た to った; `godan-u-special` overrides た to うた; `godan-honorific` overrides the ます-stem to い; `godan-ru-irregular` requires the text to end in `ある` and uses ない/なかった for the plain negatives.
- `adj-ii`: requires a trailing `いい`; non-past positive keeps いい, every other form replaces `いい` with `よ` + ending.
- `adj-na`: append だ/じゃない/だった/じゃなかった/です/ではありません/でした/ではありませんでした.
- Return `null` when the required ending is missing.

`WORD_GROUP_LABEL`: ichidan → `Ichidan verb`; all `godan*` → `Godan verb`; kuru → `Irregular verb`; suru → `する verb`; adj-i, adj-ii → `い adjective`; adj-na → `な adjective`.

`lookAlike`: for `godan` (not the other godan classes) whose reading — the furigana with every `X[r]` replaced by `r`, else `primaryForm` — ends in an e-row or i-row kana + る; the vowel label is `え` or `い`. For `adj-na` whose `primaryForm` ends in `い`. Copy is exactly as in the test.

- [ ] **Step 4: Run to verify pass**

Run: `cd mobile && npx jest src/core/content/conjugation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/content/conjugation.ts mobile/src/core/content/conjugation.test.ts docs/superpowers/specs/2026-10-24-conjugation-primer-design.md docs/superpowers/plans/2026-10-24-conjugation-primer.md
git commit -m "feat: add pure conjugator for the 8 basic forms"
```

---

### Task 2: Pipeline — `conjugation_class` from JMdict into curriculum.db

**Files:**
- Modify: `curriculum/_build/import/build_vocab_word_types.py` (also writes the class map)
- Create: `curriculum/_build/vocab_conjugation_classes.json` (generated, checked in)
- Create: `curriculum/_build/conjugation_class_overrides.json`
- Create: `curriculum/_build/reports/conjugation_class_review.md` (generated)
- Modify: `curriculum/_build/generate.py` (inline `conjugation_class` next to `word_type`, ~line 350)
- Modify: `curriculum/schema/curriculum.schema.json` (`vocabItem.properties.conjugation_class`: enum of the 11 class strings)
- Modify: `scripts/curriculum-schema.ts` (`items.conjugation_class TEXT`, with a comment like the `word_type` one), `scripts/compile-curriculum.ts` (vocab type + `insertItem` column; `null` for non-vocabulary)
- Modify: `curriculum/vocabulary/n5.json` … `n1.json` (regenerated)
- Test: `curriculum/_build/import/test_conjugation_class.py`, `scripts/compile-curriculum.test.ts`

**Interfaces:**
- Consumes: the 11 class strings from Task 1 (`ConjugationClass`), byte-identical.
- Produces: `items.conjugation_class` (TEXT, nullable) in curriculum.db; Python `conjugation_class(pos_list: list[str], is_suru_compound: bool) -> str | None` in `build_vocab_word_types.py`.

JMdict POS (expanded entity text, as the existing parser yields it) → class. Confirm each text against the `<!ENTITY …>` lines in `curriculum/_build/data/JMdict_e.gz`:

| JMdict code | class |
|---|---|
| v1, v1-s | `ichidan` |
| v5b v5g v5k v5m v5n v5r v5s v5t v5u | `godan` |
| v5k-s | `godan-iku` |
| v5r-i | `godan-ru-irregular` |
| v5aru | `godan-honorific` |
| v5u-s | `godan-u-special` |
| vk | `kuru` |
| vs-i (and the `X する` compound path) | `suru` |
| adj-i | `adj-i` |
| adj-ix | `adj-ii` |
| adj-na | `adj-na` |

Everything else (vz, vs-s, v2*, v4*, adj-t, adj-nari, vn, …) → no class.

Selection rule, using the **first sense** exactly like `word_type`: a `X する` compound → `suru`; else exactly one distinct class among the sense's POS → that class; zero or more than one → none. Then apply overrides (`null` removes the class).

`conjugation_class_overrides.json` starts with:
```json
{
  "_about": "slug -> conjugation_class or null. Corrects JMdict first-sense classes that would give wrong forms. Every entry needs a reason.",
  "ii": { "class": "adj-ii", "reason": "first sense tagged adverb; いい is the yoi/ii adjective" },
  "takusan": { "class": null, "reason": "adverb/noun in use; たくさんじゃない is not taught" },
  "taitei": { "class": null, "reason": "adverb/noun in use; たいていじゃない is not a form" }
}
```

The review report lists every N5/N4 word whose class is `adj-na` and whose first sense also carries `adverb`, plus every word that lost its class to the "more than one" rule. Read the N5/N4 part of the report and add an override for each word whose forms would be wrong; leave the rest.

- [ ] **Step 1: Write failing Python tests** in `test_conjugation_class.py` (unittest, same `sys.path` setup as `generate_content/test_lesson_word_links.py`):
  - `conjugation_class(["Godan verb with 'ru' ending", "transitive verb"], False) == "godan"`
  - `conjugation_class(["Godan verb - Iku/Yuku special class"], False) == "godan-iku"`
  - `conjugation_class(["Godan verb - -aru special class"], False) == "godan-honorific"`
  - `conjugation_class(["adjective (keiyoushi) - yoi/ii class"], False) == "adj-ii"`
  - `conjugation_class(["noun (common) (futsuumeishi)"], True) == "suru"`
  - `conjugation_class(["Ichidan verb - zuru verb (alternative form of -jiru verbs)"], False) is None`
  - `conjugation_class(["Ichidan verb", "Godan verb with 'ru' ending"], False) is None`
  - after overrides, the generated map has `ii == "adj-ii"`, `shiru == "godan"`, `taberu == "ichidan"`, `iku-v == "godan-iku"`, `aru == "godan-ru-irregular"`, `irassharu == "godan-honorific"`, `kuru-v == "kuru"`, `suru == "suru"`, `kirei == "adj-na"`, `takai-adj == "adj-i"`, and no `takusan` / `taitei` key.

- [ ] **Step 2: Run to verify failure**

Run: `curriculum/_build/.venv/bin/python -m unittest curriculum/_build/import/test_conjugation_class.py -v`
Expected: FAIL — `conjugation_class` not defined.

- [ ] **Step 3: Implement the class map + overrides + report** in `build_vocab_word_types.py`, then run it:

Run: `curriculum/_build/.venv/bin/python curriculum/_build/import/build_vocab_word_types.py`
Expected: writes `vocab_word_types.json` (unchanged — check `git diff --stat` shows no change to it), `vocab_conjugation_classes.json` and the report.

- [ ] **Step 4: Run to verify pass** (same command as Step 2). Expected: PASS.

- [ ] **Step 5: Inline into vocabulary JSON, schema, compile**

Add `conjugation_class` to the generated vocab items in `generate.py` (absent key when no class, like `word_type`), the JSON schema, the DDL and the compile insert. Add a `compile-curriculum.test.ts` case: a vocab item with `conjugation_class: "godan"` compiles to `items.conjugation_class = 'godan'`; one without it compiles to `NULL`.

Run, for each level: `curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5` (then n4, n3, n2, n1)
Expected: `git diff curriculum/vocabulary/` shows only added `"conjugation_class"` lines (check with `git diff curriculum/vocabulary/ | grep '^[-+] ' | grep -v conjugation_class` → empty). If anything else changes, stop and report — do not commit regenerated mnemonics or examples.

Run: `npx jest scripts/compile-curriculum.test.ts && npm run validate-schema && npm run compile-curriculum`
Expected: all pass; `sqlite3 mobile/assets/curriculum-seed/curriculum.db "select conjugation_class from items where slug='shiru'"` → `godan`.

- [ ] **Step 6: Commit**

```bash
git add curriculum/_build/import/ curriculum/_build/vocab_conjugation_classes.json curriculum/_build/conjugation_class_overrides.json curriculum/_build/reports/conjugation_class_review.md curriculum/_build/generate.py curriculum/schema/curriculum.schema.json curriculum/vocabulary/ scripts/ mobile/assets/curriculum-seed/
git commit -m "feat(curriculum): derive conjugation_class per word from JMdict"
```

---

### Task 3: Conjugation table on the word details page

**Files:**
- Modify: `mobile/src/data/curriculum/itemRepository.ts` (two new functions)
- Create: `mobile/src/components/learn/ConjugationTableSection.tsx`
- Modify: `mobile/src/components/learn/VocabularyDetail.tsx` (render the section where `ConjugatedFormsSection` sits now)
- Test: `mobile/src/data/curriculum/itemRepository.test.ts`, `mobile/src/components/learn/ConjugationTableSection.test.tsx`, `mobile/src/components/learn/VocabularyDetail.test.tsx`, `mobile/src/core/content/conjugation.corpus.test.ts`

**Interfaces:**
- Consumes: Task 1 (`conjugate`, `lookAlike`, `WORD_GROUP_LABEL`, `parseConjugationClass`, `CONJUGATION_FORMS`); Task 2 column `items.conjugation_class`.
- Produces:
  ```ts
  export function getConjugationClass(db: SQLiteDatabase, itemId: string): ConjugationClass | null;
  export function listSamePatternWords(
    db: SQLiteDatabase, itemId: string, cls: ConjugationClass, lookAlikesOnly: boolean, limit?: number, // default 3
  ): { id: string; primaryForm: string }[];
  export function ConjugationTableSection(props: { item: CurriculumItemDetail }): React.JSX.Element | null;
  ```

Behaviour:
- `getConjugationClass`: reads `items.conjugation_class`; any SQL error (older DB) or unknown string → `null`.
- `listSamePatternWords`: same class and same `jlpt_level` as the item, excluding itself, lowest `sort_order` first; when `lookAlikesOnly`, keep only words where `lookAlike(...)` is non-null; at most `limit`.
- `ConjugationTableSection` renders nothing when the class is null or `conjugate` returns null. Otherwise, in order: `SectionHeading` "How it conjugates"; the word-group tag (`WORD_GROUP_LABEL`); the look-alike tag and its note when present (heading "How to tell"); a 3-column grid — header row `""`, `Non-past`, `Past`; rows `+ casual`, `− casual`, `+ polite`, `− polite` — each cell a `FuriganaText` of the cell's `furigana` with the same `mode`/`isKnownWord` as the page hero (`useFuriganaPreference().modeForItem(item.id)`, `useIsKnownWord(item.id)`); then "Same pattern as" with the `listSamePatternWords` forms joined by ` · ` (omit the line when empty). testIDs: `conjugation-table`, `conjugation-cell-<form>`, `conjugation-word-group`, `conjugation-look-alike`.
- `VocabularyDetail`: render `ConjugationTableSection`; render `ConjugatedFormsSection` only when the word has no table (`getConjugationClass` null or `conjugate` null).

- [ ] **Step 1: Write failing tests**
  - repository: `getConjugationClass` returns `'godan'` for a seeded row; returns `null` for `'v5r'`; returns `null` when the `items` table has no `conjugation_class` column (create the test table without it). `listSamePatternWords(db, 知る, 'godan', true)` returns only look-alikes (帰る yes, 飲む no) and excludes 知る.
  - section: for 知る (`godan`), `conjugation-cell-plainPastNegative` shows `知らなかった`; `conjugation-word-group` shows `Godan verb`; `conjugation-look-alike` contains `る → ら for ない`. For a noun (`conjugation_class` null) the section renders nothing.
  - VocabularyDetail: with a table, `conjugated-forms-section` is absent; with no class, it still renders (existing tests stay green).
  - corpus (`conjugation.corpus.test.ts`, reads `curriculum/vocabulary/n5.json` … `n1.json` with `fs`):
    - `every classed word conjugates` — for every item with a `conjugation_class`, `conjugate(...)` is non-null.
    - `forms match the example sentences` — for every inflected word span in those files' example sentences (span text = the sentence slice): `ta` → equals `plainPast.surface`; `masu` → one of the four polite surfaces; `nai` → starts with `plainNegative.surface` minus its final `い`. The failure message lists every mismatch as `slug: span → expected`. Fix a real mismatch with an override in Task 2's `conjugation_class_overrides.json` (null when unsure) and rerun Task 2 Step 5; never loosen the test.

- [ ] **Step 2: Run to verify failure**

Run: `cd mobile && npx jest src/data/curriculum/itemRepository.test.ts src/components/learn/ConjugationTableSection.test.tsx src/components/learn/VocabularyDetail.test.tsx src/core/content/conjugation.corpus.test.ts`
Expected: FAIL — functions/components not defined (the corpus test may already pass; if it fails, fix the data as described before going on).

- [ ] **Step 3: Implement** the two repository functions, the section, and the `VocabularyDetail` change.

- [ ] **Step 4: Run to verify pass** (same command). Then `cd mobile && npm run typecheck && npm run lint`. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/data/curriculum/itemRepository.ts mobile/src/data/curriculum/itemRepository.test.ts mobile/src/components/learn/
git commit -m "feat: show an 8-form conjugation table on verb and adjective pages"
```

---

### Task 4: Pipe tables in lesson markdown

Card A's grid is a markdown table; the lesson markdown parser has no tables today.

**Files:**
- Modify: `mobile/src/core/markdown/parseLessonMarkdown.ts` (new block type)
- Modify: the `LessonMarkdown` renderer (`mobile/src/components/common/LessonMarkdown.tsx`)
- Test: `mobile/src/core/markdown/parseLessonMarkdown.test.ts`, `mobile/src/components/common/LessonMarkdown.test.tsx`

**Interfaces:**
- Produces: block `{ type: 'table'; header: InlineSpan[][]; rows: InlineSpan[][][] }` in the `LessonBlock` union.

Rule: a header line `| a | b |`, then a separator line of only `|`, `-`, `:` and spaces, then zero or more `| … |` body lines. Cells are trimmed and parsed with `parseInlineSpans`. Without the separator line, the lines stay a paragraph (current behaviour).

- [ ] **Step 1: Write failing tests**
  - parse: `"|  | Non-past | Past |\n|---|---|---|\n| Positive, casual | 食べる | 食べた |"` → one `table` block, `header.length === 3`, `rows[0][1]` spans text `食べる`.
  - parse: `"| a | b |\n| c | d |"` (no separator) → no `table` block.
  - render: a table renders `lesson-table`, and the text `食べなかった` is visible.

- [ ] **Step 2: Run to verify failure**

Run: `cd mobile && npx jest src/core/markdown/parseLessonMarkdown.test.ts src/components/common/LessonMarkdown.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** the parser branch and a `View`-row renderer (header row in `font-ui-medium text-secondary`, cells with the renderer's existing inline-span/furigana handling).

- [ ] **Step 4: Run to verify pass** (same command). Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/markdown/ mobile/src/components/common/LessonMarkdown.tsx mobile/src/components/common/LessonMarkdown.test.tsx
git commit -m "feat: support pipe tables in lesson markdown"
```

---

### Task 5: Pipeline — card A content and the `read_once` flag

**Files:**
- Modify: `curriculum/_build/n5_grammar.py` (new entry directly before the `masu` entry)
- Create: `curriculum/grammar/lessons/conjugation-primer.md`
- Modify: `curriculum/_build/generate.py` (`read_once` passthrough), `curriculum/_build/generate_content/check_grammar_pool.py` (`check_level` skips `read_once` items)
- Modify: `curriculum/schema/curriculum.schema.json` (`grammarItem.properties.read_once`: boolean)
- Modify: `scripts/curriculum-schema.ts` (`grammar_rules.read_once INTEGER NOT NULL DEFAULT 0`), `scripts/compile-curriculum.ts` (`insertGrammarRule` writes it)
- Modify: `curriculum/grammar/n5.json`, `curriculum/id-registry.json`, `mobile/assets/curriculum-seed/` (regenerated)
- Test: `curriculum/_build/generate_content/test_check_grammar_pool.py`, `scripts/compile-curriculum.test.ts`

**Interfaces:**
- Produces: grammar item slug `conjugation-primer`; column `grammar_rules.read_once` (1 for this item, 0 for all others).

Dataset entry (fields as the other N5 entries; my calls):
- `slug`: `conjugation-primer`; `primary_form`: `活用`; `meaning`: `How words change`; `structure`: `Word group → ending`
- `conjugation_rules`: `{}`; `accepted_forms`: `[]`; `examples`: `[]`; `accepted_meanings`: none; `family`: `conjugations`
- `vocabulary_slugs`: `["taberu", "nomu-v", "shiru", "takai-adj", "shizuka"]`
- `read_once`: `True`

Lesson file (exact copy; the pipeline adds furigana and word links). The lesson screen shows only the intro and the first `## ` section, so everything sits under one `## ` heading with `### ` sub-headings:

````markdown
---
generator_model: claude-opus-5-5
prompt_version: 1
review_status: draft
caution_notes:
  - "Some verbs that end in an e- or i-sound + る are godan, not ichidan: 知る, 帰る, 入る, 走る."
  - "きれい and 嫌い end in い, but they are な adjectives: きれいじゃない, not きれくない."
related_grammar_slugs:
  - "masu"
  - "nai-form"
  - "ta-form"
  - "adj-i-conjugation"
  - "adj-na-conjugation"
---

You are about to learn ます, and soon after it ない, た and the adjective endings. Each of those lessons teaches one ending. This card shows you the whole map first.

Japanese has only two tenses. **Past** is for things that already happened. **Non-past** covers now and the future: 食べます means "I eat" and also "I will eat". There is no separate future form.

## The word groups

Verbs and adjectives change their endings to show past or non-past, positive or negative, casual or polite. How a word changes depends on its group. Every word page in the app shows the group as a tag.

### Ichidan verbs

They end in an e- or i-sound + る. Drop the る and add the ending.

```jp
食べる → 食べない · 食べた
```

### Godan verbs

The last sound shifts. For ない it moves to the a-sound.

```jp
飲む → 飲まない · 飲んだ
```

### Irregular verbs: する and 来る

There are only two. Every する verb, like 勉強する, follows する.

```jp
する → しない · した
来る → 来ない · 来た
```

### い adjectives

Drop the い and add the ending.

```jp
高い → 高くない · 高かった
```

### な adjectives

The word itself never changes. The helper after it changes.

```jp
静かだ → 静かじゃない · 静かだった
```

### How to tell the group

Look at the tag on the word's page. Watch for two traps.

> Some verbs look ichidan but are godan. 知る ends in an i-sound + る, but its negative is 知らない, not 知ない. 帰る, 入る and 走る work the same way.

> きれい and 嫌い end in い, but they are な adjectives: きれいじゃない, not きれくない.

### The full grid

Here is one verb in all eight forms. Each form gets its own full lesson later.

|  | Non-past | Past |
|---|---|---|
| Positive, casual | 食べる | 食べた |
| Negative, casual | 食べない | 食べなかった |
| Positive, polite | 食べます | 食べました |
| Negative, polite | 食べません | 食べませんでした |
````

- [ ] **Step 1: Write failing tests**
  - `test_check_grammar_pool.py`: an item with `"read_once": True` and no pool sentences produces no errors from `check_level` (stub the loaded grammar the way existing tests do); the same item without `read_once` still fails.
  - `compile-curriculum.test.ts`: a grammar item with `read_once: true` compiles to `grammar_rules.read_once = 1`; one without it → `0`.

- [ ] **Step 2: Run to verify failure**

Run: `curriculum/_build/.venv/bin/python -m unittest curriculum/_build/generate_content/test_check_grammar_pool.py -v && npx jest scripts/compile-curriculum.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** the passthrough, the pool-check skip, the schema/DDL/compile column, the dataset entry and the lesson file. If another N5 check (grammar detection, lesson word links, readings) rejects the item for having no examples or meanings, make that check skip `read_once` items the same way, with a test.

- [ ] **Step 4: Regenerate and verify**

Run: `curriculum/_build/.venv/bin/python -m unittest curriculum/_build/generate_content/test_check_grammar_pool.py -v && npx jest scripts/compile-curriculum.test.ts`
Expected: PASS.

Run: `curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5 && npm run validate-schema && npm run compile-curriculum`
Expected: pass; the compile warns that `grammar:conjugation-primer` is `draft` (that is expected until Task 7).

Run: `sqlite3 mobile/assets/curriculum-seed/curriculum.db "select i.slug, i.sort_order, g.read_once from items i join grammar_rules g on g.item_id=i.id where i.item_type='grammar' and i.jlpt_level='N5' order by i.sort_order limit 6"`
Expected: `conjugation-primer|4|1` directly followed by `masu|5|0`.

Check `git diff curriculum/grammar/n5.json` changes only the new item and the `+1` shift in `sort_order` of the items after it.

- [ ] **Step 5: Commit**

```bash
git add curriculum/ scripts/ mobile/assets/curriculum-seed/
git commit -m "feat(curriculum): add read-once conjugation primer before ます"
```

---

### Task 6: Read-once behaviour in lessons

**Files:**
- Create: `mobile/src/core/lesson/readOnce.ts`
- Modify: `mobile/src/data/curriculum/itemRepository.ts` (`listReadOnceGrammarIds`)
- Modify: `mobile/src/core/lesson/lessonPlanner.ts` (`LessonCandidate.readOnce?: boolean`)
- Modify: `mobile/src/data/lessonPlan.ts` (`resolveGrammarLevel`, `buildInputForLevel`)
- Modify: `mobile/src/data/user/lessonProgressRepository.ts` (`startLessonItems`)
- Modify: `mobile/src/app/lesson/index.tsx`, `mobile/src/app/lesson/complete.tsx`
- Test: `mobile/src/core/lesson/readOnce.test.ts`, `mobile/src/data/lessonPlan.test.ts`, `mobile/src/data/user/lessonProgressRepository.test.ts`, `mobile/src/data/curriculum/itemRepository.test.ts`, the complete-screen test next to `complete.tsx` (create `mobile/src/app/lesson/complete.test.tsx` if none exists)

**Interfaces:**
- Consumes: Task 5 column `grammar_rules.read_once`.
- Produces:
  ```ts
  // itemRepository.ts — older DB without the column → empty set
  export function listReadOnceGrammarIds(db: SQLiteDatabase): Set<string>;
  // core/lesson/readOnce.ts
  export function dropPassedReadOnce<T extends { id: string; sortOrder: number }>(
    grammar: T[], readOnceIds: ReadonlySet<string>, startedOrKnownIds: ReadonlySet<string>,
  ): T[]; // removes a read-once item when any item in `grammar` with a higher sortOrder is started or known
  // lessonProgressRepository.ts
  export function startLessonItems(
    userDb: SQLiteDatabase, itemIds: string[], readOnceIds?: ReadonlySet<string>, // default empty
  ): Result<void, AppError>;
  ```

Behaviour:
- `resolveGrammarLevel` applies `dropPassedReadOnce` to each level's grammar list **before** its "has unstarted grammar" check, and returns the filtered list, so a hidden card A never holds the grammar track on N5. Started-or-known = has an SRS row or `item_study_status` `in_progress`/`known`.
- `buildInputForLevel` sets `readOnce: true` on candidates in `listReadOnceGrammarIds`.
- `startLessonItems`: ids in `readOnceIds` get `item_study_status = 'known'` and **no** SRS seed; they still count in `daily_lesson_log`. Other ids behave as today.
- `lesson/index.tsx`: passes the read-once ids to `startLessonItems`, and passes only the non-read-once ids as `itemIds` to `/lesson/complete` (`count` stays the full lesson size).
- `complete.tsx`: when `itemIds` is empty, hide "Quiz me now", the "Quiz me now tests only…" line, and use the caption `Nothing to review from this lesson.` instead of `They're in your review queue now.`
- N4 starters: no new code — the grammar track already starts at the starting level (D17). Pin it with a test.

- [ ] **Step 1: Write failing tests**
  - `readOnce.test.ts`: primer (sort 4) + masu (sort 5): masu not started → primer kept; masu started → primer dropped; primer not read-once → never dropped.
  - `lessonPlan.test.ts`:
    - `offers the read-once primer before masu to a fresh learner` — first grammar in the plan after は/です/ではありません is `conjugation-primer`.
    - `hides the read-once primer once masu is started`.
    - `grammar level advances past a hidden read-once item` — every N5 grammar except the primer started → `grammarLevel === 'n4'`.
    - `N4 starter never gets the primer` — starting level N4 → no N5 grammar in the plan.
  - `lessonProgressRepository.test.ts`: `startLessonItems(db, [primer, kanji], new Set([primer]))` → primer status `known`, no SRS row for primer; kanji `in_progress` with an SRS row; `daily_lesson_log.items_started === 2`.
  - `itemRepository.test.ts`: `listReadOnceGrammarIds` returns the primer id; returns an empty set when `grammar_rules` has no `read_once` column.
  - complete screen: `complete screen hides quiz when no reviewable items` — `itemIds=''`, `count=1` → no `lesson-complete-quiz`, caption `Nothing to review from this lesson.`

- [ ] **Step 2: Run to verify failure**

Run: `cd mobile && npx jest src/core/lesson/readOnce.test.ts src/data/lessonPlan.test.ts src/data/user/lessonProgressRepository.test.ts src/data/curriculum/itemRepository.test.ts src/app/lesson`
Expected: FAIL.

- [ ] **Step 3: Implement** as described.

- [ ] **Step 4: Run to verify pass** (same command), then `cd mobile && npx jest && npm run typecheck && npm run lint`. Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/
git commit -m "feat: read-once primer skips reviews and hides once passed"
```

---

### Task 7: Content approval, release gate, docs

**Files:**
- Modify: `curriculum/grammar/lessons/conjugation-primer.md` (`review_status`)
- Modify: `docs/working-history.md`

- [ ] **Step 1: Show the operator card A in the running app** (lesson flow and Browse detail) and one details page (知る). Wait for approval or text changes. Apply any text changes to the lesson file. This step is the controller's; a sub-agent stops here and reports.

- [ ] **Step 2: Mark reviewed and rebuild**

Set `review_status: reviewed` in the lesson frontmatter.
Run: `curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5 && npm run validate-schema && npm run compile-curriculum && npm run check-contrast`
Expected: pass, and no `draft` warning for `grammar:conjugation-primer`.

- [ ] **Step 3: Update `docs/working-history.md`** — add a line for this plan (spec + plan paths, status "built", date) in the same format as the neighbouring entries.

- [ ] **Step 4: Full check**

Run: `npx jest && (cd mobile && npx jest && npm run typecheck && npm run lint)`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add curriculum/ mobile/assets/curriculum-seed/ docs/working-history.md
git commit -m "docs: mark conjugation primer reviewed and record it in working history"
```
