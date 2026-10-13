# Grammar Sentence Pool — Content (Plan 2 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the grammar sentence pool so every N5 and N4 grammar point passes `check_grammar_pool`, then make that validator a hard build gate.

**Architecture:** First four pipeline fixes found in the Plan 1 review: stem spans (so 行き in 行きましょう gets a word link), the `form` anchor syntax (`今日|は`), the new rule 6 (pronouns optional, other-grammar checked at the grammar position, alternates authored as plain Japanese), and a `pool.json` sidecar that `generate.py` inlines. Then a single-session content lane (`generate_pool.py` + one runbook) writes meanings, sentences and alternates per grammar point against the validator. Content runs happen in fresh sessions until nothing is left. Last, `generate.py` refuses to write a level whose pool fails.

**Tech Stack:** Python 3.12 + fugashi/unidic-lite (`curriculum/_build/.venv`), stdlib `unittest`; TypeScript + jest (`scripts/`); JSON Schema.

**Spec:** `docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` (§4, decisions D8–D10). **Previous plan:** `docs/superpowers/plans/2026-10-13-grammar-pool-pipeline.md` (done; baseline `curriculum/_build/reports/grammar-pool-baseline.md`).

## Global Constraints

- Never write to `curriculum.db` at runtime. `metadata.json` `version` is raised only by `npm run compile-curriculum`.
- Do not touch app code under `mobile/src` (Plan 3).
- Do not remove `cloze_variants`, `check_cloze.py`, or the `grammar_cloze_variants` table (Plan 3).
- Python tests use stdlib `unittest`, run from `curriculum/_build` with `.venv/bin/python -m unittest …`. Script tests: `npx jest --config jest.config.cjs scripts/` from the repo root.
- Range rule stays `context.allowed_vocab_for` + `level_check.find_violations` (spec D10). Never widen it to make content pass.
- Pool minimum **8** sentences per point; meanings **3–6** per point (spec D8, §4.4 rule 7).
- A stem span is stored in `curriculum.db` with `inflection = NULL`; the app's existing null branch shows "行き is a conjugated form of 行く". No app change.
- Sidecar `curriculum/grammar/pool.json` is keyed by grammar slug. A point with a sidecar entry takes **all** its pool sentences and meanings from the sidecar; the source `examples` and cloze-derived sentences are not used for that point.
- Alternates are authored as **plain Japanese**; `generate.py` adds furigana. A kanji alternate the tokenizer cannot annotate is a build error.
- `review_status` is never set to `reviewed` by automation.

## Review Focus

1. **A stem span that overlaps an existing dictionary or inflected span** (勉強 + 勉強し) — the existing span must win; no overlapping spans may reach compile. Test in Task 1.
2. **An anchor whose context text appears before the grammar more than once** (`は|は`-style or repeated context) — the first `context+grammar` occurrence is used, and a missing one is a build error. Test in Task 2.
3. **An other-grammar alternate that differs from the main sentence in more than the grammar** (swaps から→ので *and* drops a word) — must be rejected unless the same sentence with the grammar swapped back is the main sentence or a valid alternate. Test in Task 3.
4. **A reply with a sentence that lacks `vocabulary_slugs`, uses an unknown slug, or an unknown alternate kind** — ingest must report it as a validation error and keep the prompt for repair, never crash or write the sidecar. Test in Task 5.
5. **Re-running select after a partly failed session** — points that failed ingest have no sidecar entry and must be selected again; points in the sidecar must never be selected again. Test in Task 5.

---

## File structure

| File | Responsibility |
|------|----------------|
| `curriculum/_build/generate_content/spans.py` | + `STEM`, `build_stem_spans` |
| `curriculum/_build/generate_content/grammar_sentences.py` | `grammar_span` anchor syntax |
| `curriculum/_build/generate_content/check_grammar_pool.py` | Rule 6 rewrite; `pronoun_slugs`; `check_point` |
| `curriculum/_build/generate.py` | Stem spans on grammar examples; alternates furigana; `pool.json` inlining; `build_grammar_point`; final hard gate |
| `curriculum/_build/generate_content/generate_pool.py` (new) | Lane CLI: `select`, `webprompts`, `ingest` |
| `curriculum/_build/generate_content/prompts/grammar-pool.md` (new) | Lane prompt template |
| `curriculum/_build/generate_content/test_*.py` | Tests per task |
| `curriculum/schema/curriculum.schema.json`, `scripts/compile-curriculum.ts`, `scripts/validate-schema.ts` | `stem` inflection; `pool.json` is a sidecar |
| `docs/workflows/grammar-pool-single-session-workflow-automation-prompt.md` (new), `docs/workflows/README.md` | Lane runbook |
| `curriculum/grammar/pool.json` (new, content) | Authored pool, one entry per grammar point |

---

### Task 1: Stem spans

**Files:**
- Modify: `curriculum/_build/generate_content/spans.py` (add after `build_inflected_spans`)
- Modify: `curriculum/_build/generate.py` — `_grammar_example`
- Modify: `curriculum/schema/curriculum.schema.json` — `$defs.wordSpan.properties.inflection.enum`
- Modify: `scripts/compile-curriculum.ts` — `resolveWordSpans` (≈ lines 272–297)
- Test: `curriculum/_build/generate_content/test_stem_spans.py` (new), `scripts/compile-curriculum.test.ts`

**Interfaces:**
- Consumes: `spans.tokens_with_offsets`, `spans.inflection_stem`, `spans.merge_spans`.
- Produces: `spans.STEM = "stem"`; `spans.build_stem_spans(text: str, forms_by_slug: dict[str, str], tokens=None) -> list[dict]` — each `{"vocabulary_slug", "start", "end", "surface_form", "inflection": "stem"}`. Grammar example `word_spans` = existing spans merged with stem spans (existing win). Compile stores `inflection = NULL` for `stem`.

- [ ] **Step 1: Write the failing Python test**

```python
# curriculum/_build/generate_content/test_stem_spans.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import spans  # noqa: E402


class StemSpanTest(unittest.TestCase):
    def test_masu_stem_before_mashou(self):
        self.assertEqual(
            spans.build_stem_spans("一緒に行きましょう。", {"iku-v": "行く"}),
            [{"vocabulary_slug": "iku-v", "start": 3, "end": 5,
              "surface_form": "行き", "inflection": "stem"}],
        )

    def test_adjective_adverb_form(self):
        result = spans.build_stem_spans("早く起きます。", {"hayai": "早い"})
        self.assertEqual(result[0]["surface_form"], "早く")
        self.assertEqual((result[0]["start"], result[0]["end"]), (0, 2))

    def test_dictionary_form_is_not_a_stem(self):
        self.assertEqual(spans.build_stem_spans("行く前に", {"iku-v": "行く"}), [])

    def test_unlinked_word_gets_nothing(self):
        self.assertEqual(spans.build_stem_spans("行きましょう。", {"taberu": "食べる"}), [])

    def test_existing_spans_win_on_merge(self):
        text = "行きます。"
        forms = {"iku-v": "行く"}
        merged = spans.merge_spans(spans.derive_spans(text, forms),
                                   spans.build_stem_spans(text, forms))
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged[0]["inflection"], "masu")


if __name__ == "__main__":
    unittest.main()
```

