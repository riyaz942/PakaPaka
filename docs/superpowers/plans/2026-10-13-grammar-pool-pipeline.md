# Grammar Sentence Pool — Pipeline (Plan 1 of 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the curriculum pipeline produce, check and compile everything the new grammar Read + Build cards need — without changing app behaviour yet.

**Architecture:** Pure derivation helpers (grammar span, register, sentence shape, cloze filling, uncovered words) live in one new Python module. `generate.py` uses them to add new fields to every grammar example sentence and to turn filled cloze variants into extra example sentences. A new report-only validator (`check_grammar_pool`) applies the spec's rules 1–7 and writes a baseline report; it becomes a compile gate only at the end of Plan 2. `compile-curriculum.ts` stores the new fields in additive columns and one new table. Everything here is additive: the app keeps reading `grammar_cloze_variants` until Plan 3.

**Tech Stack:** Python 3.12 + fugashi/unidic-lite (`curriculum/_build/.venv`), stdlib `unittest`; TypeScript + better-sqlite3 + jest (`scripts/`), JSON Schema (`curriculum/schema/curriculum.schema.json`).

**Spec:** `docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` (§4 Content, §5.1 `curriculum.db`)

**Plan series:** Plan 1 — pipeline (this). Plan 2 — content lane (meanings, sentences, alternates until the validator passes; then the validator becomes a hard gate). Plan 3 — app (cards, queue, grading, migration 021; drops `grammar_cloze_variants`).

## Global Constraints

- Never write to `curriculum.db` at runtime; it is a compile output only.
- Word spans and grammar spans use the same offset convention as `generate_content/spans.py` (Python string indices over `japanese`), and compile re-checks them by slicing.
- `curriculum.db` is Git LFS: commit `mobile/assets/curriculum-seed/curriculum.db` after `git lfs install`.
- `metadata.json` `version` is raised by `npm run compile-curriculum`; never edit it by hand.
- Python tests use stdlib `unittest` (no new dependency). Run from `curriculum/_build` with `.venv/bin/python -m unittest …`.
- Range rule = existing `generate_content/context.allowed_vocab_for` + `level_check.find_violations` (spec D10). Do not add a new range rule.
- Minimum pool size: **8** sentences per grammar point (spec D8). Accepted meanings: **≥ 3** per point (spec §4.4 rule 7).
- `build_alternates[].kind` ∈ `valid` | `other_grammar` (spec §4.3).
- Do not remove `cloze_variants`, `check_cloze.py`, or the `grammar_cloze_variants` table in this plan.

## Review Focus

1. **A grammar form that also appears inside another word** (は in こんにちは, で in でも) — the grammar span must pick the authored `form` when given; `grammar_span` must fail loudly (build error) when an authored `form` is not in the sentence. Test in Task 1 + Task 2.
2. **Discontinuous accepted forms with `〜`** (まだ〜ていない) — must be skipped, never matched literally. Test in Task 1.
3. **A cloze variant whose filled sentence already exists as an example** — must not be added twice. Test in Task 1.
4. **Katakana words and pronouns in a Build sentence** (コート, 私) — must count as content words that need a word span (a learner cannot type a word that is not in the list). Test in Task 1.
5. **A furigana alternate that is not parseable or drops a listed word** — the validator must flag it, not crash. Test in Task 3.

---

## File structure

| File | Responsibility |
|------|----------------|
| `curriculum/_build/generate_content/grammar_sentences.py` (new) | Pure derivation: `grammar_span`, `register_of`, `sentence_shape`, `fill_cloze`, `cloze_examples`, `uncovered_content_words` |
| `curriculum/_build/generate_content/test_grammar_sentences.py` (new) | Unit tests for the module above |
| `curriculum/_build/n5_grammar.py`, `n4_grammar.py` | `ex()` gains `form=` and `alts=` keywords and returns a dict |
| `curriculum/_build/generate.py` | Writes `grammar_span`, `register`, `build_alternates` on grammar examples; appends cloze-derived examples; writes grammar `accepted_answers` from `accepted_meanings` |
| `curriculum/_build/generate_content/test_generate_grammar_level.py` (new) | Tests for the `generate.py` grammar builder |
| `curriculum/_build/generate_content/check_grammar_pool.py` (new) | Validator rules 1–7, report-only CLI |
| `curriculum/_build/generate_content/test_check_grammar_pool.py` (new) | Unit tests for the validator |
| `curriculum/schema/curriculum.schema.json` | New optional fields on `exampleSentence` and `grammarItem` |
| `scripts/curriculum-schema.ts` | DDL: 3 columns on `example_sentences`, new `grammar_sentence_answers` |
| `scripts/compile-curriculum.ts` | Insert the new fields; grammar `accepted_answers` |
| `scripts/compile-curriculum.test.ts`, `scripts/__fixtures__/valid/grammar/n5.json` | Compile tests + fixture |
| `curriculum/_build/reports/grammar-pool-baseline.md` (generated) | Baseline validator report for Plan 2 |

---

### Task 1: Derivation helpers

**Files:**
- Create: `curriculum/_build/generate_content/grammar_sentences.py`
- Test: `curriculum/_build/generate_content/test_grammar_sentences.py`

**Interfaces:**
- Consumes: `generate_content.spans.tokens_with_offsets(text) -> list[dict]` (keys `surface,start,end,pos1,pos2,lemma,…`).
- Produces:
  - `CLOZE_BLANK = "＿＿＿"`
  - `BUILD_CONTENT_POS: frozenset[str]`
  - `grammar_span(japanese: str, accepted_forms: list[str], form: str | None = None) -> dict | None` — `{"start": int, "end": int}`; raises `ValueError` when `form` is given and not found
  - `register_of(japanese: str) -> str` — `"polite"` or `"plain"`
  - `sentence_shape(japanese: str) -> tuple[bool, bool, bool]` — `(question, negative, past)`
  - `fill_cloze(jp_cloze: str, answer: str) -> str | None`
  - `cloze_examples(cloze_variants: list[dict], existing_japanese: set[str]) -> list[dict]` — each `{"jp", "en", "form"}`
  - `uncovered_content_words(japanese: str, word_spans: list[dict], span: dict | None) -> list[str]`

- [ ] **Step 1: Write the failing tests**

