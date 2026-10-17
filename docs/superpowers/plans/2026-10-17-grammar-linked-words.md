# Grammar Linked Words Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every taught word in grammar lesson text and "Uses" sentences links like an example-sentence word: tap → detail, long-press → that word's furigana, 'auto' furigana by word mastery.

**Architecture:** `generate.py` wraps tokenizer-found words in `{{slug|inflection|annotated}}` markers inside `explanation_markdown` and adds `word_spans` to `uses`. `compile-curriculum` validates markers, rewrites slug → item id, and stores `uses` spans with ids. The app parses markers into `linked` tokens rendered by a `LinkedWord` component extracted from `LinkedSentence`.

**Tech Stack:** Python 3.12 + fugashi (build), TypeScript + better-sqlite3 (compile), Expo / React Native + NativeWind + jest (app).

**Spec:** `docs/superpowers/specs/2026-10-17-grammar-linked-words-design.md`

## Global Constraints

- Scope: N5 + N4 grammar only (161 points).
- Lesson `.md` sources under `curriculum/grammar/lessons/` are never edited; no model calls.
- Built marker: `{{<vocab-slug>|<inflection>|<annotated text>}}`; compiled marker: `{{<item-id>|<inflection>|<annotated text>}}`.
- Built inflection: empty, `masu`, `te`, `nai`, `ta`, or `stem`. Compiled inflection: empty, `masu`, `te`, `nai`, `ta` (`stem` → empty, as `resolveWordSpans` maps it to null).
- Candidate words: `known_vocab_forms` (N5 lesson → N5 words; N4 lesson → N5 + N4 words).
- Inline code (`` `…` ``) is never linked. A span edge inside a multi-kanji furigana group is dropped with a stderr warning, not an error.
- A lesson `.md` containing `{{` or `}}` fails the build.
- "Watch out" notes are out of scope.
- App: `Result<T, AppError>` for fallible ops; semantic NativeWind tokens only, no raw hex; `@/*` path alias.
- Python commands run from `curriculum/_build` with `/Users/riyazahmed/Projects/japanese-learning/curriculum/_build/.venv/bin/python` (the worktree has no venv; `curriculum/_build/data` is a symlink to the main checkout's data and shows as untracked — never `git add -A`, always add explicit paths).

## Review Focus

1. **Screen reader reach.** `RichLine` sets `accessible` + one label on its container; that would swallow the linked words. A line with linked tokens must leave its container non-accessible so each word is a button (Task 4 test).
2. **Punctuation after a linked word.** `明日。` — 。 must not start a wrapped line on its own; it travels with the linked word as `trailing` text (Task 3 + Task 4 tests).
3. **Bold/italic around a marker.** `**{{…}}**` must stay bold and still link (Task 3 test).
4. **Lines with no markers render as today.** An unmarked line yields exactly today's tokens; existing `parseLessonMarkdown` / `LessonMarkdown` tests stay green unchanged (Task 3, Task 4).
5. **Kana-only words in prose.** `これ`, `いる` in prose have no kanji and were skipped by the furigana pass; they must still be linked (Task 1 test).

---

### Task 1: Build — lesson word markers and "Uses" word spans

**Files:**
- Modify: `curriculum/_build/generate.py` (`_annotate_prose_line` ~L402, `_annotate_lesson_markdown` ~L429, `_load_lesson` ~L471, uses loop + `_load_lesson` call in `_build_grammar_level` ~L587–599)
- Test: `curriculum/_build/generate_content/test_lesson_word_links.py` (new, `unittest`, same header as `test_generate_grammar_level.py`)

**Interfaces:**
- Produces: `generate._wrap_spans(plain: str, annotated: str, spans: list[dict], label: str) -> str` — pure mapping: `annotated` with each span wrapped in a marker; spans cutting a furigana group are dropped with a warning.
- Produces: `generate._link_words(plain: str, annotated: str, forms_by_slug: dict[str, str], label: str) -> str` — spans = `spans_lib.merge_spans(spans_lib.derive_spans(plain, forms_by_slug), spans_lib.build_stem_spans(plain, forms_by_slug))`, then `_wrap_spans`. If `furigana_lib.strip_furigana(annotated) != plain`, return `annotated` unchanged and warn.
- Produces: `_annotate_lesson_markdown(body, known_readings, label, forms_by_slug)` and `_load_lesson(slug, known_readings, forms_by_slug)`; `_build_grammar_level` passes `known_vocab_forms or {}`.
- Produces in built JSON: `uses[i]["word_spans"]` (same `WordSpan` dict shape as example sentences: `vocabulary_slug`, `start`, `end`, plus `surface_form` + `inflection` when inflected), present only when non-empty.

- [ ] **Step 1: Write the failing tests** (`FORMS = {"ashita": "明日", "hayai": "早い", "okiru": "起きる", "kore": "これ", "gakusei": "学生"}`)

```python
def test_dictionary_inflected_and_stem_words_get_markers(self):
    out = generate._annotate_lesson_markdown(
        "```jp\n明日は早く起きます。\n```", None, "t", FORMS)
    self.assertIn("{{ashita||明日[あした]}}", out)
    self.assertIn("{{hayai|stem|早[はや]く}}", out)
    self.assertIn("{{okiru|masu|起[お]きます}}", out)

def test_prose_kana_only_word_is_linked(self):
    out = generate._annotate_lesson_markdown("Say これ here.", None, "t", FORMS)
    self.assertEqual(out, "Say {{kore||これ}} here.")

def test_inline_code_stays_plain(self):
    out = generate._annotate_lesson_markdown("Not `早い起きます` ok.", None, "t", FORMS)
    self.assertEqual(out, "Not `早い起きます` ok.")

def test_span_cutting_a_furigana_group_is_dropped_with_warning(self):
    # 明日[あした] is one group; a span covering only 明 must not be emitted.
    span = {"vocabulary_slug": "aka", "start": 0, "end": 1}
    with contextlib.redirect_stderr(io.StringIO()) as err:
        out = generate._wrap_spans("明日", "明日[あした]", [span], "t")
    self.assertEqual(out, "明日[あした]")
    self.assertIn("warning", err.getvalue())

def test_marker_characters_in_lesson_fail(self):
    with self.assertRaises(ValueError):
        generate._annotate_lesson_markdown("bad {{ text", None, "t", FORMS)

def test_uses_get_word_spans(self):
    # build one level via generate._build_grammar_level with an entry whose
    # "uses" has japanese "学生です。" and known_vocab_forms=FORMS
    use = item["uses"][0]
    self.assertEqual(use["word_spans"], [{"vocabulary_slug": "gakusei", "start": 0, "end": 2}])
```

Readings in these asserts come from the tokenizer with `known_readings=None`; if it reads a word differently (e.g. 明日 as みょうにち), pass the level's `known_readings` map instead of changing the asserted structure.

- [ ] **Step 2: Run tests to verify they fail**

Run: `.../.venv/bin/python -m unittest generate_content.test_lesson_word_links -v` (cwd `curriculum/_build`)
Expected: FAIL — `_wrap_spans` / `_link_words` missing / `_annotate_lesson_markdown` takes 3 positional args.

- [ ] **Step 3: Implement**

- `_wrap_spans`: walk `annotated`, building segments the way `mobile/src/core/furigana/parseFurigana.ts` does (a `[reading]` belongs to the maximal kanji/々 run directly before it; everything else is plain), tracking each segment's plain offsets. A span is kept only when its `start` and `end` both fall on a segment boundary or inside an unannotated segment; otherwise warn `warning: {label}: span {slug} cuts furigana group in {plain}` to stderr and drop it. Emit `{{slug|inflection or ''|annotated slice}}`.
- `_annotate_lesson_markdown`: raise `ValueError(f"{label}: lesson text contains '{{{{' or '}}}}'")` when either appears in `body`. jp fence lines: link the whole stripped line against its annotation (both the whole-sentence and per-run fallback paths). Prose: `_annotate_prose_line` gains `forms_by_slug` and `label`; every `_JP_RUN_RE` run outside code spans is linked — kana-only runs too (link `run` against itself); runs already followed by `[` stay untouched and unlinked.
- Uses loop: `word_spans = merge_spans(derive_spans(jp, forms), build_stem_spans(jp, forms))` with `forms = known_vocab_forms or {}`; set only if non-empty.

- [ ] **Step 4: Run all Python tests**

Run: `.../.venv/bin/python -m unittest discover -s generate_content -p "test_*.py" -t .`
Expected: OK (73 existing + new).

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate.py curriculum/_build/generate_content/test_lesson_word_links.py
git commit -m "Build: link taught words in grammar lessons and uses"
```

---

### Task 2: Compile — resolve markers and "Uses" spans; schema

**Files:**
- Modify: `scripts/compile-curriculum.ts` (`GrammarUse` type ~L145, grammar insert ~L861–872)
- Modify: `curriculum/schema/curriculum.schema.json` (`$defs.grammarUse`: add `"word_spans": { "type": "array", "items": { "$ref": "#/$defs/wordSpan" } }`)
- Test: `scripts/compile-curriculum.test.ts`, `scripts/validate-schema.test.ts`

**Interfaces:**
- Consumes: `resolveWordSpans(text, spans, kind, label, idByKey, primaryFormByVocabSlug)` (existing).
- Produces: `resolveLessonMarkers(markdown: string, label: string, idByKey: Map<string, number>, primaryFormByVocabSlug: Map<string, string>): string` in `compile-curriculum.ts`. Per marker: plain = annotated text with `\[[^\[\]]*]` removed; check via `resolveWordSpans(plain, [{ vocabulary_slug, start: 0, end: plain.length, ...(inflection ? { surface_form: plain, inflection } : {}) }], 'lesson word marker', label, …)`; replace with `{{${item_id}|${resolved.inflection ?? ''}|${annotated}}}`. Any `{{` or `}}` left after replacement throws `Malformed lesson word marker in ${label}`.
- Produces in `grammar_rules.uses` JSON: each use's `word_spans` replaced by `[{ vocabulary_item_id: number, start: number, end: number, inflection: string | null }]` (omitted when the use has none).

- [ ] **Step 1: Write the failing tests** (fixtures in the style of the existing `compiles example sentence spans` test)

```ts
it('rewrites lesson word markers to item ids', () => {
  // explanation_markdown: 'x {{ashita||明日[あした]}} {{okiru|masu|起[お]きます}} {{hayai|stem|早[はや]く}}'
  expect(rule.explanation_markdown).toBe(
    `x {{${ashitaId}||明日[あした]}} {{${okiruId}|masu|起[お]きます}} {{${hayaiId}||早[はや]く}}`);
});
it('throws on a lesson marker with an unknown slug', () => {
  expect(() => compile(/* {{nope||明日[あした]}} */)).toThrow(/Unresolved lesson word marker/);
});
it('throws when a lesson marker text does not match its word', () => {
  expect(() => compile(/* {{ashita||今日[きょう]}} */)).toThrow(/surface mismatch/);
});
it('throws on a malformed lesson marker', () => {
  expect(() => compile(/* 'x {{ashita|明日' */)).toThrow(/Malformed lesson word marker/);
});
it('stores uses word spans with item ids', () => {
  expect(JSON.parse(rule.uses)[0].word_spans).toEqual(
    [{ vocabulary_item_id: gakuseiId, start: 0, end: 2, inflection: null }]);
});
// validate-schema.test.ts
it('accepts word_spans on a grammar use', () => { /* use with word_spans validates */ });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest --config jest.config.cjs scripts/compile-curriculum.test.ts scripts/validate-schema.test.ts`
Expected: FAIL — markers unchanged; schema rejects `word_spans`.

- [ ] **Step 3: Implement** `resolveLessonMarkers`, the uses span mapping, the `GrammarUse.word_spans?: WordSpan[]` field, and the schema entry.

- [ ] **Step 4: Run root suite**

Run: `npx jest --config jest.config.cjs && npm run validate-schema`
Expected: all pass (84 existing + new); schema validation passes on current content.

- [ ] **Step 5: Commit**

```bash
git add scripts/compile-curriculum.ts scripts/compile-curriculum.test.ts scripts/validate-schema.test.ts curriculum/schema/curriculum.schema.json
git commit -m "Compile: resolve grammar lesson word markers and uses spans"
```

---

### Task 3: App parser — `linked` tokens

**Files:**
- Modify: `mobile/src/core/markdown/parseLessonMarkdown.ts`
- Test: `mobile/src/core/markdown/parseLessonMarkdown.test.ts`

**Interfaces:**
- Produces: `InlineSpan.link?: { vocabularyItemId: string; inflection: WordInflection | null }` (`WordInflection` from `@/core/content/inflection`).
- Produces: `splitWordMarkers(text: string, style?: Pick<InlineSpan, 'bold' | 'italic' | 'code'>): InlineSpan[]` — marker regex `/\{\{(\d+)\|(masu|te|nai|ta|)\|([^{}]+?)\}\}/g`; link spans carry the annotated text. `parseInlineSpans` runs it over every non-code span it emits.
- Produces: `RichToken.kind` adds `'linked'`; a linked token has `text` (annotated), `surface` (plain), `vocabularyItemId`, `inflection`, optional `trailing` (closing punctuation that followed it), style flags. `tokenizeSpans` emits exactly one linked token per link span; a following `JP_CLOSING_PUNCT_RE` character attaches as `trailing`.
- Produces: `spansNeedTokens(spans: InlineSpan[]): boolean` — true when any span has furigana or a link. `spansHaveFurigana` stays until Task 4 switches its only caller, then Task 4 removes it and its test.
- `LessonBlock` is unchanged: jp lines stay `string[]`; Task 4 calls `splitWordMarkers(line)` on each.

- [ ] **Step 1: Write the failing tests**

```ts
it('turns a marker into one linked token', () => {
  const tokens = tokenizeSpans(parseInlineSpans('to {{12|masu|起[お]きます}} now'));
  expect(tokens.filter((t) => t.kind === 'linked')).toEqual([
    { kind: 'linked', text: '起[お]きます', surface: '起きます', vocabularyItemId: '12', inflection: 'masu' },
  ]);
});
it('keeps bold on a marker inside **…**', () => {
  expect(parseInlineSpans('**{{3||明日[あした]}}**')).toEqual([
    { text: '明日[あした]', bold: true, link: { vocabularyItemId: '3', inflection: null } },
  ]);
});
it('attaches closing punctuation as trailing', () => {
  const [token] = tokenizeSpans(splitWordMarkers('{{3||明日[あした]}}。'));
  expect(token).toMatchObject({ kind: 'linked', trailing: '。' });
});
it('splits a jp line into spans with links', () => {
  expect(splitWordMarkers('{{3||明日[あした]}}です')).toEqual([
    { text: '明日[あした]', link: { vocabularyItemId: '3', inflection: null } }, { text: 'です' },
  ]);
});
it('leaves inline code with braces alone', () => {
  expect(parseInlineSpans('`{{3||明日}}`')).toEqual([{ text: '{{3||明日}}', code: true }]);
});
```

- [ ] **Step 2: Run** `cd mobile && npx jest src/core/markdown` → FAIL (no `linked` kind, `splitWordMarkers` missing).
- [ ] **Step 3: Implement** the interfaces above. Lines with no markers must produce exactly today's spans and tokens (existing tests untouched except the `spansHaveFurigana` rename).
- [ ] **Step 4: Run** `cd mobile && npx jest src/core/markdown src/components/common/LessonMarkdown && npx tsc --noEmit` → PASS, no type errors.
- [ ] **Step 5: Commit**

```bash
git add mobile/src/core/markdown/parseLessonMarkdown.ts mobile/src/core/markdown/parseLessonMarkdown.test.ts
git commit -m "Lesson markdown parser: linked word tokens"
```

---

### Task 4: App — `LinkedWord`, lesson rendering

**Files:**
- Create: `mobile/src/components/common/LinkedWord.tsx`, `mobile/src/components/common/LinkedWord.test.tsx`
- Modify: `mobile/src/components/common/LinkedSentence.tsx` (linked branch ~L117–205 → `LinkedWord`)
- Modify: `mobile/src/components/common/LessonMarkdown.tsx`
- Test: `mobile/src/components/common/LessonMarkdown.test.tsx` (mock `expo-router`, `useFuriganaPreference`, `useDatabase` as `LinkedSentence.test.tsx` does)

**Interfaces:**
- Consumes: Task 3 `RichToken` (`kind: 'linked'`), `spansNeedTokens`, `splitWordMarkers`. Switch `RichLine` from `spansHaveFurigana` to `spansNeedTokens`, then delete `spansHaveFurigana` and its test.
- Produces: `LinkedWord({ text, surface, vocabularyItemId, inflection, textClassName, testID, trailing? }: { text: string; surface: string; vocabularyItemId: string; inflection: WordInflection | null; textClassName: string; testID: string; trailing?: string })`. Body = today's `LinkedSentence` linked-span branch (tap → `hrefFor(id)`, with `{ surface, inflection }` params when inflected; long-press → `setOverride(id, visible ? 'hidden' : 'shown')`; a11y actions `activate` / `toggleFurigana`; `isKnownWord` Tier 1; `interactive={false}`; `text-content-vocabulary-deep underline`). `trailing` renders as a plain `Text` after the pressable inside the same row. `LinkedSentence` keeps its `isLinked` / locked-grammar inflection logic and passes the resulting `inflection` in; its tests pass unchanged.
- `LessonMarkdown`: `RichLine` renders `linked` tokens with `LinkedWord` (`textClassName` = base class + `inlineModifiers`, `testID` = `lesson-word-${id}-${index}`). When a line has any linked token, its container is **not** `accessible` (no line label); otherwise unchanged. jp blocks render each line as `RichLine spans={splitWordMarkers(line)}` with the jp class `text-body-lg font-jp text-primary`.

- [ ] **Step 1: Write the failing tests**

```ts
it('opens the word when a lesson word is tapped', () => {
  render(<LessonMarkdown markdown={'Say {{7||明日[あした]}} now.'} mode="auto" />);
  fireEvent.press(screen.getByTestId('lesson-word-7-1'));
  expect(mockPush).toHaveBeenCalledWith('/browse/item/7');
});
it('passes surface and inflection for a conjugated word in a jp block', () => {
  render(<LessonMarkdown markdown={'```jp\n{{12|masu|起[お]きます}}。\n```'} mode="auto" />);
  fireEvent.press(screen.getByTestId('lesson-word-12-0'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/browse/item/12', params: { surface: '起きます', inflection: 'masu' } });
});
it('long-press sets the per-word furigana override', () => {
  fireEvent(screen.getByTestId('lesson-word-7-1'), 'longPress');
  expect(mockSetOverride).toHaveBeenCalledWith('7', expect.stringMatching(/hidden|shown/));
});
it('keeps each linked word reachable by screen readers', () => {
  expect(screen.getByTestId('lesson-word-7-1').props.accessibilityRole).toBe('button');
  expect(screen.queryByLabelText('Say 明日 now.')).toBeNull();
});
// LinkedWord.test.tsx: renders trailing 。 next to the word, outside the pressable.
```

- [ ] **Step 2: Run** `cd mobile && npx jest src/components/common` → FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** `cd mobile && npx jest && npx tsc --noEmit && npm run lint` → all pass (2196 existing + new), no type or lint errors.
- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/common/LinkedWord.tsx mobile/src/components/common/LinkedWord.test.tsx mobile/src/components/common/LinkedSentence.tsx mobile/src/components/common/LessonMarkdown.tsx mobile/src/components/common/LessonMarkdown.test.tsx
git commit -m "Grammar lessons: linked words with per-word furigana"
```

---

### Task 5: App — linked "Uses" sentences; Studio strips markers

**Files:**
- Modify: `mobile/src/data/curriculum/itemRepository.ts` (`GrammarUse` ~L544, `parseGrammarUses` ~L785)
- Modify: `mobile/src/components/learn/GrammarUsesSection.tsx`
- Test: `mobile/src/data/curriculum/itemRepository.test.ts`, `mobile/src/components/learn/GrammarUsesSection.test.tsx` (new)
- Modify: `web/src/lib/furigana.tsx` (add `stripWordMarkers`), `web/src/pages/detail/GrammarDetail.tsx` L53

**Interfaces:**
- Consumes: Task 2 `uses` JSON `word_spans: [{ vocabulary_item_id, start, end, inflection }]`; Task 4 is not needed (`LinkedSentence` already exists).
- Produces: `GrammarUse.wordSpans: PassageWordSpan[]` (`[]` when absent), mapped `vocabularyItemId: String(vocabulary_item_id)`, `startOffset`, `endOffset`, `inflection`.
- `GrammarUsesSection` renders `<LinkedSentence japanese={use.japanese} furigana={use.furigana} spans={use.wordSpans} testIDPrefix="grammar-use" sentenceId={String(index)} />` in place of `FuriganaText`.
- Produces: `stripWordMarkers(text: string): string` in `web/src/lib/furigana.tsx` — `{{a|b|c}}` → `c`. Studio passes `stripWordMarkers(raw.explanation_markdown)` to `Markdown`.

- [ ] **Step 1: Write the failing tests**

```ts
it('maps uses word spans', () => {
  // uses JSON with word_spans [{ vocabulary_item_id: 5, start: 0, end: 2, inflection: null }]
  expect(rule.uses[0].wordSpans).toEqual([{ vocabularyItemId: '5', startOffset: 0, endOffset: 2, inflection: null }]);
});
it('links a word in a use sentence', () => {
  render(<GrammarUsesSection uses={[{ label: 'L', structure: 'S', japanese: '学生です。', furigana: '学[がく]生[せい]です。', english: 'E', wordSpans: [{ vocabularyItemId: '5', startOffset: 0, endOffset: 2, inflection: null }] }]} />);
  expect(screen.getByTestId('grammar-use-0-linked')).toBeTruthy();
});
```

- [ ] **Step 2: Run** `cd mobile && npx jest src/data/curriculum/itemRepository src/components/learn/GrammarUsesSection` → FAIL.
- [ ] **Step 3: Implement** the interfaces above.
- [ ] **Step 4: Run** `cd mobile && npx jest && npx tsc --noEmit && npm run lint`, then `cd web && npx tsc --noEmit` → all pass.
- [ ] **Step 5: Commit**

```bash
git add mobile/src/data/curriculum/itemRepository.ts mobile/src/data/curriculum/itemRepository.test.ts mobile/src/components/learn/GrammarUsesSection.tsx mobile/src/components/learn/GrammarUsesSection.test.tsx web/src/lib/furigana.tsx web/src/pages/detail/GrammarDetail.tsx
git commit -m "Grammar uses: linked words; Studio hides lesson word markers"
```

---

### Task 6: Rebuild content, check, docs

**Files:**
- Modify (generated): `curriculum/grammar/n5.json`, `curriculum/grammar/n4.json`, `mobile/assets/curriculum-seed/curriculum.db` (+ files the compile always touches: `curriculum/metadata.json`, seed info)
- Modify: `docs/working-history.md`, `docs/superpowers/specs/2026-10-17-grammar-linked-words-design.md` (Status line)

- [ ] **Step 1: Regenerate N5 and N4**

Run (repo root): `/Users/riyazahmed/Projects/japanese-learning/curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5`, then `--level n4`.
Expected: exits 0; capture stderr `warning:` lines.

- [ ] **Step 2: Check the diff is only markers and uses spans**

Run a script that loads `git show HEAD:curriculum/grammar/n5.json` and the new file (same for n4), and for every item asserts: removing markers (`{{a|b|c}}` → `c`) from the new `explanation_markdown` gives the old one; each use equals the old use plus only `word_spans`; every other field is equal. Also `git diff --stat` shows no change to `curriculum/vocabulary/*.json` or `curriculum/readings/*.json`.
Expected: zero mismatches. If anything else changed, stop and report to the user.

- [ ] **Step 3: Compile the seed**

Run: `npm run validate-schema && npm run compile-curriculum`
Expected: passes. Then `sqlite3 mobile/assets/curriculum-seed/curriculum.db "select count(*) from grammar_rules where explanation_markdown like '%{{%'"` → 161 (or report which points have none), and no `{{<letter>` remains.

- [ ] **Step 4: Report numbers** — total markers, markers per level, uses with spans, dropped-span warnings.

- [ ] **Step 5: Check in the app** — run the app (`run` skill), open a grammar detail page (e.g. い-adjective adverbs): tap 明日 opens its page; long-press toggles only that word's furigana; a "Uses" sentence word opens its page.

- [ ] **Step 6: Docs** — add a row for this spec in `docs/working-history.md` (Done once Step 5 passes, else Partial with the leftover); set the spec Status line.

- [ ] **Step 7: Commit**

```bash
git add curriculum/grammar/n5.json curriculum/grammar/n4.json mobile/assets/curriculum-seed/curriculum.db curriculum/metadata.json docs/working-history.md docs/superpowers/specs/2026-10-17-grammar-linked-words-design.md
git commit -m "Curriculum: link words in grammar lessons and uses"
```

(Add any other file the compile changed, by explicit path, after checking `git status`.)