Add to `curriculum/_build/generate_content/test_generate_grammar_level.py` (class `GrammarLevelTest`):

```python
    def test_grammar_example_gets_stem_span(self):
        vocab = {**VOCAB, "iku-v": "行く"}
        item = generate._build_grammar_level(
            "N5",
            [entry(slug="zz-test-mashou", primary_form="ましょう", accepted_forms=["ましょう"],
                   examples=[generate_ex("一緒に行きましょう。", "Let's go together.", ["iku-v"])],
                   cloze_variants=[])],
            vocab, None, (), known_vocab_forms=vocab,
        )["items"][0]
        spans_ = item["example_sentences"][0]["word_spans"]
        self.assertIn({"vocabulary_slug": "iku-v", "start": 3, "end": 5,
                       "surface_form": "行き", "inflection": "stem"}, spans_)
```

- [ ] **Step 2: Run to verify failure**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_stem_spans generate_content.test_generate_grammar_level -v`
Expected: ERROR — `module 'generate_content.spans' has no attribute 'build_stem_spans'`.

- [ ] **Step 3: Implement `build_stem_spans`**

In `spans.py`, add next to the other inflection constants:

```python
#: A conjugated stem whose ending is the grammar point being taught (行き of
#: 行きましょう, 早く of 早く起きる). The span claims only the stem, never a
#: named form; compile stores it with inflection NULL, so the app says "a
#: conjugated form of 行く" instead of naming an untaught pattern.
STEM = "stem"
```

and after `build_inflected_spans`:

```python
def build_stem_spans(text, forms_by_slug, tokens=None):
    """Stem-only spans for linked verbs/adjectives that no taught-inflection
    span covers (grammar pool sentences only). One token per span; the same
    stem invariant as every other inflected span."""
    tokens = tokens if tokens is not None else tokens_with_offsets(text)
    slug_by_form = {}
    for slug, form in forms_by_slug.items():
        slug_by_form.setdefault(form, slug)
    spans = []
    for token in tokens:
        if token["pos1"] not in ("動詞", "形容詞"):
            continue
        base = token["orth_base"] or token["lemma"]
        slug = slug_by_form.get(base) if base else None
        if slug is None:
            continue
        surface = token["surface"]
        primary_form = forms_by_slug[slug]
        stem = inflection_stem(primary_form)
        if surface == primary_form or not surface.startswith(stem) or len(surface) <= len(stem):
            continue
        spans.append({
            "vocabulary_slug": slug,
            "start": token["start"],
            "end": token["end"],
            "surface_form": surface,
            "inflection": STEM,
        })
    return spans
```

- [ ] **Step 4: Use it for grammar examples**

In `generate.py` `_grammar_example`, replace

```python
    word_spans = _example_word_spans(jp, vslugs, vocab_forms)
    if word_spans:
        sentence["word_spans"] = word_spans
```

with

```python
    word_spans = _example_word_spans(jp, vslugs, vocab_forms)
    # Pool sentences also link the stem in front of the grammar (行き of
    # 行きましょう), which the taught-inflection spans deliberately skip.
    forms_by_slug = {s: vocab_forms[s] for s in vslugs if s in vocab_forms}
    word_spans = spans_lib.merge_spans(word_spans, spans_lib.build_stem_spans(jp, forms_by_slug))
    if word_spans:
        sentence["word_spans"] = word_spans
```

- [ ] **Step 5: Run the Python tests**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_stem_spans generate_content.test_generate_grammar_level generate_content.test_grammar_sentences generate_content.test_check_grammar_pool -v`
Expected: PASS.

- [ ] **Step 6: Write the failing compile test**

Append inside `describe('compile-curriculum', …)` in `scripts/compile-curriculum.test.ts`:

```ts
  it('stores a stem span with a null inflection after checking the stem', () => {
    // "一があります。" — あり is a stem of the fixture's ichi-v stand-in.
    const { dbPath, tempDir, run } = compileWithExampleSpans([
      { vocabulary_slug: 'ichi-v', start: 2, end: 4, surface_form: 'あり', inflection: 'stem' },
    ]);
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const span = db
        .prepare('SELECT start_offset, end_offset, inflection FROM example_sentence_spans')
        .get();
      expect(span).toEqual({ start_offset: 2, end_offset: 4, inflection: null });
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
```

- [ ] **Step 7: Run to verify failure**

Run: `npx jest --config jest.config.cjs scripts/compile-curriculum.test.ts -t "stem span"`
Expected: FAIL — schema enum rejects `stem`, or `inflection not taught`.

- [ ] **Step 8: Schema + compile**

In `curriculum/schema/curriculum.schema.json`, `$defs.wordSpan.properties.inflection.enum` becomes `["masu", "te", "nai", "ta", "stem"]`.

In `scripts/compile-curriculum.ts` `resolveWordSpans`, replace the `if (!TAUGHT_INFLECTIONS.has(span.inflection))` guard with

```ts
      // 'stem' is a grammar-pool stem span (行き of 行きましょう): verified by
      // the same stem invariant, stored with a null inflection so the app
      // never names an untaught pattern.
      if (span.inflection !== 'stem' && !TAUGHT_INFLECTIONS.has(span.inflection)) {
```

and in `resolved.push`, replace `inflection: span.inflection ?? null,` with

```ts
      inflection: span.inflection === undefined || span.inflection === 'stem' ? null : span.inflection,
```

If `WordSpan.inflection` is typed as a union of the four taught values, add `'stem'` to that union.

- [ ] **Step 9: Run all script tests**

Run: `npx jest --config jest.config.cjs scripts/`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add curriculum/_build/generate_content/spans.py curriculum/_build/generate.py curriculum/_build/generate_content/test_stem_spans.py curriculum/_build/generate_content/test_generate_grammar_level.py curriculum/schema/curriculum.schema.json scripts/compile-curriculum.ts scripts/compile-curriculum.test.ts
git commit -m "Link conjugated stems in grammar pool sentences"
```

---

### Task 2: `form` anchor syntax

**Files:**
- Modify: `curriculum/_build/generate_content/grammar_sentences.py` — `grammar_span`
- Test: `curriculum/_build/generate_content/test_grammar_sentences.py`

**Interfaces:**
- Produces: `grammar_span(japanese, accepted_forms, form=None)` — `form` may be `"context|grammar"`: locates the first `context + grammar`, returns the span of `grammar` only. Raises `ValueError` when not found or when `grammar` is empty.

- [ ] **Step 1: Write the failing tests**

Add to `GrammarSpanTest`:

```python
    def test_anchor_highlights_only_the_grammar(self):
        self.assertEqual(
            gs.grammar_span("こんにちは、今日は寒いです。", ["は"], form="今日|は"),
            {"start": 8, "end": 9},
        )

    def test_anchor_missing_raises(self):
        with self.assertRaises(ValueError):
            gs.grammar_span("こんにちは。", ["は"], form="今日|は")

    def test_anchor_without_grammar_raises(self):
        with self.assertRaises(ValueError):
            gs.grammar_span("今日は寒い。", ["は"], form="今日|")