```python
# curriculum/_build/generate_content/test_grammar_sentences.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import grammar_sentences as gs  # noqa: E402


class GrammarSpanTest(unittest.TestCase):
    def test_longest_accepted_form_wins(self):
        self.assertEqual(
            gs.grammar_span("私は学生ですから。", ["から", "ですから"]),
            {"start": 4, "end": 8},
        )

    def test_authored_form_beats_search(self):
        # は inside こんにちは must not be picked when the author names the
        # topic は after 今日.
        self.assertEqual(
            gs.grammar_span("こんにちは、今日は寒いです。", ["は"], form="今日は"),
            {"start": 6, "end": 9},
        )

    def test_authored_form_missing_raises(self):
        with self.assertRaises(ValueError):
            gs.grammar_span("寒いです。", ["から"], form="から")

    def test_tilde_forms_are_skipped(self):
        self.assertEqual(
            gs.grammar_span("まだ食べていません。", ["まだ〜ていません", "ていません"]),
            {"start": 4, "end": 9},
        )

    def test_no_form_found_returns_none(self):
        self.assertIsNone(gs.grammar_span("寒いです。", ["から"]))


class RegisterTest(unittest.TestCase):
    def test_masu_is_polite(self):
        self.assertEqual(gs.register_of("寒いから、コートを着ます。"), "polite")

    def test_desu_before_final_particle_is_polite(self):
        self.assertEqual(gs.register_of("私は学生ですから。"), "polite")

    def test_negative_polite(self):
        self.assertEqual(gs.register_of("学生じゃありません。"), "polite")

    def test_plain(self):
        self.assertEqual(gs.register_of("今日は寒いから。"), "plain")
        self.assertEqual(gs.register_of("学生じゃない。"), "plain")


class ShapeTest(unittest.TestCase):
    def test_shapes(self):
        self.assertEqual(gs.sentence_shape("寒いですか？"), (True, False, False))
        self.assertEqual(gs.sentence_shape("行きません。"), (False, True, False))
        self.assertEqual(gs.sentence_shape("行かなかった。"), (False, True, True))
        self.assertEqual(gs.sentence_shape("お金がない。"), (False, True, False))
        self.assertEqual(gs.sentence_shape("昨日は休みでした。"), (False, False, True))


class ClozeTest(unittest.TestCase):
    def test_fill(self):
        self.assertEqual(gs.fill_cloze("今日は寒い＿＿＿。", "から"), "今日は寒いから。")

    def test_fill_without_blank_is_none(self):
        self.assertIsNone(gs.fill_cloze("今日は寒い。", "から"))

    def test_cloze_examples_dedupe_and_keep_form(self):
        variants = [
            {"jp_cloze": "今日は寒い＿＿＿。", "english": "Because it's cold today.", "answer": "から"},
            {"jp_cloze": "寒い＿＿＿、行きません。", "english": "dup", "answer": "から"},
            {"jp_cloze": "今日は寒い＿＿＿。", "english": "same twice", "answer": "から"},
        ]
        self.assertEqual(
            gs.cloze_examples(variants, existing_japanese={"寒いから、行きません。"}),
            [{"jp": "今日は寒いから。", "en": "Because it's cold today.", "form": "から"}],
        )


class UncoveredTest(unittest.TestCase):
    def test_katakana_and_pronoun_need_spans(self):
        text = "私は寒いから、コートを着ます。"
        spans = [{"vocabulary_slug": "samui", "start": 2, "end": 4}]
        grammar = {"start": 4, "end": 6}
        self.assertEqual(
            gs.uncovered_content_words(text, spans, grammar), ["私", "コート", "着"]
        )

    def test_everything_covered(self):
        text = "寒いから、コートを着ます。"
        spans = [
            {"vocabulary_slug": "samui", "start": 0, "end": 2},
            {"vocabulary_slug": "kooto", "start": 5, "end": 8},
            {"vocabulary_slug": "kiru", "start": 9, "end": 12},
        ]
        self.assertEqual(gs.uncovered_content_words(text, spans, {"start": 2, "end": 4}), [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_sentences -v`
Expected: FAIL / ERROR — `ImportError: cannot import name 'grammar_sentences'`.

- [ ] **Step 3: Write the module**

```python
# curriculum/_build/generate_content/grammar_sentences.py
# -*- coding: utf-8 -*-
"""Derived fields for the grammar sentence pool (grammar Read + Build cards).

Spec: docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md §4.2.
Everything here is derived from the sentence text — nothing is authored except
an optional `form` (which occurrence of the grammar to highlight).

Offsets follow generate_content/spans.py: Python string indices into the
`japanese` string, re-checked by compile-curriculum by slicing.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import spans as spans_lib  # noqa: E402

CLOZE_BLANK = "＿＿＿"

#: POS that make a token a word the learner must be given on the Build card.
#: Wider than level_check.CONTENT_POS on purpose: pronouns (私) and adnominals
#: (この) are "function words" for the level check but still words a learner
#: has to know to write the sentence.
BUILD_CONTENT_POS = frozenset({"名詞", "動詞", "形容詞", "形状詞", "副詞", "代名詞", "連体詞"})

_POLITE_AUX = {"です", "ます"}
_NEGATIVE_AUX = {"ない", "ず"}
_SYMBOL_POS = {"補助記号", "空白"}


def grammar_span(japanese, accepted_forms, form=None):
    """Where the grammar sits in `japanese`, for the Read-card highlight.

    `form` is the authored chunk (a cloze answer, or a disambiguating chunk
    like 今日は); when given it must be present. Otherwise the longest
    contiguous accepted form wins, first occurrence. Forms containing 〜 are
    discontinuous and never matched literally."""
    if form is not None:
        start = japanese.find(form)
        if start < 0:
            raise ValueError(f"grammar form {form!r} not found in {japanese!r}")
        return {"start": start, "end": start + len(form)}
    candidates = sorted(
        (f for f in accepted_forms if f and "〜" not in f), key=len, reverse=True
    )
    for candidate in candidates:
        start = japanese.find(candidate)
        if start >= 0:
            return {"start": start, "end": start + len(candidate)}
    return None


def _tokens(japanese):
    return spans_lib.tokens_with_offsets(japanese)


def register_of(japanese):
    """'polite' when a です/ます auxiliary follows the last content word."""
    tokens = [t for t in _tokens(japanese) if t["pos1"] not in _SYMBOL_POS]
    last_content = -1
    for i, token in enumerate(tokens):
        if token["pos1"] in BUILD_CONTENT_POS:
            last_content = i
    tail = tokens[last_content + 1 :]
    if any(t["pos1"] == "助動詞" and t["lemma"] in _POLITE_AUX for t in tail):
        return "polite"
    return "plain"


def sentence_shape(japanese):
    """(question, negative, past) — the variety rule's sentence types."""
    tokens = _tokens(japanese)
    words = [t for t in tokens if t["pos1"] not in _SYMBOL_POS]
    question = "？" in japanese or "?" in japanese or (
        bool(words) and words[-1]["pos1"] == "助詞" and words[-1]["surface"] == "か"
    )
    negative = any(
        (t["pos1"] == "助動詞" and t["lemma"] in _NEGATIVE_AUX)
        or (t["pos1"] == "形容詞" and t["lemma"] == "無い")
        for t in tokens
    )
    past = any(t["pos1"] == "助動詞" and t["lemma"] == "た" for t in tokens)
    return (question, negative, past)


def fill_cloze(jp_cloze, answer):
    if CLOZE_BLANK not in jp_cloze or not answer:
        return None
    return jp_cloze.replace(CLOZE_BLANK, answer, 1)


def cloze_examples(cloze_variants, existing_japanese):
    """Filled cloze variants as example dicts, skipping any sentence already
    present (in `existing_japanese` or earlier in the list)."""
    seen = set(existing_japanese)
    out = []
    for variant in cloze_variants:
        jp = fill_cloze(variant["jp_cloze"], variant["answer"])
        if jp is None or jp in seen:
            continue
        seen.add(jp)
        out.append({"jp": jp, "en": variant["english"], "form": variant["answer"]})
    return out


def _inside(token, span):
    return span["start"] <= token["start"] and token["end"] <= span["end"]


def uncovered_content_words(japanese, word_spans, span):
    """Content tokens outside the grammar span and outside every word span —
    words a Build-card learner would have to produce without being shown."""
    covers = list(word_spans) + ([span] if span else [])
    return [
        t["surface"]
        for t in _tokens(japanese)
        if t["pos1"] in BUILD_CONTENT_POS and not any(_inside(t, c) for c in covers)
    ]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_sentences -v`