```

- [ ] **Step 2: Run to verify failure**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_sentences -v`
Expected: FAIL — `form '今日|は' not found`.

- [ ] **Step 3: Implement**

In `grammar_span`, replace the `if form is not None:` block with

```python
    if form is not None:
        context_text, sep, grammar_text = form.partition("|")
        if not sep:
            context_text, grammar_text = "", form
        if not grammar_text:
            raise ValueError(f"grammar form {form!r} names no grammar after '|'")
        start = japanese.find(context_text + grammar_text)
        if start < 0:
            raise ValueError(f"grammar form {form!r} not found in {japanese!r}")
        start += len(context_text)
        return {"start": start, "end": start + len(grammar_text)}
```

Update the docstring sentence about `form` to: "`form` is the authored chunk; `今日|は` finds 今日は and highlights only は (text before `|` is context)."

- [ ] **Step 4: Run tests**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_sentences generate_content.test_generate_grammar_level -v`
Expected: PASS (the Plan 1 test `test_authored_form_beats_search` with `form="今日は"` still passes — no `|` means the whole form).

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate_content/grammar_sentences.py curriculum/_build/generate_content/test_grammar_sentences.py
git commit -m "Support context|grammar anchors in grammar span forms"
```

---

### Task 3: Rule 6 rewrite and plain-Japanese alternates

**Files:**
- Modify: `curriculum/_build/generate_content/check_grammar_pool.py` — `_alternate_errors`, `sentence_errors`, `point_errors`, new `check_point`, `check_level`
- Modify: `curriculum/_build/generate.py` — `_grammar_example` (alternates)
- Modify: `curriculum/_build/n5_grammar.py`, `n4_grammar.py` — `ex()` docstring
- Modify: spec §4.3 / §4.4 rule 6 wording
- Test: `curriculum/_build/generate_content/test_check_grammar_pool.py`, `test_generate_grammar_level.py`

**Interfaces:**
- Produces:
  - `sentence_errors(sentence, item, allowed_index, other_family_forms, vocab_forms, pronoun_slugs=frozenset())`
  - `point_errors(item, allowed_index, other_family_forms, vocab_forms, pronoun_slugs=frozenset())`
  - `check_point(level: str, item: dict) -> list[str]` — the full rule set for one built item, using the same context as `check_level`
  - `pronoun_slugs_through(level) -> frozenset[str]` — slugs whose vocab `word_type` contains `pronoun`
- Source format: `ex(..., alts=[(plain_japanese, kind), …])`; JSON `build_alternates[].furigana` is derived.

Rule 6, exactly:
- Every alternate's plain text (furigana stripped) contains every linked word **except pronoun slugs** (`derive_spans` over the linked forms).
- `valid`: contains the sentence's grammar chunk.
- `other_grammar`: for some same-family form `f` present in it, replacing the first `f` with the grammar chunk gives the main sentence's text or a `valid` alternate's plain text.

- [ ] **Step 1: Write the failing tests**

In `test_check_grammar_pool.py`, replace `test_rule6_alternates` with:

```python
    def test_rule6_alternates(self):
        s = dict(GOOD, build_alternates=[
            {"furigana": "寒[さむ]いですから、コートを着[き]ます。", "kind": "valid"},
            {"furigana": "寒[さむ]いので、コートを着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ]いので、着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ]いので、コートを着[き]ます。", "kind": "valid"},
            {"furigana": "寒[さむ]いから、コートを着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ", "kind": "valid"},
            {"furigana": "暑[あつ]いので、コートを着[き]ます。", "kind": "other_grammar"},
        ])
        errors = [e for e in self.errors(s) if "rule 6" in e]
        # 3 drops コート; 4 lacks から; 5 has no other-grammar form; 6 does not
        # parse; 7 drops 寒い (暑い is a different word).
        self.assertEqual(len(errors), 5)

    def test_rule6_pronoun_may_be_dropped(self):
        s = sentence(
            "私は寒いから、コートを着ます。",
            [{"vocabulary_slug": "watashi", "start": 0, "end": 1},
             {"vocabulary_slug": "samui", "start": 2, "end": 4},
             {"vocabulary_slug": "kooto", "start": 7, "end": 10},
             {"vocabulary_slug": "kiru-wear", "start": 11, "end": 14, "inflection": "masu"}],
            {"start": 4, "end": 6},
            alts=[{"furigana": "寒[さむ]いから、コートを着[き]ます。", "kind": "valid"}],
        )
        vocab = {**VOCAB, "watashi": "私"}
        errors = pool.sentence_errors(s, item([s]), ALLOWED | {"私"}, OTHER, vocab,
                                      pronoun_slugs=frozenset({"watashi"}))
        self.assertEqual([e for e in errors if "rule 6" in e], [])
```

In `test_generate_grammar_level.py`, change the `alts=` in `entry()` to plain Japanese and assert the derived furigana:

```python
                        alts=[("寒いですから、コートを着ます。", "valid"),
                              ("寒いので、コートを着ます。", "other_grammar")]),
```

and in `test_authored_example_gets_span_register_alternates` keep the expected `build_alternates` exactly as they are (bracketed furigana — now derived, not copied).

Add:

```python
    def test_unannotatable_kanji_alternate_is_a_build_error(self):
        bad = entry(examples=[generate_ex("寒いから、コートを着ます。", "x",
                                          ["samui", "kooto", "kiru-wear"],
                                          alts=[("寒[いから", "valid")])],
                    cloze_variants=[])
        with self.assertRaises(ValueError):
            build([bad])
```

- [ ] **Step 2: Run to verify failure**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_check_grammar_pool generate_content.test_generate_grammar_level -v`
Expected: FAIL — wrong rule-6 count, unexpected keyword `pronoun_slugs`, alternates copied verbatim.

- [ ] **Step 3: Derive alternate furigana in `generate.py`**

In `_grammar_example`, replace the `build_alternates` block with

```python
    alternates = []
    for plain, kind in example.get("alts") or []:
        furigana = furigana_lib.annotate_sentence(plain, known_readings)
        if furigana is None or "[" in plain:
            errors.append(f"grammar {g['slug']} example {sort_order}: alternate "
                          f"{plain!r} cannot be annotated (write plain Japanese)")
            continue
        alternates.append({"furigana": furigana, "kind": kind})
    if alternates:
        sentence["build_alternates"] = alternates
```

Update the `ex()` docstring in both source files: `alts` lists other Build-card answers as `(plain Japanese, kind)`; the build adds furigana.

- [ ] **Step 4: Rewrite rule 6 and add `check_point`**

In `check_grammar_pool.py`, replace `_alternate_errors` with

```python
def _alternate_errors(sentence, item, other_family_forms, vocab_forms, pronoun_slugs):
    errors = []
    span = sentence.get("grammar_span")
    chunk = sentence["japanese"][span["start"]:span["end"]] if span else None
    linked = {s: vocab_forms[s] for s in sentence.get("vocabulary_slugs", []) if s in vocab_forms}
    required = set(linked) - set(pronoun_slugs)
    alternates = sentence.get("build_alternates", [])
    plains = [_parse_alternate(alt["furigana"]) for alt in alternates]
    accepted_plain = {sentence["japanese"]} | {
        plain for plain, alt in zip(plains, alternates) if plain and alt["kind"] == "valid"
    }
    for index, (alt, plain) in enumerate(zip(alternates, plains)):
        label = f"rule 6 alternate[{index}]"
        if plain is None:
            errors.append(f"{label}: furigana does not parse: {alt['furigana']!r}")
            continue
        found = {s["vocabulary_slug"] for s in spans_lib.derive_spans(plain, linked)}
        missing = sorted(required - found)
        if missing:
            errors.append(f"{label}: missing words {missing} in {plain!r}")
            continue
        if alt["kind"] == "valid" and chunk and chunk not in plain:
            errors.append(f"{label}: valid alternate lacks the grammar {chunk!r}: {plain!r}")
        if alt["kind"] == "other_grammar" and not (chunk and any(
            f in plain and plain.replace(f, chunk, 1) in accepted_plain
            for f in other_family_forms
        )):
            errors.append(
                f"{label}: other_grammar alternate is not an accepted answer with a "
                f"same-family form in place of {chunk!r}: {plain!r}"
            )
    return errors
```

Thread `pronoun_slugs=frozenset()` through `sentence_errors` (pass to `_alternate_errors`) and `point_errors` (pass to `sentence_errors`).

Add, and make `check_level` use it:

```python
def pronoun_slugs_through(level):
    return frozenset(
        v["slug"]
        for lower in context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level) + 1]
        for v in context.load_vocab(lower)
        if "pronoun" in (v.get("word_type") or "")
    )


def check_point(level, item):
    """Every rule for one built grammar item, with the same context as
    check_level — used by the content lane's ingest before anything is written."""
    vocab_forms = {
        v["slug"]: v["primary_form"]
        for lower in context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level) + 1]
        for v in context.load_vocab(lower)
    }
    allowed = level_check.build_allowed_index(context.allowed_vocab_for(level, item["slug"]))
    return point_errors(
        item, allowed, _other_family_forms(item, grammar_through(level)), vocab_forms,
        pronoun_slugs_through(level),
    )


def check_level(level):
    """{slug: [errors]} for every grammar point at `level`."""
    return {item["slug"]: check_point(level, item) for item in context.load_grammar(level)}
```

- [ ] **Step 5: Update the spec wording**

In the spec §4.3, change the alternates bullet to say alternates are authored as plain Japanese and the build adds furigana. In §4.4 rule 6, replace the `other_grammar` clause with: "Every `other_grammar` alternate, with its first same-family form replaced by the grammar chunk, equals the main sentence or a `valid` alternate."

- [ ] **Step 6: Run tests**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_check_grammar_pool generate_content.test_generate_grammar_level generate_content.test_grammar_sentences generate_content.test_stem_spans -v`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add curriculum/_build/generate_content/check_grammar_pool.py curriculum/_build/generate_content/test_check_grammar_pool.py curriculum/_build/generate.py curriculum/_build/generate_content/test_generate_grammar_level.py curriculum/_build/n5_grammar.py curriculum/_build/n4_grammar.py docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md
git commit -m "Rule 6: optional pronouns, swap-back other-grammar check, plain alternates"
```

---

### Task 4: `pool.json` sidecar and single-point build

**Files:**
- Modify: `curriculum/_build/generate.py` — `_build_grammar_level`, `generate_level`; new `POOL_SIDECAR`, `load_pool_sidecar`, `_grammar_inputs`, `build_grammar_point`
- Modify: `scripts/validate-schema.ts:16` — `SIDECAR_FILE_NAMES`
- Test: `curriculum/_build/generate_content/test_generate_grammar_level.py`

**Interfaces:**
- Produces:
  - Sidecar `curriculum/grammar/pool.json`: `{slug: {"accepted_meanings": [str], "sentences": [{"japanese", "english", "vocabulary_slugs": [str], "form"?: str, "alternates": [{"japanese": str, "kind": "valid"|"other_grammar"}]}], "_meta": {"generator_model", "prompt_version", "review_status": "draft"}}}`
  - `generate.load_pool_sidecar() -> dict`
  - `_build_grammar_level(..., known_vocab_forms=None, pool_entries=None)`
  - `generate.build_grammar_point(level: str, slug: str, pool_entry: dict) -> dict` — the grammar item exactly as `generate_level` would write it with `pool_entry` in the sidecar

- [ ] **Step 1: Write the failing tests**

Add to `GrammarLevelTest`:

```python
    POOL = {
        "accepted_meanings": ["because", "since", "so", "as"],
        "sentences": [
            {"japanese": "寒いから、コートを着ます。", "english": "Because it's cold, I'll wear a coat.",
             "vocabulary_slugs": ["samui", "kooto", "kiru-wear"],
             "alternates": [{"japanese": "寒いですから、コートを着ます。", "kind": "valid"}]},
            {"japanese": "今日は寒いから。", "english": "Because it's cold today.",
             "vocabulary_slugs": ["kyou", "samui"], "form": "寒い|から"},
        ],
        "_meta": {"generator_model": "test", "prompt_version": "1", "review_status": "draft"},
    }

    def test_pool_entry_replaces_examples_cloze_and_meanings(self):
        item = generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, (), known_vocab_forms=VOCAB,
            pool_entries={"zz-test-kara": self.POOL},
        )["items"][0]
        self.assertEqual([s["japanese"] for s in item["example_sentences"]],
                         ["寒いから、コートを着ます。", "今日は寒いから。"])
        self.assertEqual(item["example_sentences"][1]["grammar_span"], {"start": 5, "end": 7})
        self.assertEqual([a["answer_text"] for a in item["accepted_answers"]],
                         ["because", "since", "so", "as"])
        self.assertEqual(item["example_sentences"][0]["build_alternates"][0]["kind"], "valid")
        self.assertNotIn("_meta", item)

    def test_point_without_pool_entry_is_unchanged(self):
        item = generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, (), known_vocab_forms=VOCAB, pool_entries={},
        )["items"][0]
        self.assertEqual(len(item["example_sentences"]), 2)
```

- [ ] **Step 2: Run to verify failure**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level -v`
Expected: ERROR — unexpected keyword `pool_entries`.

- [ ] **Step 3: Implement**

In `generate.py`, near `LESSONS_DIR`:

```python
#: Grammar sentence pool sidecar (docs/superpowers/plans/2026-10-14-grammar-pool-content.md):
#: a point with an entry takes all its pool sentences and meanings from here.
POOL_SIDECAR = os.path.join(CURRICULUM_DIR, "grammar", "pool.json")


def load_pool_sidecar():
    if not os.path.exists(POOL_SIDECAR):
        return {}
    with open(POOL_SIDECAR, encoding="utf-8") as f:
        return json.load(f)


def _pool_examples(pool_entry):
    return [
        {"jp": s["japanese"], "en": s["english"], "vocab": s["vocabulary_slugs"],
         "form": s.get("form"),
         "alts": [(a["japanese"], a["kind"]) for a in s.get("alternates", [])]}
        for s in pool_entry["sentences"]
    ]
```