Expected: all tests PASS. If a tokenizer-dependent assertion fails (`register_of`, `sentence_shape`, `uncovered_content_words`), print `spans_lib.tokens_with_offsets(text)` for that sentence and fix the rule, not the expectation — the expectations are the spec.

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate_content/grammar_sentences.py curriculum/_build/generate_content/test_grammar_sentences.py
git commit -m "Add grammar sentence pool derivation helpers"
```

---

### Task 2: Generate the new fields

**Files:**
- Modify: `curriculum/_build/n5_grammar.py:15-16` (`ex`), `curriculum/_build/n4_grammar.py:13-14` (`ex`)
- Modify: `curriculum/_build/generate.py` — `_build_grammar_level` (≈ lines 487–578) and `generate_level` (≈ 845–851)
- Test: `curriculum/_build/generate_content/test_generate_grammar_level.py`

**Interfaces:**
- Consumes: Task 1 functions; `spans_lib.derive_spans(text, forms_by_slug)`; `furigana_lib.annotate_sentence(text, known_readings)`.
- Produces (grammar JSON, per grammar item):
  - `accepted_answers: [{"answer_type": "meaning", "answer_text": str, "is_primary": bool}]` — from the source key `accepted_meanings: list[str]`
  - per example sentence: `grammar_span: {"start", "end"}` (absent when not found), `register: "polite" | "plain"`, `build_alternates: [{"furigana": str, "kind": "valid" | "other_grammar"}]` (absent when none)
  - extra example sentences from filled `cloze_variants`, after the authored ones, with derived `vocabulary_slugs`
- Source format (Plan 2 authors against it): `ex(jp, en, vocab=None, *, form=None, alts=None)` where `alts` is `[(furigana, kind), …]`.
- `_build_grammar_level(jlpt_level, grammar_entries, vocab_forms, known_readings=None, all_grammar_slugs=(), known_vocab_forms=None)` — new last keyword.

- [ ] **Step 1: Write the failing test**

```python
# curriculum/_build/generate_content/test_generate_grammar_level.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import generate  # noqa: E402

VOCAB = {"samui": "寒い", "kooto": "コート", "kiru-wear": "着る", "kyou": "今日"}


def entry(**overrides):
    base = {
        "slug": "zz-test-kara",  # no lesson file exists for this slug
        "primary_form": "から",
        "meaning": "because (reason)",
        "structure": "Clause + から",
        "conjugation_rules": {"reason": True},
        "accepted_forms": ["から", "ですから"],
        "examples": [
            generate_ex("寒いから、コートを着ます。", "Because it's cold, I'll wear a coat.",
                        ["samui", "kooto", "kiru-wear"],
                        alts=[("寒[さむ]いですから、コートを着[き]ます。", "valid"),
                              ("寒[さむ]いので、コートを着[き]ます。", "other_grammar")]),
        ],
        "vocabulary_slugs": ["samui"],
        "family": "connectors",
        "accepted_meanings": ["because", "since", "so"],
        "cloze_variants": [
            {"jp_cloze": "今日は寒い＿＿＿。", "english": "Because it's cold today.",
             "answer": "から", "nudge": "n"},
            {"jp_cloze": "寒い＿＿＿、コートを着ます。", "english": "dup", "answer": "から",
             "nudge": "n"},
        ],
    }
    base.update(overrides)
    return base


def generate_ex(jp, en, vocab=None, **kw):
    from n5_grammar import ex
    return ex(jp, en, vocab, **kw)


def build(entries):
    return generate._build_grammar_level(
        "N5", entries, VOCAB, None, (), known_vocab_forms=VOCAB
    )["items"][0]


class GrammarLevelTest(unittest.TestCase):
    def test_accepted_meanings_become_accepted_answers(self):
        item = build([entry()])
        self.assertEqual(item["accepted_answers"], [
            {"answer_type": "meaning", "answer_text": "because", "is_primary": True},
            {"answer_type": "meaning", "answer_text": "since", "is_primary": False},
            {"answer_type": "meaning", "answer_text": "so", "is_primary": False},
        ])

    def test_authored_example_gets_span_register_alternates(self):
        first = build([entry()])["example_sentences"][0]
        self.assertEqual(first["grammar_span"], {"start": 2, "end": 4})
        self.assertEqual(first["register"], "polite")
        self.assertEqual(first["build_alternates"], [
            {"furigana": "寒[さむ]いですから、コートを着[き]ます。", "kind": "valid"},
            {"furigana": "寒[さむ]いので、コートを着[き]ます。", "kind": "other_grammar"},
        ])

    def test_cloze_variants_become_examples_once(self):
        sentences = build([entry()])["example_sentences"]
        self.assertEqual([s["japanese"] for s in sentences],
                         ["寒いから、コートを着ます。", "今日は寒いから。"])
        cloze = sentences[1]
        self.assertEqual(cloze["sort_order"], 1)
        self.assertEqual(cloze["grammar_span"], {"start": 5, "end": 7})
        self.assertEqual(cloze["register"], "plain")
        self.assertEqual(cloze["vocabulary_slugs"], ["kyou", "samui"])
        self.assertNotIn("build_alternates", cloze)

    def test_missing_authored_form_is_a_build_error(self):
        bad = entry(examples=[generate_ex("寒いです。", "It's cold.", ["samui"], form="から")],
                    cloze_variants=[])
        with self.assertRaises(ValueError):
            build([bad])

    def test_cloze_variants_still_ship(self):
        self.assertEqual(len(build([entry()])["cloze_variants"]), 2)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level -v`
Expected: FAIL / ERROR — `ex()` got an unexpected keyword argument `alts`; `_build_grammar_level` got an unexpected keyword argument `known_vocab_forms`.

- [ ] **Step 3: Change `ex()` in both source files**

In `curriculum/_build/n5_grammar.py` and `curriculum/_build/n4_grammar.py`, replace

```python
def ex(jp, en, vocab=None):
    return (jp, en, vocab or [])