Change `_build_grammar_level`'s signature to add `pool_entries=None`, and at the top of the per-point loop:

```python
        pool_entry = (pool_entries or {}).get(g["slug"])
        if pool_entry:
            examples = _pool_examples(pool_entry)
        else:
            examples = list(g["examples"]) + _cloze_derived_examples(g, known_vocab_forms or {})
```

(replacing the existing `examples = …` line), and change the meanings block to

```python
        meanings = pool_entry["accepted_meanings"] if pool_entry else g.get("accepted_meanings")
        if meanings:
            item["accepted_answers"] = [
                {"answer_type": "meaning", "answer_text": meaning, "is_primary": index == 0}
                for index, meaning in enumerate(meanings)
            ]
```

Refactor `generate_level`: move the lines that build `vocab_by_level`, `all_vocab_forms`, `known`, `known_readings`, `grammar_by_level`, `all_grammar_slugs` into

```python
def _grammar_inputs(level):
    from n4_grammar import N4_GRAMMAR
    from n5_grammar import N5_GRAMMAR
    vocab_by_level = place("vocabulary", _vocab_sources())
    all_vocab_forms = {
        v["slug"]: v["form"] for entries in vocab_by_level.values() for v in entries
    }
    known = [v for lower in BAND_LEVELS[: BAND_LEVELS.index(level) + 1]
             for v in vocab_by_level[lower]]
    grammar_by_level = place("grammar", [("n5", N5_GRAMMAR), ("n4", N4_GRAMMAR)])
    return {
        "vocab_by_level": vocab_by_level,
        "all_vocab_forms": all_vocab_forms,
        "known": known,
        "known_readings": _vocab_reading_map(known),
        "grammar_by_level": grammar_by_level,
        "all_grammar_slugs": {g["slug"] for entries in grammar_by_level.values() for g in entries},
    }
```

and use it in `generate_level` (vocab and readings keep using `inputs["known"]`, `inputs["known_readings"]`), passing `pool_entries=load_pool_sidecar()` to the grammar build. Add:

```python
def build_grammar_point(level, slug, pool_entry):
    """One grammar item as generate_level would write it with `pool_entry` in
    the sidecar. The content lane validates this before writing anything."""
    level = level.lower()
    inputs = _grammar_inputs(level)
    entries = [g for g in inputs["grammar_by_level"][level] if g["slug"] == slug]
    if not entries:
        raise KeyError(f"unknown grammar slug {slug!r} in {level}")
    item = _build_grammar_level(
        level.upper(), entries, inputs["all_vocab_forms"], inputs["known_readings"],
        inputs["all_grammar_slugs"],
        known_vocab_forms={v["slug"]: v["form"] for v in inputs["known"]},
        pool_entries={slug: pool_entry},
    )["items"][0]
    item["sort_order"] = next(
        i for i, g in enumerate(inputs["grammar_by_level"][level], start=1) if g["slug"] == slug
    )
    return item
```

In `scripts/validate-schema.ts`, change `SIDECAR_FILE_NAMES` to `new Set(['mnemonics.json', 'examples.json', 'pool.json'])`.

- [ ] **Step 4: Run tests and a no-op regenerate**

Run:

```bash
cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level -v
.venv/bin/python generate.py --level n5 && .venv/bin/python generate.py --level n4
cd ../.. && git diff --stat curriculum/grammar/ && npx jest --config jest.config.cjs scripts/
```

Expected: tests PASS; with no `pool.json` yet, `git diff` on `curriculum/grammar/*.json` is empty (stem spans from Task 1 may add `word_spans` entries — that diff is expected; nothing else changes); script tests PASS.

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate.py curriculum/_build/generate_content/test_generate_grammar_level.py scripts/validate-schema.ts curriculum/grammar/n5.json curriculum/grammar/n4.json
git commit -m "Inline the grammar pool sidecar; build one grammar point for the lane"
```

---

### Task 5: Content lane CLI and prompt

**Files:**
- Create: `curriculum/_build/generate_content/generate_pool.py`
- Create: `curriculum/_build/generate_content/prompts/grammar-pool.md`
- Test: `curriculum/_build/generate_content/test_generate_pool.py`

**Interfaces:**
- Consumes: `generate.build_grammar_point`, `generate.load_pool_sidecar`, `generate.POOL_SIDECAR`; `check_grammar_pool.check_point`; `context.load_grammar`, `context.allowed_vocab_for`, `context.format_vocab_list`, `context.format_grammar_list`, `check_grammar_pool.grammar_through`, `check_grammar_pool._other_family_forms`; `generate_examples._first_json_object`; `prompts/persona.md`.
- Produces:
  - `PROMPT_VERSION = 1`, `WEB_DIR = generate_content/web/pool`
  - `select_slugs(level: str, limit: int, sidecar: dict) -> list[str]`
  - `reply_errors(reply: dict) -> list[str]` (shape only)
  - `merge_into_sidecar(path: str, slug: str, reply: dict, model: str) -> None`
  - CLI: `select --level L --limit N`, `webprompts --level L --slugs a,b`, `ingest --level L --slug S --model M`

- [ ] **Step 1: Write the failing tests**

```python
# curriculum/_build/generate_content/test_generate_pool.py
# -*- coding: utf-8 -*-
import json
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import generate_pool as gp  # noqa: E402

REPLY = {
    "accepted_meanings": ["because", "since", "so"],
    "sentences": [
        {"japanese": "寒いから、コートを着ます。", "english": "x",
         "vocabulary_slugs": ["samui"], "alternates": [{"japanese": "寒いですから。", "kind": "valid"}]},
    ],
}


class ReplyShapeTest(unittest.TestCase):
    def test_good_reply(self):
        self.assertEqual(gp.reply_errors(REPLY), [])

    def test_missing_fields_and_bad_kind(self):
        bad = {"accepted_meanings": "because",
               "sentences": [{"japanese": "寒い。", "english": "x"},
                             {"japanese": "寒い。", "english": "x", "vocabulary_slugs": [],
                              "alternates": [{"japanese": "寒い", "kind": "maybe"}]}]}
        errors = gp.reply_errors(bad)
        self.assertTrue(any("accepted_meanings" in e for e in errors))
        self.assertTrue(any("sentences[0]" in e and "vocabulary_slugs" in e for e in errors))
        self.assertTrue(any("sentences[1]" in e and "kind" in e for e in errors))


class SelectTest(unittest.TestCase):
    def test_skips_sidecar_points_in_sort_order(self):
        slugs = gp.select_slugs("n5", 3, sidecar={"wa-topic": {}})
        self.assertEqual(len(slugs), 3)
        self.assertNotIn("wa-topic", slugs)
        self.assertEqual(slugs[0], "desu")


class SidecarTest(unittest.TestCase):
    def test_merge_keeps_other_entries(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = os.path.join(tmp, "pool.json")
            with open(path, "w", encoding="utf-8") as f:
                json.dump({"other": {"accepted_meanings": ["x"]}}, f)
            gp.merge_into_sidecar(path, "kara-because", REPLY, "claude-test")
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
        self.assertEqual(set(data), {"other", "kara-because"})
        self.assertEqual(data["kara-because"]["_meta"],
                         {"generator_model": "claude-test", "prompt_version": "1",
                          "review_status": "draft"})


if __name__ == "__main__":
    unittest.main()
```

(`desu` is the second N5 point after `wa-topic` in `curriculum/grammar/n5.json`; confirm with `context.load_grammar("n5")[1]["slug"]` and adjust the literal only if the curriculum order differs.)

- [ ] **Step 2: Run to verify failure**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_pool -v`
Expected: ERROR — `cannot import name 'generate_pool'`.

- [ ] **Step 3: Write the prompt template**

`curriculum/_build/generate_content/prompts/grammar-pool.md`:

```markdown
# Write the review sentence pool for one {{LEVEL}} grammar point

These sentences are what a learner reviews this grammar with, for months. Each
review shows one sentence on a **Read** card (the learner types the meaning of
the highlighted grammar) and a different one on a **Build** card (the learner
sees the English and a list of the words, and types the whole Japanese
sentence). Follow the teaching voice above.

## The grammar point

- Form: **{{FORM}}** — {{MEANING}}
- Structure: {{STRUCTURE}}
- Accepted forms: {{ACCEPTED_FORMS}}
- Family: {{FAMILY}}

Same-family points (for "other grammar" answers below):

{{FAMILY_POINTS}}

## Current sentences

{{CURRENT_SENTENCES}}

Keep every sentence marked PASS unless the variety rules below force a change.
Replace or fix every sentence marked FAIL.

## Vocabulary you may use

Every content word must come from this list (particles and grammatical
endings are fine). Put the slug in [brackets] of **every** word you use —
pronouns (私, あなた) and この/その included — in that sentence's
`vocabulary_slugs`. The Build card lists exactly those words, so a word you
use but do not list is a word the learner cannot write.

{{ALLOWED_VOCAB}}

## Grammar you may use besides this point

{{EARLIER_GRAMMAR}}

## What to write

One JSON object:

- `accepted_meanings`: 3–6 short English answers a learner might type for this
  grammar's meaning, the clearest first ("because", "since", "so"). For a
  particle, name its job ("object marker").
- `sentences`: **8–10** sentences. For each:
  - `japanese`: plain Japanese, ≤ 30 characters, using **{{FORM}}** (one of
    the accepted forms) exactly once. No names of people or places, no
    numbers.
  - `english`: natural English.
  - `vocabulary_slugs`: every word used, from the list above.
  - `form` (only when the grammar's characters appear more than once in the
    sentence): the grammar with a little text in front, joined by `|`, e.g.
    `今日|は`.
  - `alternates`: other answers a learner could correctly type on the Build
    card, plain Japanese:
    - `"valid"` — same grammar, different but natural wording: another word
      order, without 私は/あなたは, the other accepted form.
    - `"other_grammar"` — the same sentence with a same-family point swapped
      in for this one (only swap the grammar; change nothing else).
    Give 0–3 alternates per sentence; only ones a learner would really type.
- Variety: no two sentences may use the same set of words, and the set must
  mix sentence types — at least two of: statement, question, negative, past.
- Short, everyday, concrete; a different situation in every sentence.
{{VALIDATOR_FEEDBACK}}
```

- [ ] **Step 4: Write the lane module**

```python
# curriculum/_build/generate_content/generate_pool.py
# -*- coding: utf-8 -*-
"""Grammar sentence pool content lane (single-session runbook:
docs/workflows/grammar-pool-single-session-workflow-automation-prompt.md).

    .venv/bin/python -m generate_content.generate_pool select --level n5 --limit 4
    .venv/bin/python -m generate_content.generate_pool webprompts --level n5 --slugs a,b
    .venv/bin/python -m generate_content.generate_pool ingest --level n5 --slug a --model <model>

Ingest builds the point exactly as generate.py would with the reply in the
sidecar, runs check_grammar_pool on it, and only then writes the sidecar.
"""

import argparse
import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import generate  # noqa: E402
from generate_content import check_grammar_pool as pool_check  # noqa: E402
from generate_content import context  # noqa: E402
from generate_content.generate_examples import _first_json_object  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web", "pool")
PROMPTS_DIR = os.path.join(HERE, "prompts")
PROMPT_VERSION = 1
KINDS = ("valid", "other_grammar")


def select_slugs(level, limit, sidecar):
    return [g["slug"] for g in context.load_grammar(level) if g["slug"] not in sidecar][:limit]


def reply_errors(reply):
    errors = []
    meanings = reply.get("accepted_meanings")
    if not (isinstance(meanings, list) and all(isinstance(m, str) and m for m in meanings)):
        errors.append("accepted_meanings must be a list of non-empty strings")
    sentences = reply.get("sentences")
    if not isinstance(sentences, list) or not sentences:
        return errors + ["sentences must be a non-empty list"]
    for i, s in enumerate(sentences):
        label = f"sentences[{i}]"
        for key in ("japanese", "english"):
            if not isinstance(s.get(key), str) or not s.get(key):
                errors.append(f"{label}: {key} must be a non-empty string")
        if not isinstance(s.get("vocabulary_slugs"), list):
            errors.append(f"{label}: vocabulary_slugs must be a list")
        if "form" in s and not (isinstance(s["form"], str) and s["form"]):
            errors.append(f"{label}: form must be a non-empty string when present")
        for j, alt in enumerate(s.get("alternates", [])):
            if not isinstance(alt.get("japanese"), str) or not alt.get("japanese"):
                errors.append(f"{label}.alternates[{j}]: japanese must be a non-empty string")
            if alt.get("kind") not in KINDS:
                errors.append(f"{label}.alternates[{j}]: kind must be one of {KINDS}")
    return errors


def merge_into_sidecar(path, slug, reply, model):
    entries = {}
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            entries = json.load(f)
    entries[slug] = {
        "accepted_meanings": reply["accepted_meanings"],
        "sentences": reply["sentences"],
        "_meta": {"generator_model": model, "prompt_version": str(PROMPT_VERSION),
                  "review_status": "draft"},
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _read(name):
    with open(os.path.join(PROMPTS_DIR, name), encoding="utf-8") as f:
        return f.read()


def _current_sentences(level, item):
    errors = pool_check.check_point(level, item)
    lines = []
    for s in item.get("example_sentences", []):
        own = [e for e in errors if e.startswith(s["japanese"] + " — ")]
        status = "FAIL: " + "; ".join(e.split(" — ", 1)[1] for e in own) if own else "PASS"
        lines.append(f"- {s['japanese']} — {s['english']} [{status}]")
    point = [e for e in errors if " — " not in e]
    return "\n".join(lines + [f"- (point) {e}" for e in point]) or "(none)"


def prompt_text(level, slug, validator_errors=None):
    grammar = context.load_grammar(level)
    item = next(g for g in grammar if g["slug"] == slug)
    family = [g for g in pool_check.grammar_through(level)
              if g["slug"] != slug and item.get("family") and g.get("family") == item.get("family")]
    earlier = [g for g in pool_check.grammar_through(level)
               if g["slug"] != slug and (g["sort_order"] < item["sort_order"] or g not in grammar)]
    feedback = ""
    if validator_errors:
        feedback = ("\n## Fix these errors from the last attempt\n\n"
                    + "\n".join(f"- {e}" for e in validator_errors) + "\n")
    body = (_read("grammar-pool.md")
            .replace("{{LEVEL}}", level.upper())
            .replace("{{FORM}}", item["primary_form"])
            .replace("{{MEANING}}", item["meaning"])
            .replace("{{STRUCTURE}}", item["structure"])
            .replace("{{ACCEPTED_FORMS}}", "、".join(item["accepted_forms"]))
            .replace("{{FAMILY}}", item.get("family") or "(none)")
            .replace("{{FAMILY_POINTS}}", context.format_grammar_list(family))
            .replace("{{CURRENT_SENTENCES}}", _current_sentences(level, item))
            .replace("{{ALLOWED_VOCAB}}",
                     context.format_vocab_list(context.allowed_vocab_for(level, slug)))
            .replace("{{EARLIER_GRAMMAR}}", context.format_grammar_list(earlier))
            .replace("{{VALIDATOR_FEEDBACK}}", feedback))
    header = (f"<!-- Grammar pool prompt for {level}/{slug}. Write the reply to "
              f"web/pool/{level}/{slug}.reply.md, then run:\n"
              f"  .venv/bin/python -m generate_content.generate_pool ingest "
              f"--level {level} --slug {slug} --model <model>\n-->\n\n")
    return (header + "# Teaching voice — follow this in everything you write below\n\n"
            + _read("persona.md").strip() + "\n\n---\n\n" + body.strip()
            + "\n\nReply with exactly one fenced ```json code block and nothing else.\n")


def _paths(level, slug):
    base = os.path.join(WEB_DIR, level)
    return os.path.join(base, f"{slug}.prompt.md"), os.path.join(base, f"{slug}.reply.md")


def cmd_select(args):
    slugs = select_slugs(args.level, args.limit, generate.load_pool_sidecar())
    print(f"{len(slugs)} point(s) selected:")
    print(",".join(slugs))


def cmd_webprompts(args):
    for slug in args.slugs.split(","):
        prompt_path, _ = _paths(args.level, slug)
        os.makedirs(os.path.dirname(prompt_path), exist_ok=True)
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_text(args.level, slug))
        print(f"wrote {prompt_path}")