```

with

```python
def ex(jp, en, vocab=None, *, form=None, alts=None):
    """One example sentence. `form` names the grammar chunk to highlight when
    the accepted forms alone are ambiguous; `alts` lists other Build-card
    answers as (furigana, kind) with kind "valid" or "other_grammar"."""
    return {"jp": jp, "en": en, "vocab": vocab or [], "form": form, "alts": alts or []}
```

Also extend the module docstring line in `n5_grammar.py` that lists entry keys: after `family (str),` add `accepted_meanings (list[str]),`.

- [ ] **Step 4: Update `generate.py`**

Add the import next to the other `generate_content` imports (≈ line 45):

```python
from generate_content import grammar_sentences as grammar_sentences_lib  # noqa: E402
```

Add this helper directly above `_build_grammar_level`:

```python
def _grammar_example(example, sort_order, g, vocab_forms, known_readings, errors):
    """One grammar example sentence with the Read/Build card fields
    (docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md §4.2)."""
    jp, vslugs = example["jp"], example["vocab"]
    for vs in vslugs:
        if vs not in vocab_forms:
            errors.append(f"grammar {g['slug']} example {sort_order} references unknown vocab '{vs}'")
    sentence = {
        "japanese": jp,
        "english": example["en"],
        "sort_order": sort_order,
        "vocabulary_slugs": vslugs,
    }
    sentence_furigana = furigana_lib.annotate_sentence(jp, known_readings)
    if sentence_furigana:
        sentence["furigana"] = sentence_furigana
    word_spans = _example_word_spans(jp, vslugs, vocab_forms)
    if word_spans:
        sentence["word_spans"] = word_spans
    try:
        span = grammar_sentences_lib.grammar_span(jp, g["accepted_forms"], example.get("form"))
    except ValueError as error:
        errors.append(f"grammar {g['slug']} example {sort_order}: {error}")
        span = None
    if span:
        sentence["grammar_span"] = span
    sentence["register"] = grammar_sentences_lib.register_of(jp)
    if example.get("alts"):
        sentence["build_alternates"] = [
            {"furigana": furigana, "kind": kind} for furigana, kind in example["alts"]
        ]
    return sentence


def _cloze_derived_examples(g, known_vocab_forms):
    """Filled cloze variants as extra pool sentences (spec §4.1 source 2).
    Their vocabulary links are derived from the level's taught words, the
    same way a passage links every word it contains."""
    derived = []
    existing = {e["jp"] for e in g["examples"]}
    for example in grammar_sentences_lib.cloze_examples(g.get("cloze_variants", []), existing):
        slugs = []
        for span in spans_lib.derive_spans(example["jp"], known_vocab_forms):
            if span["vocabulary_slug"] not in slugs:
                slugs.append(span["vocabulary_slug"])
        derived.append({**example, "vocab": slugs, "alts": []})
    return derived
```

In `_build_grammar_level`, change the signature to

```python
def _build_grammar_level(jlpt_level, grammar_entries, vocab_forms, known_readings=None,
                         all_grammar_slugs=(), known_vocab_forms=None):
```

and replace the whole `example_sentences = [] … example_sentences.append(sentence)` block (the `for j, (jp, en, vslugs) in enumerate(g["examples"]):` loop) with

```python
        examples = list(g["examples"]) + _cloze_derived_examples(g, known_vocab_forms or {})
        example_sentences = [
            _grammar_example(example, j, g, vocab_forms, known_readings, errors)
            for j, example in enumerate(examples)
        ]
```

After `if "family" in g: item["family"] = g["family"]`, add

```python
        if g.get("accepted_meanings"):
            item["accepted_answers"] = [
                {"answer_type": "meaning", "answer_text": meaning, "is_primary": index == 0}
                for index, meaning in enumerate(g["accepted_meanings"])
            ]
```

In `generate_level`, pass the level's taught words to the grammar builder:

```python
        _build_grammar_level(level.upper(), grammar_by_level[level], all_vocab_forms,
                             known_readings, all_grammar_slugs,
                             known_vocab_forms={v["slug"]: v["form"] for v in known}),
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level generate_content.test_grammar_sentences -v`
Expected: PASS. Derived `vocabulary_slugs` are in text order (`今日` before `寒い`).

- [ ] **Step 6: Commit**

```bash
git add curriculum/_build/n5_grammar.py curriculum/_build/n4_grammar.py curriculum/_build/generate.py curriculum/_build/generate_content/test_generate_grammar_level.py
git commit -m "Generate grammar pool fields and cloze-derived example sentences"
```

---

### Task 3: Pool validator (report-only)

**Files:**
- Create: `curriculum/_build/generate_content/check_grammar_pool.py`
- Test: `curriculum/_build/generate_content/test_check_grammar_pool.py`

**Interfaces:**
- Consumes: Task 1 functions; `level_check.build_allowed_index`, `level_check.find_violations`; `context.load_grammar(level)`, `context.allowed_vocab_for(level, slug)`; `spans_lib.derive_spans`; `furigana_lib.strip_furigana`.
- Produces:
  - `MIN_SENTENCES = 8`, `MIN_MEANINGS = 3`, `VARIETY_EXEMPT: set[str]` (empty; Plan 2 adds slugs with a one-line reason each)
  - `sentence_errors(sentence: dict, item: dict, allowed_index: set, other_family_forms: list[str], vocab_forms: dict) -> list[str]`
  - `point_errors(item: dict, allowed_index: set, other_family_forms: list[str], vocab_forms: dict) -> list[str]`
  - CLI: `.venv/bin/python -m generate_content.check_grammar_pool [--level n5|n4] [--report PATH]` — exit 1 when any point has errors.

Rules (spec §4.4): 1 grammar span present; 2 no uncovered content words; 3 no out-of-range words; 4 ≥ 8 passing sentences; 5 no two passing sentences with the same vocabulary set, and ≥ 2 distinct `sentence_shape` values unless exempt; 6 every alternate parses and contains every linked word, `valid` contains the grammar chunk, `other_grammar` contains a same-family form; 7 ≥ 3 meanings.

- [ ] **Step 1: Write the failing tests**

```python
# curriculum/_build/generate_content/test_check_grammar_pool.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import check_grammar_pool as pool  # noqa: E402