def cmd_ingest(args):
    prompt_path, reply_path = _paths(args.level, args.slug)
    if not os.path.exists(reply_path):
        raise SystemExit(f"no reply at {reply_path}")
    with open(reply_path, encoding="utf-8") as f:
        reply = _first_json_object(f.read())
    errors = reply_errors(reply)
    if not errors:
        pool_entry = {"accepted_meanings": reply["accepted_meanings"],
                      "sentences": reply["sentences"]}
        try:
            item = generate.build_grammar_point(args.level, args.slug, pool_entry)
            errors = pool_check.check_point(args.level, item)
        except (ValueError, KeyError) as error:
            errors = [str(error)]
    if errors:
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(prompt_text(args.level, args.slug, errors))
        print(f"{args.slug}: {len(errors)} error(s) — NOT written:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)
    merge_into_sidecar(generate.POOL_SIDECAR, args.slug, reply, args.model)
    for path in (prompt_path, reply_path):
        os.remove(path)
    print(f"{args.slug}: PASS — merged into {generate.POOL_SIDECAR}")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("select")
    p.add_argument("--level", required=True, choices=context.LEVEL_ORDER)
    p.add_argument("--limit", type=int, default=4)
    p.set_defaults(func=cmd_select)
    p = sub.add_parser("webprompts")
    p.add_argument("--level", required=True, choices=context.LEVEL_ORDER)
    p.add_argument("--slugs", required=True)
    p.set_defaults(func=cmd_webprompts)
    p = sub.add_parser("ingest")
    p.add_argument("--level", required=True, choices=context.LEVEL_ORDER)
    p.add_argument("--slug", required=True)
    p.add_argument("--model", required=True)
    p.set_defaults(func=cmd_ingest)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
```

Note: `check_point` reads the *generated* `curriculum/grammar/<level>.json` for `allowed_vocab_for` and family forms; the candidate item itself comes from `build_grammar_point`, so ingest never depends on a regenerate.

- [ ] **Step 5: Run tests and a dry smoke run**

Run:

```bash
cd curriculum/_build
.venv/bin/python -m unittest generate_content.test_generate_pool -v
.venv/bin/python -m generate_content.generate_pool select --level n5 --limit 2
.venv/bin/python -m generate_content.generate_pool webprompts --level n5 --slugs wa-topic
sed -n 1,80p generate_content/web/pool/n5/wa-topic.prompt.md
rm generate_content/web/pool/n5/wa-topic.prompt.md
```

Expected: tests PASS; `select` prints 2 slugs starting with `wa-topic`; the prompt shows the persona, the point, current sentences each marked PASS/FAIL with reasons, the vocabulary list with slugs, and no `{{…}}` left.

- [ ] **Step 6: Commit**

```bash
git add curriculum/_build/generate_content/generate_pool.py curriculum/_build/generate_content/prompts/grammar-pool.md curriculum/_build/generate_content/test_generate_pool.py
git commit -m "Add grammar sentence pool content lane"
```

Check `curriculum/_build/generate_content/web/` is gitignored (`git check-ignore -v curriculum/_build/generate_content/web/pool/x`); if not, add `web/pool/` to the same `.gitignore` that covers `web/examples/`.

---

### Task 6: Runbook

**Files:**
- Create: `docs/workflows/grammar-pool-single-session-workflow-automation-prompt.md`
- Modify: `docs/workflows/README.md` (table row)

- [ ] **Step 1: Write the runbook**

```markdown
Task: Write the Grammar Sentence Pool — Single Session, No Subagents

Write the grammar review sentence pool (accepted meanings, ≥ 8 sentences,
Build-card alternates) for the next grammar points **entirely within this
session** — no subagents, no browser, no API credentials. Spec:
`docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` §4.
Run this same prompt again in a fresh session for the next batch.

Level (one per run): <level = n5>
Points this session (each point is ~10 sentences; keep batches small):
<point-count = 4>

Use a strong reasoning model at high effort. Pass this session's model name
as `--model` in Step 4.

---

Work from `curriculum/_build`.

Step 1: Select

.venv/bin/python -m generate_content.generate_pool select --level <level> --limit <point-count>

Use exactly the printed slugs. If it prints 0, the level is done — stop and
report.

Step 2: Prompts

.venv/bin/python -m generate_content.generate_pool webprompts --level <level> --slugs <slugs,comma,no,spaces>

Step 3: Draft every reply yourself

Read each `generate_content/web/pool/<level>/<slug>.prompt.md`. Everything
below its HTML comment header is the task; ignore the header. Write ONE reply
file per point, `generate_content/web/pool/<level>/<slug>.reply.md`,
containing exactly one fenced ```json block and nothing else:

{"accepted_meanings": ["…"], "sentences": [{"japanese": "…", "english": "…",
  "vocabulary_slugs": ["…"], "form": "…(optional)",
  "alternates": [{"japanese": "…", "kind": "valid"}]}]}

- Keep sentences the prompt marks PASS unless variety forces a change.
- Every word you use is in `vocabulary_slugs`, from that prompt's list.
- Plain Japanese only (no furigana, romaji, markdown, brackets).
- Make each point feel different; give the last point the same care as the
  first.
- Never set `review_status`. Edit only reply files.

Step 4: Ingest and repair, one point at a time

.venv/bin/python -m generate_content.generate_pool ingest --level <level> --slug <slug> --model <model>

On PASS the point is merged into `curriculum/grammar/pool.json` and its
prompt/reply files are deleted. On failure the prompt is rewritten with the
errors appended: edit only `<slug>.reply.md` to fix every error (smallest
change, keep passing sentences) and ingest again. Budget: 4 attempts per
point; after the 4th failure, record the point as skipped with its latest
errors and move on (it is selected again next session).

Never edit the validator, the lane code, the prompt template, the allowed
vocabulary, or curriculum source data to make content pass.

Step 5: Regenerate

.venv/bin/python generate.py --level <level>

Do not run validate-schema or compile-curriculum here; run them once from the
repo root after the last session.

Final report: level, selected slugs, passed / skipped (with errors), attempts
per point, how many points remain (re-run Step 1), and confirmation that
generate.py ran.
```

- [ ] **Step 2: README row**

In `docs/workflows/README.md`, add to the lanes table:

```
| Grammar sentence pool | — | — | [automation](./grammar-pool-single-session-workflow-automation-prompt.md) |
```

- [ ] **Step 3: Commit**

```bash
git add docs/workflows/grammar-pool-single-session-workflow-automation-prompt.md docs/workflows/README.md
git commit -m "Add grammar sentence pool single-session runbook"
```

---

### Task 7: Run the lane, then make the validator a hard gate

**Files:**
- Content: `curriculum/grammar/pool.json`, regenerated `curriculum/grammar/*.json`
- Modify: `curriculum/_build/generate.py` — `generate_level` (gate)
- Modify: `curriculum/_build/generate_content/check_grammar_pool.py` — `VARIETY_EXEMPT` (only if needed)
- Create: `curriculum/_build/reports/grammar-pool-final.md`
- Modify: `docs/working-history.md`, spec Status line
- Test: `curriculum/_build/generate_content/test_generate_grammar_level.py`

- [ ] **Step 1: Run the lane until select prints 0**

Run the Task 6 runbook in fresh sessions, N5 first, then N4 (161 points ÷ 4 ≈ 41 sessions; larger `<point-count>` is fine if sessions stay focused). Commit `curriculum/grammar/pool.json` and the regenerated JSON after each session:

```bash
git add curriculum/grammar/pool.json curriculum/grammar/n5.json curriculum/grammar/n4.json
git commit -m "Grammar pool: <level> <slugs>"
```

A point that cannot reach two sentence shapes (for example a form that is never negative or past) goes into `VARIETY_EXEMPT` with a one-line reason comment, in its own commit — never to unblock a point that simply has weak sentences.

- [ ] **Step 2: Confirm the whole pool passes**

Run: `cd curriculum/_build && .venv/bin/python -m generate_content.check_grammar_pool --report reports/grammar-pool-final.md; echo "exit $?"`
Expected: `exit 0`, `74/74` and `87/87`.

- [ ] **Step 3: Write the failing gate test**

```python
    def test_generate_level_refuses_a_failing_pool(self):
        from unittest import mock
        with mock.patch.object(generate.pool_check, "check_level",
                               return_value={"kara-because": ["rule 4: 2 passing sentences, need 8"]}), \
             mock.patch.object(generate, "write_json"):
            with self.assertRaises(SystemExit) as raised:
                generate.generate_level("n5")
        self.assertIn("kara-because", str(raised.exception))
```

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level -v`
Expected: FAIL — `generate` has no attribute `pool_check` / no SystemExit.

- [ ] **Step 4: Add the gate**

In `generate.py`, import `from generate_content import check_grammar_pool as pool_check  # noqa: E402`. In `generate_level`, directly after `write_json(...)` for `curriculum/grammar/<level>.json`:

```python
    # Grammar Read + Build cards need every point's pool to pass (spec §4.4).
    failing = {slug: errs for slug, errs in pool_check.check_level(level).items() if errs}
    if failing:
        lines = [f"{slug}: {errs[0]}" for slug, errs in failing.items()]
        raise SystemExit(
            f"{level.upper()} grammar pool fails for {len(failing)} point(s) — run "
            "generate_content.check_grammar_pool for the full report:\n" + "\n".join(lines)
        )
```

Run the test again — expected PASS. Then `.venv/bin/python generate.py --level n5 && .venv/bin/python generate.py --level n4` — expected success.

- [ ] **Step 5: Validate, compile, run every suite**

```bash
cd ../.. && npm run validate-schema && npm run compile-curriculum
cd curriculum/_build && .venv/bin/python -m unittest discover -s generate_content -p "test_*.py" -v
cd ../.. && npx jest --config jest.config.cjs scripts/
cd mobile && npx jest src/data src/core/grammar
```

Expected: all succeed / PASS.

- [ ] **Step 6: Status docs and commit**

`docs/working-history.md` spec row: `Partial — Plans 1–2 done <date>: every N5/N4 grammar point has a passing pool (curriculum/grammar/pool.json, report curriculum/_build/reports/grammar-pool-final.md); generate.py gates on it. Plan 3 (app) not started`. Spec Status: `Plans 1–2 done; Plan 3 not started`.

```bash
git lfs install
git add curriculum/_build/generate.py curriculum/_build/generate_content/test_generate_grammar_level.py curriculum/_build/generate_content/check_grammar_pool.py curriculum/_build/reports/grammar-pool-final.md curriculum/grammar/ curriculum/metadata.json mobile/assets/curriculum-seed/ docs/working-history.md docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md
git commit -m "Gate generate.py on the grammar sentence pool; compile full pool"
```

---

## Self-review notes

- Plan 1 review I5 → Task 1; anchor (user decision) → Task 2; pronouns optional + I4 (user decision) → Task 3; wrong-sense links → Tasks 4–5 (pool sentences use authored slugs only; derived links are no longer used for points with a sidecar entry).
- Spec §4.1 source 3 + §4.3 → Tasks 4–7. §4.4 hard gate → Task 7.
- Deferred minors from the Plan 1 report (non-BMP offsets, empty word sets, schema scope) stay deferred: no real content hits them.