VOCAB = {"samui": "寒い", "kooto": "コート", "kiru-wear": "着る", "atsui": "暑い",
         "mizu": "水", "nomu": "飲む", "kyou": "今日", "iku": "行く"}
ALLOWED = {"寒い", "コート", "着る", "暑い", "水", "飲む", "今日", "行く"}
OTHER = ["ので", "けど"]


def sentence(jp, spans, grammar, register="polite", alts=None):
    s = {"japanese": jp, "english": "x", "word_spans": spans, "register": register,
         "vocabulary_slugs": [sp["vocabulary_slug"] for sp in spans]}
    if grammar:
        s["grammar_span"] = grammar
    if alts:
        s["build_alternates"] = alts
    return s


GOOD = sentence(
    "寒いから、コートを着ます。",
    [{"vocabulary_slug": "samui", "start": 0, "end": 2},
     {"vocabulary_slug": "kooto", "start": 5, "end": 8},
     {"vocabulary_slug": "kiru-wear", "start": 9, "end": 12, "inflection": "masu"}],
    {"start": 2, "end": 4},
)


def item(sentences, meanings=("because", "since", "so"), slug="kara"):
    return {"slug": slug, "accepted_forms": ["から"],
            "accepted_answers": [{"answer_type": "meaning", "answer_text": m} for m in meanings],
            "example_sentences": sentences}


class SentenceRulesTest(unittest.TestCase):
    def errors(self, s):
        return pool.sentence_errors(s, item([s]), ALLOWED, OTHER, VOCAB)

    def test_good_sentence(self):
        self.assertEqual(self.errors(GOOD), [])

    def test_rule1_missing_grammar_span(self):
        s = dict(GOOD)
        del s["grammar_span"]
        self.assertTrue(any("rule 1" in e for e in self.errors(s)))

    def test_rule2_uncovered_word(self):
        s = dict(GOOD, word_spans=GOOD["word_spans"][:2])
        self.assertTrue(any("rule 2" in e and "着" in e for e in self.errors(s)))

    def test_rule3_out_of_range_word(self):
        s = sentence("寒いから、帽子を被ります。",
                     [{"vocabulary_slug": "samui", "start": 0, "end": 2}], {"start": 2, "end": 4})
        self.assertTrue(any("rule 3" in e for e in self.errors(s)))

    def test_rule6_alternates(self):
        s = dict(GOOD, build_alternates=[
            {"furigana": "寒[さむ]いですから、コートを着[き]ます。", "kind": "valid"},
            {"furigana": "寒[さむ]いので、コートを着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ]いので、着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ]いので、コートを着[き]ます。", "kind": "valid"},
            {"furigana": "寒[さむ]いから、コートを着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ", "kind": "valid"},
        ])
        errors = [e for e in self.errors(s) if "rule 6" in e]
        # alt 3 drops コート; alt 4 lacks から; alt 5 has no other-grammar form;
        # alt 6 does not parse.
        self.assertEqual(len(errors), 4)


class PointRulesTest(unittest.TestCase):
    def test_rule4_too_few_sentences(self):
        errors = pool.point_errors(item([GOOD]), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 4" in e for e in errors))

    def test_rule5_same_vocab_set(self):
        twin = dict(GOOD, japanese="寒いから、コートを着ます！")
        errors = pool.point_errors(item([GOOD, twin]), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 5" in e and "same words" in e for e in errors))

    def test_rule5_one_shape_only(self):
        errors = pool.point_errors(item([GOOD]), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 5" in e and "shape" in e for e in errors))

    def test_rule5_exempt(self):
        pool.VARIETY_EXEMPT.add("kara")
        try:
            errors = pool.point_errors(item([GOOD]), ALLOWED, OTHER, VOCAB)
            self.assertFalse(any("rule 5" in e and "shape" in e for e in errors))
        finally:
            pool.VARIETY_EXEMPT.discard("kara")

    def test_rule7_meanings(self):
        errors = pool.point_errors(item([GOOD], meanings=("because",)), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 7" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_check_grammar_pool -v`
Expected: ERROR — `cannot import name 'check_grammar_pool'`.

- [ ] **Step 3: Write the validator**

```python
# curriculum/_build/generate_content/check_grammar_pool.py
# -*- coding: utf-8 -*-
"""Grammar sentence-pool gate (grammar Read + Build cards).

Spec: docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md §4.4.
Report-only until Plan 2 finishes the content; then generate/compile run it as
a hard gate. Run after generate.py:

    .venv/bin/python -m generate_content.check_grammar_pool
    .venv/bin/python -m generate_content.check_grammar_pool --level n5 --report reports/grammar-pool-baseline.md
"""

import argparse
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import context, level_check  # noqa: E402
from generate_content import grammar_sentences as gs  # noqa: E402
from generate_content import spans as spans_lib  # noqa: E402

MIN_SENTENCES = 8
MIN_MEANINGS = 3

#: Points whose grammar cannot take ≥ 2 sentence shapes (e.g. a form that is
#: never negative or past). One slug per line, each with a one-line reason.
VARIETY_EXEMPT = set()


def _parse_alternate(furigana):
    """Plain text of a furigana alternate, or None when the brackets don't
    balance (an unclosed 寒[さむ)."""
    if furigana.count("[") != furigana.count("]"):
        return None
    plain = furigana_lib.strip_furigana(furigana)
    return None if "[" in plain or "]" in plain else plain


def _alternate_errors(sentence, item, other_family_forms, vocab_forms):
    errors = []
    span = sentence.get("grammar_span")
    chunk = sentence["japanese"][span["start"]:span["end"]] if span else None
    forms_by_slug = {s: vocab_forms[s] for s in sentence.get("vocabulary_slugs", []) if s in vocab_forms}
    for index, alt in enumerate(sentence.get("build_alternates", [])):
        label = f"rule 6 alternate[{index}]"
        plain = _parse_alternate(alt["furigana"])
        if plain is None:
            errors.append(f"{label}: furigana does not parse: {alt['furigana']!r}")
            continue
        found = {s["vocabulary_slug"] for s in spans_lib.derive_spans(plain, forms_by_slug)}
        missing = sorted(set(forms_by_slug) - found)
        if missing:
            errors.append(f"{label}: missing words {missing} in {plain!r}")
            continue
        if alt["kind"] == "valid" and chunk and chunk not in plain:
            errors.append(f"{label}: valid alternate lacks the grammar {chunk!r}: {plain!r}")
        if alt["kind"] == "other_grammar" and not any(f in plain for f in other_family_forms):
            errors.append(f"{label}: other_grammar alternate has no same-family form: {plain!r}")
    return errors


def sentence_errors(sentence, item, allowed_index, other_family_forms, vocab_forms):
    jp = sentence["japanese"]
    errors = []
    span = sentence.get("grammar_span")
    if not span:
        errors.append("rule 1: no grammar span")
    uncovered = gs.uncovered_content_words(jp, sentence.get("word_spans", []), span)
    if uncovered:
        errors.append(f"rule 2: words with no word span {uncovered}")
    violations = level_check.find_violations(jp, allowed_index, item.get("accepted_forms", []))
    if violations:
        errors.append(f"rule 3: out of range {violations}")
    errors.extend(_alternate_errors(sentence, item, other_family_forms, vocab_forms))
    return [f"{jp} — {e}" for e in errors]


def point_errors(item, allowed_index, other_family_forms, vocab_forms):
    errors = []
    passing = []
    for sentence in item.get("example_sentences", []):
        found = sentence_errors(sentence, item, allowed_index, other_family_forms, vocab_forms)
        errors.extend(found)
        if not found:
            passing.append(sentence)
    if len(passing) < MIN_SENTENCES:
        errors.append(f"rule 4: {len(passing)} passing sentences, need {MIN_SENTENCES}")
    seen = {}
    for sentence in passing:
        key = frozenset(sentence.get("vocabulary_slugs", []))
        if key in seen:
            errors.append(f"rule 5: same words as {seen[key]!r}: {sentence['japanese']!r}")
        else:
            seen[key] = sentence["japanese"]
    shapes = {gs.sentence_shape(s["japanese"]) for s in passing}
    if item["slug"] not in VARIETY_EXEMPT and len(shapes) < 2:
        errors.append(f"rule 5: {len(shapes)} sentence shape(s), need 2 (question/negative/past)")
    meanings = [a for a in item.get("accepted_answers", []) if a["answer_type"] == "meaning"]
    if len(meanings) < MIN_MEANINGS:
        errors.append(f"rule 7: {len(meanings)} accepted meanings, need {MIN_MEANINGS}")
    return errors


def _other_family_forms(item, grammar):
    family = item.get("family")
    return [
        form for other in grammar
        if other["slug"] != item["slug"] and family and other.get("family") == family
        for form in other["accepted_forms"] if "〜" not in form
    ]


def check_level(level):
    """{slug: [errors]} for every grammar point at `level`."""
    grammar = context.load_grammar(level)
    vocab_forms = {
        v["slug"]: v["primary_form"]
        for lower in context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level) + 1]
        for v in context.load_vocab(lower)
    }
    results = {}
    for item in grammar:
        allowed = level_check.build_allowed_index(context.allowed_vocab_for(level, item["slug"]))
        results[item["slug"]] = point_errors(
            item, allowed, _other_family_forms(item, grammar), vocab_forms
        )
    return results


def _report(results_by_level):
    lines = ["# Grammar pool report", ""]
    for level, results in results_by_level.items():
        failing = {slug: errs for slug, errs in results.items() if errs}
        lines += [f"## {level.upper()} — {len(results) - len(failing)}/{len(results)} points pass", ""]
        for slug, errs in failing.items():
            lines.append(f"### {slug}")
            lines += [f"- {e}" for e in errs]
            lines.append("")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=context.LEVEL_ORDER)
    parser.add_argument("--report", help="write the markdown report to this path")
    args = parser.parse_args()
    levels = [args.level] if args.level else context.LEVEL_ORDER
    results = {level: check_level(level) for level in levels}
    report = _report(results)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(report)
    print(report)
    failing = sum(1 for r in results.values() for errs in r.values() if errs)
    sys.exit(1 if failing else 0)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_check_grammar_pool -v`
Expected: PASS. `test_rule3_out_of_range_word` depends on 帽子/被る not being in `ALLOWED` nor in `level_check.FUNCTION_WORD_ALLOWLIST`; if the tokenizer lemmatizes differently, print `level_check.find_violations(...)` and pick another out-of-range noun (e.g. 飛行機).

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate_content/check_grammar_pool.py curriculum/_build/generate_content/test_check_grammar_pool.py
git commit -m "Add report-only grammar sentence pool validator"
```

---

### Task 4: Schema and compile

**Files:**
- Modify: `curriculum/schema/curriculum.schema.json` — `$defs.exampleSentence.properties`, `$defs.grammarItem.properties`
- Modify: `scripts/curriculum-schema.ts` — `example_sentences` DDL (≈ line 99) and a new table after `example_sentence_spans`
- Modify: `scripts/compile-curriculum.ts` — `ExampleSentence` + `GrammarItem` types (≈ lines 131–175), `insertExample` / `insertExamples` (≈ 602–688), grammar loop (≈ 840–900)
- Modify: `scripts/__fixtures__/valid/grammar/n5.json`
- Test: `scripts/compile-curriculum.test.ts`

**Interfaces:**
- Consumes: grammar JSON fields from Task 2.
- Produces (`curriculum.db`, read by Plan 3):
  - `example_sentences.grammar_start INTEGER`, `grammar_end INTEGER`, `register TEXT CHECK(register IN ('polite','plain'))` — null on non-grammar rows
  - `grammar_sentence_answers (id INTEGER PRIMARY KEY, sentence_id INTEGER NOT NULL REFERENCES example_sentences(id), answer_furigana TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('valid','other_grammar')), sort_order INTEGER NOT NULL DEFAULT 0)` + index on `sentence_id`
  - grammar rows in `accepted_answers` (`answer_type = 'meaning'`)

- [ ] **Step 1: Extend the fixture**

In `scripts/__fixtures__/valid/grammar/n5.json`, add to the `desu` item (after `"vocabulary_slugs": ["ichi-v"]`, keeping valid JSON):

```json
      "accepted_answers": [
        { "answer_type": "meaning", "answer_text": "is", "is_primary": true },
        { "answer_type": "meaning", "answer_text": "copula" }
      ],
      "example_sentences": [
        {
          "japanese": "一です。",
          "english": "It is one.",
          "sort_order": 0,
          "grammar_span": { "start": 1, "end": 3 },
          "register": "polite",
          "build_alternates": [
            { "furigana": "一[いち]だ。", "kind": "valid" },
            { "furigana": "一[いち]じゃない。", "kind": "other_grammar" }
          ]
        }
      ]
```

- [ ] **Step 2: Write the failing tests**

Append inside `describe('compile-curriculum', …)` in `scripts/compile-curriculum.test.ts`:

```ts
  function compileGrammarFixture(
    mutate?: (grammarFile: { items: Record<string, unknown>[] }) => void,
  ): { dbPath: string; tempDir: string; run: () => void } {
    const { tempDir, curriculumDir, dbPath } = copyFixture();
    const grammarPath = path.join(curriculumDir, 'grammar', 'n5.json');
    const grammarFile = JSON.parse(fs.readFileSync(grammarPath, 'utf8'));
    mutate?.(grammarFile);
    fs.writeFileSync(grammarPath, JSON.stringify(grammarFile));
    return { dbPath, tempDir, run: () => compileCurriculum(dbPath, curriculumDir) };
  }

  it('compiles grammar pool fields, build alternates and grammar meanings', () => {
    const { dbPath, tempDir, run } = compileGrammarFixture();
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const sentence = db
        .prepare(
          `SELECT s.id, s.grammar_start, s.grammar_end, s.register
           FROM example_sentences s JOIN items i ON i.id = s.item_id
           WHERE i.slug = 'desu'`,
        )
        .get() as { id: number; grammar_start: number; grammar_end: number; register: string };
      expect(sentence).toMatchObject({ grammar_start: 1, grammar_end: 3, register: 'polite' });

      const answers = db
        .prepare(
          `SELECT answer_furigana, kind, sort_order FROM grammar_sentence_answers
           WHERE sentence_id = ? ORDER BY sort_order`,
        )
        .all(sentence.id);
      expect(answers).toEqual([
        { answer_furigana: '一[いち]だ。', kind: 'valid', sort_order: 0 },
        { answer_furigana: '一[いち]じゃない。', kind: 'other_grammar', sort_order: 1 },
      ]);

      const meanings = db
        .prepare(
          `SELECT a.answer_text, a.is_primary FROM accepted_answers a
           JOIN items i ON i.id = a.item_id
           WHERE i.slug = 'desu' AND a.answer_type = 'meaning' ORDER BY a.id`,
        )
        .all();
      expect(meanings).toEqual([
        { answer_text: 'is', is_primary: 1 },
        { answer_text: 'copula', is_primary: 0 },
      ]);
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('leaves grammar pool columns null on non-grammar example sentences', () => {
    const { dbPath, tempDir, run } = compileGrammarFixture();
    run();
    const db = new Database(dbPath, { readonly: true });
    try {
      const rows = db
        .prepare(
          `SELECT s.grammar_start, s.grammar_end, s.register FROM example_sentences s
           JOIN items i ON i.id = s.item_id WHERE i.item_type != 'grammar'`,
        )
        .all();
      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row).toEqual({ grammar_start: null, grammar_end: null, register: null });
      }
    } finally {
      db.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('throws on a grammar span outside its sentence', () => {
    const { tempDir, run } = compileGrammarFixture((file) => {
      const desu = file.items[0] as { example_sentences: { grammar_span: unknown }[] };
      desu.example_sentences[0].grammar_span = { start: 2, end: 9 };
    });
    expect(run).toThrow(/Grammar span out of range: grammar:desu example\[0\]/);
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx jest --config jest.config.cjs scripts/compile-curriculum.test.ts -t "grammar"`
Expected: FAIL — JSON schema rejects `accepted_answers` / `grammar_span` (additionalProperties false), or `no such column: grammar_start`.

- [ ] **Step 4: JSON schema**

In `curriculum/schema/curriculum.schema.json`:

`$defs.exampleSentence.properties` — add:

```json
"grammar_span": {
  "type": "object",
  "additionalProperties": false,
  "required": ["start", "end"],
  "properties": {
    "start": { "type": "integer", "minimum": 0 },
    "end": { "type": "integer", "minimum": 1 }
  }
},
"register": { "type": "string", "enum": ["polite", "plain"] },
"build_alternates": {
  "type": "array",
  "items": {
    "type": "object",
    "additionalProperties": false,
    "required": ["furigana", "kind"],
    "properties": {
      "furigana": { "type": "string", "minLength": 1 },
      "kind": { "type": "string", "enum": ["valid", "other_grammar"] }
    }
  }
}
```

`$defs.grammarItem.properties` — add:

```json
"accepted_answers": { "type": "array", "items": { "$ref": "#/$defs/acceptedAnswer" } }
```

- [ ] **Step 5: DDL**

In `scripts/curriculum-schema.ts`, replace the `example_sentences` table with

```sql
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
```

and add after the `example_sentence_spans` table:

```sql
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
```

and next to the other indexes at the end:

```sql
CREATE INDEX idx_grammar_sentence_answers_sentence ON grammar_sentence_answers(sentence_id);
```

- [ ] **Step 6: Compile**

In `scripts/compile-curriculum.ts`:

Types — extend `ExampleSentence` and `GrammarItem`:

```ts
type ExampleSentence = {
  japanese: string;
  furigana?: string;
  english: string;
  sort_order?: number;
  reinforcement_tags?: string[];
  vocabulary_slugs?: string[];
  word_spans?: WordSpan[];
  /** Grammar pool only: where the grammar sits in `japanese`. */
  grammar_span?: { start: number; end: number };
  register?: 'polite' | 'plain';
  build_alternates?: { furigana: string; kind: 'valid' | 'other_grammar' }[];
};
```

and add `accepted_answers?: AcceptedAnswer[];` to `GrammarItem`.

Replace the `insertExample` statement with

```ts
    const insertExample = db.prepare(`
      INSERT INTO example_sentences (item_id, japanese, furigana, english, sort_order, reinforcement_tags, grammar_start, grammar_end, register)
      VALUES (@item_id, @japanese, @furigana, @english, @sort_order, @reinforcement_tags, @grammar_start, @grammar_end, @register)
    `);
    const insertGrammarSentenceAnswer = db.prepare(`
      INSERT INTO grammar_sentence_answers (sentence_id, answer_furigana, kind, sort_order)
      VALUES (@sentence_id, @answer_furigana, @kind, @sort_order)
    `);
```

In `insertExamples`, before `insertExample.run`, add the span check, and pass the new values:

```ts
        const span = sentence.grammar_span;
        if (span && !(span.start >= 0 && span.start < span.end && span.end <= sentence.japanese.length)) {
          throw new Error(
            `Grammar span out of range: ${ownerLabel} example[${index}] [${span.start}, ${span.end}) in "${sentence.japanese}"`,
          );
        }
        const result = insertExample.run({
          item_id: itemId,
          japanese: sentence.japanese,
          furigana: sentence.furigana ?? null,
          english: sentence.english,
          sort_order: sentence.sort_order ?? index,
          reinforcement_tags: sentence.reinforcement_tags
            ? JSON.stringify(sentence.reinforcement_tags)
            : null,
          grammar_start: span?.start ?? null,
          grammar_end: span?.end ?? null,
          register: sentence.register ?? null,
        });
        const sentenceId = Number(result.lastInsertRowid);
        for (const [altIndex, alternate] of (sentence.build_alternates ?? []).entries()) {
          insertGrammarSentenceAnswer.run({
            sentence_id: sentenceId,
            answer_furigana: alternate.furigana,
            kind: alternate.kind,
            sort_order: altIndex,
          });
        }
```

(keep the existing `const sentenceId = …` line only once — the snippet above replaces it).

In the grammar loop, after `insertGrammarRule.run({...})`, add

```ts
      for (const answer of grammarItem.accepted_answers ?? []) {
        insertAnswer.run({
          item_id: id,
          answer_type: answer.answer_type,
          answer_text: answer.answer_text,
          is_primary: answer.is_primary ? 1 : 0,
        });
      }
```

- [ ] **Step 7: Run all script tests**

Run: `npx jest --config jest.config.cjs scripts/`
Expected: PASS, including the three new tests and every existing compile / validate-schema test.

- [ ] **Step 8: Commit**

```bash
git add curriculum/schema/curriculum.schema.json scripts/curriculum-schema.ts scripts/compile-curriculum.ts scripts/compile-curriculum.test.ts scripts/__fixtures__/valid/grammar/n5.json
git commit -m "Compile grammar pool columns, build alternates and grammar meanings"
```

---

### Task 5: Regenerate, compile and record the baseline

**Files:**
- Regenerated: `curriculum/grammar/n5.json`, `curriculum/grammar/n4.json`, `curriculum/metadata.json`, `mobile/assets/curriculum-seed/curriculum.db`, `mobile/assets/curriculum-seed/curriculum-seed.json`
- Create: `curriculum/_build/reports/grammar-pool-baseline.md`
- Modify: `docs/working-history.md` (spec row), `docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md` (Status line)

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces: the baseline report Plan 2 works down to zero.

- [ ] **Step 1: Regenerate the grammar JSON**

Run:

```bash
cd curriculum/_build
.venv/bin/python generate.py --level n5
.venv/bin/python generate.py --level n4
```

Expected: `Generated N5 JSON files.` / `Generated N4 JSON files.` If a `ValueError` lists `grammar … example …: grammar form … not found`, that is a source bug from a `form=` value — none exist yet, so this must not happen in Plan 1.

- [ ] **Step 2: Check the regenerated JSON**

Run:

```bash
cd ../..
git diff --stat curriculum/grammar/
python3 -c "
import json
for f in ['n5','n4']:
    items=json.load(open(f'curriculum/grammar/{f}.json'))['items']
    s=[x for i in items for x in i['example_sentences']]
    print(f, len(items), 'points', len(s), 'sentences',
          sum('grammar_span' in x for x in s), 'with span',
          sum(x.get('register')=='polite' for x in s), 'polite')
"
```

Expected: N5 74 points and N4 87 points; sentence counts larger than before (499 authored + filled cloze variants, minus duplicates); most sentences with a span. Only `example_sentences` gained entries/fields — `cloze_variants` unchanged.

- [ ] **Step 3: Validate and compile**

Run: `npm run validate-schema && npm run compile-curriculum`
Expected: both succeed; `metadata.json` version raised by 1.

- [ ] **Step 4: Write the baseline report**

Run:

```bash
cd curriculum/_build
.venv/bin/python -m generate_content.check_grammar_pool --report reports/grammar-pool-baseline.md; echo "exit $?"
```

Expected: `exit 1` (content is not written yet) and a report listing, per level, `X/Y points pass` and each failing point's errors. This is the Plan 2 work list.

- [ ] **Step 5: Run every test suite touched**

Run:

```bash
cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_sentences generate_content.test_generate_grammar_level generate_content.test_check_grammar_pool -v
cd ../.. && npx jest --config jest.config.cjs scripts/
cd mobile && npx jest src/data src/core/grammar
```

Expected: all PASS. The mobile run proves the app still reads the new `curriculum.db` (additive columns, cloze table still present).

- [ ] **Step 6: Update status docs**

In `docs/working-history.md`, change the spec row status to:

```
Partial — Plan 1 (pipeline) done 2026-10-13: pool fields, cloze-derived sentences, grammar meanings in accepted_answers, report-only validator (baseline: curriculum/_build/reports/grammar-pool-baseline.md). Plan 2 (content) and Plan 3 (app) not started
```

and move the count in **At a glance** for Product plans from Not started to Partial (`| 14 | 2 | 0 |`).

In the spec, change `**Status:**` to `Plan 1 (pipeline) done; Plans 2–3 not started`.

- [ ] **Step 7: Commit**

```bash
git lfs install
git add curriculum/grammar/n5.json curriculum/grammar/n4.json curriculum/metadata.json mobile/assets/curriculum-seed/ curriculum/_build/reports/grammar-pool-baseline.md docs/working-history.md docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md
git commit -m "Regenerate grammar pool, compile curriculum, record pool baseline"
```

---

## Self-review notes

- Spec §4.1 sources 1–2 → Task 2; source 3 (new sentences) → Plan 2.
- Spec §4.2 derived fields → Task 1 + Task 2 (word spans reuse `_example_word_spans` / `derive_spans`; Build answer = existing `furigana`, no new column).
- Spec §4.3 authored fields: source format for `accepted_meanings` and `alts` → Task 2; the content itself → Plan 2.
- Spec §4.4 rules 1–7 → Task 3 (report-only; hard gate in Plan 2).
- Spec §5.1 `curriculum.db` → Task 4, except dropping `grammar_cloze_variants` → Plan 3 (the shipped app still reads it).
