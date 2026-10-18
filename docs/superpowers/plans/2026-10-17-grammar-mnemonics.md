# Grammar Mnemonics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each of the 161 N5/N4 grammar points a short story mnemonic (English sound-alike of the form = its meaning, ending on a Japanese example), generated and gated by the existing mnemonic pipeline, shown on the grammar detail page and in lesson step 2.

**Architecture:** A fourth `--type grammar` in `generate_mnemonics.py` (context in `mnemonic_context.py`, gate in `validate_mnemonics.py`, prompt `prompts/grammar-mnemonic.md`) writes the sidecar `curriculum/grammar/mnemonics.json`; `generate.py` inlines it as `mnemonic_text`; `compile-curriculum.ts` writes the existing `items.mnemonic_text` column. True origins come only from the reviewed table `curriculum/_build/grammar_origins.json`. The app renders the text with `AnnotatedText` and a new `<grammar>` tag; Studio gets an edit field and a separate mnemonic review status.

**Tech Stack:** Python 3.12 + unittest + fugashi (curriculum build), TypeScript + ts-jest (compile script), Expo / React Native + jest + RNTL (mobile), Express + React + `node:test` via `tsx` (Studio).

**Spec:** `docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md`

## Global Constraints

- Scope: N5 + N4 grammar only — 74 + 87 = 161 points. No N3+.
- Branch `grammar-mnemonics` in the main checkout (`/Users/riyazahmed/Projects/japanese-learning`). No worktrees.
- One field: `mnemonic_text`. No new DB column, no `user.db` migration.
- Contract: story of 1–2 English sentences + one Japanese example sentence ending in `。`; 100–240 characters, tags stripped; no sentence over 35 words; punctuation inside quoted speech (`"Oh! That one!"`) does not end a sentence.
- Tags: only `<reading>` (sound, gold) and `<grammar>` (meaning, bold `text-primary`).
- Origins only from `grammar_origins.json`; every one of the 161 slugs has an entry (object or `null`); generation refuses while `"review_status"` is not `"reviewed"`.
- `PROMPT_VERSION["grammar"] = 1`.
- No hidden fallbacks: missing data raises an error; it never silently degrades.
- Do not edit reviewed lessons (`curriculum/grammar/lessons/*.md`) or existing radical/kanji/vocab mnemonics.
- Fallible TS ops in the app keep the `Result` convention; styling uses semantic NativeWind tokens only, no raw hex in mobile code.
- Python commands run from `curriculum/_build` with `.venv/bin/python`. Mobile commands from `mobile/`. Root commands from the repo root.
- Commits end with:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01CnVWTbgLfMMcX2tpQeQsoN
  ```
- Speak to the maintainer in ASD-STE-100.

## Review Focus

1. **Kanji in the example have no furigana.** `AnnotatedText` shows no ruby, so an example kanji the learner has not met is unreadable. Expected: every kanji in the example appears in a word the learner is allowed to know at that point. → Task 3 adds gate rule "example kanji must come from allowed vocabulary" and its test.
2. **A `<reading>` tag that splits a word** (`"<reading>Wha</reading>t about me?"`). Expected: length, sentence count and keyword checks see the whole word "What". → Task 3 test `test_tag_inside_a_word_is_read_as_one_word`.
3. **Contractions and alternate forms** (`とく` for `ておく`, `です`/`だ`). Expected: the kana-form rule and the example rule accept any of the point's `accepted_forms`. → Task 3 test `test_any_accepted_form_satisfies_the_form_rules`.
4. **Studio lesson-status flip on a point whose mnemonic is still `draft`.** Expected: the level JSON row stays `draft` (what `generate.py` would write), so CI's "regeneration changed committed JSON" check does not fail. → Task 10 test `lesson status flip keeps the row at the mnemonic's draft`.
5. **A grammar point with no lesson file, or a web-lane reply with extra keys.** Expected: the context builder raises (no silent empty opening); the gate rejects unknown keys so they never reach the sidecar. → Task 2 test `test_missing_lesson_raises`, Task 3 test `test_unknown_keys_are_rejected`.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `curriculum/_build/grammar_origins.json` (new) | Reviewed origin table: 161 entries, origin or `null`. Build input only. |
| `curriculum/_build/generate_content/mnemonic_context.py` | + origin table loader/checker, `grammar_context`, prompt formatters for grammar. |
| `curriculum/_build/generate_content/validate_mnemonics.py` | + `validate_grammar` and its constants; dispatcher + CLI accept `grammar`. |
| `curriculum/_build/generate_content/prompts/grammar-mnemonic.md` (new) | The generation prompt. |
| `curriculum/_build/generate_content/generate_mnemonics.py` | + `grammar` type everywhere a type is listed; origin-table refusal. |
| `curriculum/_build/generate_content/test_grammar_mnemonics.py` (new) | Tests for table, context, gate, generator wiring. |
| `curriculum/grammar/mnemonics.json` (new, generated) | Sidecar `{slug: {mnemonic_text, _meta}}`. |
| `curriculum/_build/generate.py` | Inline sidecar into grammar items, merge `_meta`. |
| `curriculum/_build/n5_grammar.py`, `n4_grammar.py` | Remove 161 `"mnemonic"` seeds. |
| `curriculum/schema/curriculum.schema.json` | `grammarItem.mnemonic_text`. |
| `scripts/compile-curriculum.ts` (+ test, fixture) | Write `mnemonic_text` for grammar. |
| `mobile/src/utils/highlightTags.ts`, `mobile/src/components/common/AnnotatedText.tsx` | `<grammar>` tag. |
| `mobile/src/components/learn/GrammarMnemonicBlock.tsx` (new) | Shared "Mnemonic" block for detail + lesson. |
| `mobile/src/components/learn/GrammarDetail.tsx`, `mobile/src/components/lesson/LessonItemSections.tsx` | Render the block. |
| `mobile/src/data/curriculum/browseRepository.ts` | Grammar no longer exempt from "No mnemonic". |
| `web/server/curriculum/sidecar.ts`, `writer.ts`, `api.ts` | Mnemonic field, mnemonic status, merged row status, route. |
| `web/server/curriculum/grammarMnemonicStatus.test.ts` (new) | Studio server tests (`node:test`). |
| `web/src/...` (tags, CSS, editSchema, GrammarDetail, ItemDetail, ReviewStatusControl, types, guide, completeness) | Studio UI. |
| `docs/workflows/radical-kanji-vocab-mnemonic-*.md`, `docs/workflows/README.md` | `grammar` type in the lanes. |

---

### Task 1: Origin table — loader, checker, draft file

**Files:**
- Modify: `curriculum/_build/generate_content/mnemonic_context.py`
- Create: `curriculum/_build/grammar_origins.json`
- Create: `curriculum/_build/generate_content/test_grammar_mnemonics.py`

**Interfaces:**
- Produces: `mc.GRAMMAR_ORIGINS_PATH: str`, `mc.GRAMMAR_MNEMONIC_LEVELS = ("n5", "n4")`, `mc.grammar_mnemonic_slugs() -> list[str]`, `mc.load_grammar_origins(path=GRAMMAR_ORIGINS_PATH) -> dict`, `mc.origin_table_errors(table: dict, slugs: list[str]) -> list[str]`.

- [ ] **Step 1: Write the failing tests**

Create `curriculum/_build/generate_content/test_grammar_mnemonics.py`:

```python
# curriculum/_build/generate_content/test_grammar_mnemonics.py
# -*- coding: utf-8 -*-
"""Grammar mnemonics (docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md)."""
import os
import sys
import unittest

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import mnemonic_context as mc  # noqa: E402


class OriginTableTest(unittest.TestCase):
    def test_checker_reports_missing_unknown_and_malformed_entries(self):
        table = {
            "review_status": "draft",
            "origins": {
                "teoku": {"word": "置く", "gloss": "to put down", "keywords": ["put"]},
                "wo": None,
                "zz-unknown": None,
                "ga": {"word": "", "gloss": "x", "keywords": []},
            },
        }
        errors = mc.origin_table_errors(table, ["teoku", "wo", "ga", "desu"])
        self.assertIn("grammar_origins.json has no entry for 'desu' (write an origin or null)", errors)
        self.assertIn("grammar_origins.json lists unknown slug 'zz-unknown'", errors)
        self.assertIn(
            "grammar_origins.json entry 'ga' needs a non-empty word, gloss and keywords list, or null",
            errors,
        )
        self.assertEqual(len(errors), 3)

    def test_checker_rejects_an_unknown_review_status(self):
        errors = mc.origin_table_errors({"review_status": "done", "origins": {}}, [])
        self.assertEqual(errors, ["grammar_origins.json review_status must be 'draft' or 'reviewed'"])

    def test_scope_is_the_161_n5_and_n4_points(self):
        slugs = mc.grammar_mnemonic_slugs()
        self.assertEqual(len(slugs), 161)
        self.assertEqual(len(set(slugs)), 161)

    def test_shipped_table_covers_exactly_the_scope(self):
        table = mc.load_grammar_origins()
        self.assertEqual(mc.origin_table_errors(table, mc.grammar_mnemonic_slugs()), [])


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: FAIL — `AttributeError: module 'generate_content.mnemonic_context' has no attribute 'origin_table_errors'`.

- [ ] **Step 3: Add the loader and checker**

In `mnemonic_context.py`, after `ALL_LEVELS = (...)` add:

```python
#: Grammar mnemonics (docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md)
#: cover the N5 and N4 points only.
GRAMMAR_MNEMONIC_LEVELS = ("n5", "n4")

#: The reviewed origin table: every grammar point in scope maps to the real
#: word its form comes from (おく = 置く "to put down") or to null, a recorded
#: "no useful origin". The model never supplies an origin; this file does.
GRAMMAR_ORIGINS_PATH = os.path.join(BUILD_DIR, "grammar_origins.json")
```

At the end of the file add:

```python
# --- grammar (grammar mnemonics spec) ---------------------------------------

def grammar_mnemonic_slugs():
    """Every grammar slug in scope, N5 then N4, in curriculum order."""
    return [slug for level in GRAMMAR_MNEMONIC_LEVELS for slug in all_slugs(level, "grammar")]


def load_grammar_origins(path=GRAMMAR_ORIGINS_PATH):
    """The origin table as stored: {"review_status": ..., "origins": {slug: entry|None}}."""
    return _load_json(path)


def origin_table_errors(table, slugs):
    """Every reason the table cannot drive generation. A slug in scope with no
    entry is an error, never an implicit null: "no origin" must be a decision
    someone wrote down."""
    errors = []
    if table.get("review_status") not in ("draft", "reviewed"):
        errors.append("grammar_origins.json review_status must be 'draft' or 'reviewed'")
    origins = table.get("origins", {})
    scope = set(slugs)
    for slug in slugs:
        if slug not in origins:
            errors.append(f"grammar_origins.json has no entry for {slug!r} (write an origin or null)")
    for slug, entry in origins.items():
        if slug not in scope:
            errors.append(f"grammar_origins.json lists unknown slug {slug!r}")
            continue
        if entry is None:
            continue
        ok = (
            isinstance(entry, dict)
            and isinstance(entry.get("word"), str) and entry["word"].strip()
            and isinstance(entry.get("gloss"), str) and entry["gloss"].strip()
            and isinstance(entry.get("keywords"), list) and entry["keywords"]
            and all(isinstance(k, str) and k.strip() for k in entry["keywords"])
        )
        if not ok:
            errors.append(
                f"grammar_origins.json entry {slug!r} needs a non-empty word, gloss and "
                "keywords list, or null"
            )
    return errors
```

- [ ] **Step 4: Write the draft table**

Create `curriculum/_build/grammar_origins.json` with `"review_status": "draft"` and one entry for **each** slug from `mc.grammar_mnemonic_slugs()`, in that order. Print the slugs with their forms and meanings first:

```bash
cd curriculum/_build && .venv/bin/python -c "
import json
for lv in ('n5','n4'):
    for g in json.load(open(f'../grammar/{lv}.json'))['items']:
        print(lv, g['slug'], g['primary_form'], '|', g['meaning'])
"
```

Rule for an entry: give an origin **only** when the form contains a real word that a learner can recognise and whose plain meaning acts out the grammar's meaning (ておく → 置く "to put down", keywords `["put", "set"]`; てしまう → 仕舞う "to finish, put away", `["finish", "all gone", "every last", "put away"]`; ていく → 行く "to go", `["go", "goes", "went"]`; てくる → 来る "to come", `["come", "came"]`; てみる → 見る "to see", `["see", "look"]`; てあげる → あげる "to give", `["give", "gave"]`). Particles, copulas and endings without such a word get `null`. When unsure, write `null` — a wrong origin is worse than none. `keywords` are the English words a story would use for that action. Shape:

```json
{
  "review_status": "draft",
  "origins": {
    "wa-topic": null,
    "teoku": { "word": "置く", "gloss": "to put down", "keywords": ["put", "set"] }
  }
}
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: 4 tests PASS. Also print the count: `.venv/bin/python -c "import json; o=json.load(open('grammar_origins.json'))['origins']; print(sum(v is not None for v in o.values()), 'origins of', len(o))"`.

- [ ] **Step 6: Commit**

```bash
git add curriculum/_build/grammar_origins.json curriculum/_build/generate_content/mnemonic_context.py curriculum/_build/generate_content/test_grammar_mnemonics.py
git commit -m "Grammar mnemonics: origin table (draft) and its checker"
```

---

### Task 2: Grammar context builder and prompt formatters

**Files:**
- Modify: `curriculum/_build/generate_content/mnemonic_context.py`
- Modify: `curriculum/_build/generate_content/test_grammar_mnemonics.py`

**Interfaces:**
- Consumes: Task 1 `load_grammar_origins`, `GRAMMAR_MNEMONIC_LEVELS`.
- Produces: `mc.grammar_context(level: str, slug: str, table: dict | None = None) -> dict` with keys `type, level, slug, form, accepted_forms, meaning, structure, family, lesson_opening, origin (dict|None), allowed_vocab (list[dict]), allowed_index (set[str]), allowed_kanji (set[str])`; `mc.grammar_lesson_opening(slug) -> str`; `mc.format_grammar_origin(origin) -> str`; `mc.format_grammar_cast(cast=None) -> str`.

- [ ] **Step 1: Write the failing tests**

Append to `test_grammar_mnemonics.py` (before the `if __name__` block):

```python
class GrammarContextTest(unittest.TestCase):
    TABLE = {
        "review_status": "reviewed",
        "origins": {"teoku": {"word": "置く", "gloss": "to put down", "keywords": ["put", "set"]},
                    "wa-topic": None},
    }

    def test_context_carries_the_point_and_its_origin(self):
        ctx = mc.grammar_context("n4", "teoku", self.TABLE)
        self.assertEqual(ctx["form"], "ておく")
        self.assertIn("ておく", ctx["accepted_forms"])
        self.assertEqual(ctx["origin"]["word"], "置く")
        self.assertTrue(ctx["lesson_opening"])
        self.assertNotIn("## ", ctx["lesson_opening"])
        self.assertIn("買う", ctx["allowed_index"])
        self.assertIn("買", ctx["allowed_kanji"])

    def test_null_origin_is_kept_as_none(self):
        self.assertIsNone(mc.grammar_context("n5", "wa-topic", self.TABLE)["origin"])

    def test_slug_without_a_table_entry_raises(self):
        with self.assertRaises(KeyError):
            mc.grammar_context("n5", "ga", self.TABLE)

    def test_missing_lesson_raises(self):
        with self.assertRaises(FileNotFoundError):
            mc.grammar_lesson_opening("zz-no-such-lesson")

    def test_origin_formatter_states_both_cases(self):
        self.assertIn("置く", mc.format_grammar_origin(self.TABLE["origins"]["teoku"]))
        self.assertIn("put, set", mc.format_grammar_origin(self.TABLE["origins"]["teoku"]))
        self.assertIn("no origin", mc.format_grammar_origin(None))

    def test_cast_formatter_lists_characters_once(self):
        block = mc.format_grammar_cast()
        self.assertEqual(block.count("**Koichi**"), 1)
```

- [ ] **Step 2: Run to see them fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: FAIL — `AttributeError: ... has no attribute 'grammar_context'`.

- [ ] **Step 3: Implement**

In `mnemonic_context.py`, add to the imports after `from generate_content import cast as cast_lib`:

```python
from generate_content import context as grammar_pool_context  # noqa: E402
from generate_content import frontmatter as frontmatter_lib  # noqa: E402
from generate_content import level_check  # noqa: E402
```

After `GRAMMAR_ORIGINS_PATH` add:

```python
LESSONS_DIR = os.path.join(CURRICULUM_DIR, "grammar", "lessons")
```

Append to the grammar section:

```python
def grammar_lesson_opening(slug):
    """The lesson's opening text — everything before its first `## ` heading —
    from the source markdown (no build-time furigana or word markers). Every
    point in scope has a lesson, so a missing file raises."""
    path = os.path.join(LESSONS_DIR, f"{slug}.md")
    with open(path, encoding="utf-8") as f:
        _meta, body = frontmatter_lib.parse(f.read())
    return re.split(r"^## ", body, flags=re.M)[0].strip()


def grammar_context(level, slug, table=None):
    items = _by_slug(load_items("grammar", level))
    if slug not in items:
        raise KeyError(f"unknown grammar slug {slug!r} in level {level}")
    origins = (table or load_grammar_origins())["origins"]
    if slug not in origins:
        raise KeyError(
            f"grammar_origins.json has no entry for {slug!r}; write an origin or null first"
        )
    item = items[slug]
    allowed_vocab = grammar_pool_context.allowed_vocab_for(level, slug)
    return {
        "type": "grammar",
        "level": level,
        "slug": slug,
        "form": item["primary_form"],
        "accepted_forms": item["accepted_forms"],
        "meaning": item["meaning"],
        "structure": item["structure"],
        "family": item.get("family", ""),
        "lesson_opening": grammar_lesson_opening(slug),
        "origin": origins[slug],
        "allowed_vocab": allowed_vocab,
        "allowed_index": level_check.build_allowed_index(allowed_vocab),
        # The example renders without furigana, so its kanji must be ones the
        # learner has already met inside an allowed word.
        "allowed_kanji": {
            ch for v in allowed_vocab for ch in v["primary_form"] if furigana_lib.is_kanji(ch)
        },
    }


def format_grammar_origin(origin):
    if origin is None:
        return (
            "This point has no origin to use. Do not say where the form comes from — "
            "no \"really is\", \"comes from\", \"originally\", \"derived from\" or "
            "\"short for\". The sound hook alone carries the meaning."
        )
    keywords = ", ".join(origin["keywords"])
    return (
        f"The form comes from {origin['word']} \"{origin['gloss']}\". Make that action "
        f"the story's action, and name it with one of these words: {keywords}. Do not "
        "explain the origin in a sentence of its own."
    )


def format_grammar_cast(cast=None):
    """The cast as optional actors. Grammar forms get no fixed character: the
    cast bible's one-reading-one-character rule is for kanji readings."""
    cast = cast or cast_lib.load_cast()
    seen = {}
    for entry in cast["readings"].values():
        seen.setdefault(entry["character"], entry["trait"])
    lines = ["Cast you may use as the actor (optional — any ordinary person works too):"]
    lines += [f"- **{name}**: {trait}" for name, trait in seen.items()]
    if cast["settings"]:
        lines.append("\nShared settings (reuse the fixed details when a scene calls for one):")
        lines += [f"- **{s['setting']}**: {s['details']}" for s in cast["settings"]]
    return "\n".join(lines)
```

Check that `cast_lib.load_cast()["readings"]` values have `character` and `trait` keys (they do, per `cast.load_cast` docstring); a character's name in the table is plain (`Koichi`), so the `**Koichi**` test checks dedupe.

- [ ] **Step 4: Run the tests**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: all PASS. If `買う` is not in `allowed_index` for `teoku`, print `ctx["allowed_vocab"][:5]` and pick another N5 verb that is (the test checks the index, not that exact word).

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate_content/mnemonic_context.py curriculum/_build/generate_content/test_grammar_mnemonics.py
git commit -m "Grammar mnemonics: context builder and prompt formatters"
```

---

### Task 3: The grammar gate

**Files:**
- Modify: `curriculum/_build/generate_content/validate_mnemonics.py`
- Modify: `curriculum/_build/generate_content/test_grammar_mnemonics.py`

**Interfaces:**
- Consumes: the ctx dict shape from Task 2.
- Produces: `validate_mnemonics.validate_grammar(level, slug, draft, ctx=None, enforce_readability=False) -> list[str]`; `validate_draft(..., kind="grammar")` dispatches to it; `LEN_BOUNDS["grammar"]["mnemonic_text"] == (100, 240)`; `ALLOWED_TAG[("grammar", "mnemonic_text")] == ("reading", "grammar")`.

- [ ] **Step 1: Write the failing tests**

Append to `test_grammar_mnemonics.py`:

```python
from generate_content import level_check  # noqa: E402
from generate_content.validate_mnemonics import validate_grammar  # noqa: E402

ALLOWED = [
    {"primary_form": w, "accepted_answers": []}
    for w in ("買う", "本", "読む", "私", "学生", "飲む", "水", "魚", "食べる")
]

TEOKU_GOOD = (
    "The night before the picnic, Koichi buys the drinks, puts them down by the door "
    "and nods \"<reading>OK</reading>\": all set <grammar>for later</grammar>. "
    "買っ<reading>ておく</reading>。"
)
WO_GOOD = (
    "At the market, Grandma Kane jabs a finger at one fish and cries \"<reading>Oh!</reading> "
    "That one!\", so the seller knows <grammar>exactly what</grammar> she will buy. "
    "魚<reading>を</reading>買う。"
)
TESHIMAU_GOOD = (
    "Little Shima eats the whole birthday cake, every last crumb, then whispers "
    "\"<reading>shh, Ma!</reading>\", because it is <grammar>all gone, and oops</grammar>. "
    "食べ<reading>てしまう</reading>。"
)
WA_GOOD = (
    "Sei stands up in class and asks \"<reading>Wha</reading>t about me?\", and now "
    "everyone knows <grammar>the topic</grammar> of her next sentence. "
    "私<reading>は</reading>学生です。"
)


def gctx(slug="teoku", form="ておく", accepted=("ておく", "とく"), origin="default"):
    if origin == "default":
        origin = {"word": "置く", "gloss": "to put down", "keywords": ["put", "set"]}
    return {
        "type": "grammar", "level": "n4", "slug": slug, "form": form,
        "accepted_forms": list(accepted), "meaning": "m", "structure": "s", "family": "patterns",
        "lesson_opening": "", "origin": origin, "allowed_vocab": ALLOWED,
        "allowed_index": level_check.build_allowed_index(ALLOWED),
        "allowed_kanji": {ch for v in ALLOWED for ch in v["primary_form"]
                          if "一" <= ch <= "鿿"},
    }


def wa_ctx():
    return gctx(slug="wa-topic", form="は", accepted=("は",), origin=None)


def wo_ctx():
    return gctx(slug="wo", form="を", accepted=("を",), origin=None)


def teshimau_ctx():
    return gctx(slug="teshimau", form="てしまう", accepted=("てしまう", "ちゃう"), origin={
        "word": "仕舞う", "gloss": "to finish, put away",
        "keywords": ["finish", "all gone", "every last", "put away"]})


def check(text, ctx=None):
    return validate_grammar("n4", (ctx or gctx())["slug"], {"mnemonic_text": text}, ctx or gctx())


class GrammarGateTest(unittest.TestCase):
    def test_reference_examples_pass(self):
        self.assertEqual(check(TEOKU_GOOD), [])
        self.assertEqual(check(WA_GOOD, wa_ctx()), [])
        self.assertEqual(check(WO_GOOD, wo_ctx()), [])
        self.assertEqual(check(TESHIMAU_GOOD, teshimau_ctx()), [])

    def test_quoted_speech_does_not_end_a_sentence(self):
        # "Oh! That one!" would be three sentences to a plain splitter.
        self.assertEqual(check(WO_GOOD, wo_ctx()), [])

    def test_missing_text(self):
        self.assertEqual(check(""), ["mnemonic_text is missing or empty"])

    def test_unknown_keys_are_rejected(self):
        errors = validate_grammar("n4", "teoku", {"mnemonic_text": TEOKU_GOOD, "description": "x"}, gctx())
        self.assertEqual(errors, ["unexpected key(s) description; submit only mnemonic_text"])

    def test_length_band(self):
        short = "\"<reading>OK</reading>\", <grammar>for later</grammar>. 買っ<reading>ておく</reading>。"
        self.assertTrue(any("too short" in e for e in check(short)))

    def test_three_story_sentences_fail(self):
        text = TEOKU_GOOD.replace("Koichi buys", "Koichi wakes. He yawns. He buys")
        self.assertTrue(any("sentences; write at most 2" in e for e in check(text)))

    def test_other_tags_fail(self):
        text = TEOKU_GOOD.replace("<grammar>for later</grammar>", "<kanji>for later</kanji>")
        self.assertTrue(any("<kanji>" in e for e in check(text)))

    def test_reading_needs_english_and_kana(self):
        no_english = TEOKU_GOOD.replace("<reading>OK</reading>", "OK")
        self.assertTrue(any("no English sound-alike" in e for e in check(no_english)))
        no_kana = TEOKU_GOOD.replace("<reading>ておく</reading>", "ておく")
        self.assertTrue(any("kana of the form" in e for e in check(no_kana)))

    def test_grammar_tag_required_and_english(self):
        self.assertTrue(any("no <grammar> tag" in e for e in check(
            TEOKU_GOOD.replace("<grammar>for later</grammar>", "for later"))))
        self.assertTrue(any("<grammar> must wrap English" in e for e in check(
            TEOKU_GOOD.replace("<grammar>for later</grammar>", "<grammar>あとで</grammar>"))))

    def test_example_must_end_the_text(self):
        text = TEOKU_GOOD.replace(" 買っ<reading>ておく</reading>。", " Done.")
        self.assertTrue(any("must end on a short Japanese example" in e for e in check(text)))

    def test_example_must_attach_the_form(self):
        text = TEOKU_GOOD.replace("買っ<reading>ておく</reading>。", "<reading>ておく</reading>。")
        self.assertTrue(any("form attached to a word" in e for e in check(text)))

    def test_example_words_above_level_fail(self):
        text = TEOKU_GOOD.replace("買っ", "冷蔵庫に入れ")
        self.assertTrue(any("uses words above N4" in e for e in check(text)))

    def test_example_kanji_must_come_from_allowed_words(self):
        # 飲 is allowed (飲む); 酒 appears in no allowed word, so it has no furigana source.
        text = TEOKU_GOOD.replace("買っ", "酒を飲んで")
        self.assertTrue(any("kanji 酒" in e for e in check(text)))

    def test_origin_keyword_required(self):
        # Both keywords must go: "all set" would still satisfy "set".
        text = TEOKU_GOOD.replace("puts them down", "leaves them").replace("all set", "all ready")
        self.assertTrue(any("act out the origin 置く" in e for e in check(text)))

    def test_no_origin_rejects_origin_phrases(self):
        text = WA_GOOD.replace("and now everyone", "は really is a topic word, and everyone")
        self.assertTrue(any("states an origin" in e for e in check(text, wa_ctx())))

    def test_tag_inside_a_word_is_read_as_one_word(self):
        # "<reading>Wha</reading>t" must strip to "What", one word.
        self.assertEqual(check(WA_GOOD, wa_ctx()), [])

    def test_any_accepted_form_satisfies_the_form_rules(self):
        text = TEOKU_GOOD.replace("買っ<reading>ておく</reading>。", "買っ<reading>とく</reading>。")
        self.assertEqual(check(text), [])
```

- [ ] **Step 2: Run to see them fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: FAIL — `ImportError: cannot import name 'validate_grammar'`.

- [ ] **Step 3: Implement the gate**

In `validate_mnemonics.py`:

1. Add to the import block: `from generate_content import level_check  # noqa: E402`.
2. In `LEN_BOUNDS` add the entry:

```python
    # Grammar mnemonics spec §3: a one- or two-sentence story plus a short
    # Japanese example. The four reference examples land at 112–133
    # characters tag-stripped, so the floor sits at 100. There is no stored
    # grammar prose older than this contract, so one band serves every draft.
    "grammar": {
        "mnemonic_text": (100, 240),
    },
```

3. In `ALLOWED_TAG` add: `("grammar", "mnemonic_text"): ("reading", "grammar"),`
4. Before `def validate_draft` add:

```python
# --- grammar (grammar mnemonics spec §3, §5) --------------------------------

#: The story before the example: one or two sentences.
GRAMMAR_STORY_MAX_SENTENCES = 2

#: Phrases that state an origin. A point whose table entry is null must not
#: claim one: the model has no reviewed origin to state.
GRAMMAR_ORIGIN_PHRASES = ("really is", "comes from", "came from", "originally",
                          "derived from", "short for")

_JP_CHARS = "぀-ヿ㐀-䶿一-鿿々〆ー、"
#: The example: the last run of Japanese, ending in 。, after a space.
_GRAMMAR_EXAMPLE_RE = re.compile(rf"(?:^|\s)([{_JP_CHARS}]+。)\s*$")
_LATIN_RE = re.compile(r"[A-Za-z]")
_KANA_ONLY_RE = re.compile(r"[぀-ヿー]+")
#: Quoted speech: its "Oh! That one!" punctuation is not a sentence end.
_QUOTED_RE = re.compile(r'"[^"]*"')


def _bare_forms(ctx):
    return [f.replace("〜", "") for f in (ctx["form"], *ctx["accepted_forms"]) if f.replace("〜", "")]


def validate_grammar(level, slug, draft, ctx=None, enforce_readability=False):
    """Every rule always runs: no stored grammar prose predates this contract,
    so there is no fresh-versus-stored lane (`enforce_readability` is accepted
    for the dispatcher's signature and ignored)."""
    ctx = ctx or mnemonic_context.grammar_context(level, slug)
    field = "mnemonic_text"
    extra = sorted(set(draft) - {field})
    if extra:
        return [f"unexpected key(s) {', '.join(extra)}; submit only {field}"]
    text = draft.get(field)
    if not isinstance(text, str) or not text.strip():
        return [f"{field} is missing or empty"]

    tags = ALLOWED_TAG[("grammar", field)]
    tag_errors = _tag_errors(field, text, tags)
    if tag_errors:
        return tag_errors
    plain = _strip_tags(text, tags).strip()
    errors = _markup_errors(field, plain) + _length_errors(field, plain, LEN_BOUNDS["grammar"][field])

    readings = [s.strip() for s in _tagged_spans(text, "reading")]
    if not any(_LATIN_RE.search(s) for s in readings):
        errors.append(
            f"{field} has no English sound-alike in a <reading> tag; tag the English "
            "words that sound like the form, e.g. <reading>OK</reading> for おく"
        )
    kana_forms = [_hira(f) for f in _bare_forms(ctx)]
    if not any(_KANA_ONLY_RE.fullmatch(s) and any(_hira(s) in k for k in kana_forms)
               for s in readings):
        errors.append(
            f"{field} does not tag the kana of the form; wrap it in the example, e.g. "
            f"<reading>{ctx['form']}</reading>"
        )

    meanings = _tagged_spans(text, "grammar")
    if not meanings:
        errors.append(f"{field} has no <grammar> tag; wrap the English words that state the meaning")
    elif not all(_LATIN_RE.search(m) for m in meanings):
        errors.append(f"{field}: <grammar> must wrap English words (the meaning), not Japanese")

    match = _GRAMMAR_EXAMPLE_RE.search(plain)
    if not match:
        errors.append(
            f"{field} must end on a short Japanese example sentence ending in 。 "
            "that shows where the form goes, e.g. 買っておく。"
        )
        story = plain
    else:
        example = match.group(1)
        story = plain[:match.start(1)].strip()
        body = example.rstrip("。")
        if not any(f in body and len(body) > len(f) for f in _bare_forms(ctx)):
            errors.append(
                f"{field}'s example must show the form attached to a word "
                "(e.g. 本を読む), not the form alone"
            )
        extra_allowed = set(_bare_forms(ctx))
        if ctx["origin"]:
            extra_allowed.add(ctx["origin"]["word"])
        violations = level_check.find_violations(example, ctx["allowed_index"], extra_allowed)
        if violations:
            errors.append(
                f"{field}'s example uses words above {level.upper()}: "
                f"{', '.join(violations)} — use only words the learner already has"
            )
        unknown_kanji = sorted({ch for ch in example if furigana_lib.is_kanji(ch)}
                               - ctx["allowed_kanji"])
        if unknown_kanji:
            errors.append(
                f"{field}'s example has kanji {'、'.join(unknown_kanji)} that no allowed word "
                "teaches; the mnemonic shows no furigana, so write those words with kanji "
                "the learner already knows or in kana"
            )

    # The sound-alike is usually shouted ("Oh! That one!"); count sentences on
    # the story with quoted speech collapsed, so its ! and ? end nothing.
    errors += _readability_errors(field, _QUOTED_RE.sub('"…"', story),
                                  GRAMMAR_STORY_MAX_SENTENCES, "sound-and-meaning")

    lowered = story.lower()
    origin = ctx["origin"]
    if origin:
        if not any(re.search(rf"\b{re.escape(k.lower())}", lowered) for k in origin["keywords"]):
            errors.append(
                f"{field}: the story must act out the origin {origin['word']} "
                f"\"{origin['gloss']}\" — name the action with one of: "
                f"{', '.join(origin['keywords'])}"
            )
    else:
        found = [p for p in GRAMMAR_ORIGIN_PHRASES if p in lowered]
        if found:
            errors.append(
                f"{field} states an origin ({', '.join(found)}), but this point has none "
                "in grammar_origins.json — let the sound hook carry the meaning"
            )
    return errors
```

Keyword match is a word-*start* match (`put` matches "puts"), not a whole-word match; this lets a story inflect the verb.

5. In `validate_draft`, before the `raise`, add:

```python
    if kind == "grammar":
        return validate_grammar(level, slug, draft, ctx, enforce_readability)
```

6. In `main()`, change `choices=["kanji", "radical", "vocab"]` to `choices=["kanji", "radical", "vocab", "grammar"]`.

- [ ] **Step 4: Run the tests**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: all PASS. If a reference example fails on length, print `len(_strip_tags(TEOKU_GOOD, ("reading","grammar")))` and report — do not widen the band without asking.

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate_content/validate_mnemonics.py curriculum/_build/generate_content/test_grammar_mnemonics.py
git commit -m "Grammar mnemonics: the gate"
```

---

### Task 4: Generator wiring and the prompt

**Files:**
- Create: `curriculum/_build/generate_content/prompts/grammar-mnemonic.md`
- Modify: `curriculum/_build/generate_content/generate_mnemonics.py`
- Modify: `curriculum/_build/generate_content/test_grammar_mnemonics.py`

**Interfaces:**
- Consumes: `mc.grammar_context`, `mc.format_grammar_origin`, `mc.format_grammar_cast`, `mc.load_grammar_origins`, `mc.origin_table_errors`, `mc.grammar_mnemonic_slugs` (Tasks 1–2); `validate_draft(kind="grammar")` (Task 3).
- Produces: `generate_mnemonics.require_reviewed_origins(table=None) -> None` (raises `SystemExit`); `PROMPT_VERSION["grammar"] == 1`; `KIND_DIR["grammar"] == "grammar"`; `sidecar_path("grammar")` → `curriculum/grammar/mnemonics.json`; sidecar entries `{"mnemonic_text": str, "_meta": {...}}`.

- [ ] **Step 1: Write the failing tests**

Append to `test_grammar_mnemonics.py`:

```python
from generate_content import generate_mnemonics as gm  # noqa: E402


class GeneratorWiringTest(unittest.TestCase):
    TABLE = GrammarContextTest.TABLE

    def test_prompt_has_every_token_filled(self):
        ctx = mc.grammar_context("n4", "teoku", self.TABLE)
        prompt = gm.build_user_prompt("grammar", ctx)
        self.assertNotIn("{{", prompt)
        self.assertIn("ておく", prompt)
        self.assertIn("置く", prompt)
        self.assertIn(gm.WEB_TOOL_LINE["grammar"], prompt)

    def test_web_prompt_swaps_the_tool_line(self):
        ctx = mc.grammar_context("n4", "teoku", self.TABLE)
        text = gm._web_prompt_text("n4", "grammar", ctx)
        self.assertNotIn(gm.WEB_TOOL_LINE["grammar"], text)
        self.assertIn('"mnemonic_text": "..."', text)

    def test_unreviewed_table_is_refused(self):
        # Complete, so the only thing wrong is the status.
        draft = {"review_status": "draft",
                 "origins": {slug: None for slug in mc.grammar_mnemonic_slugs()}}
        with self.assertRaises(SystemExit) as raised:
            gm.require_reviewed_origins(draft)
        self.assertIn("not reviewed", str(raised.exception))

    def test_incomplete_table_is_refused(self):
        with self.assertRaises(SystemExit) as raised:
            gm.require_reviewed_origins({"review_status": "reviewed", "origins": {}})
        self.assertIn("has no entry for", str(raised.exception))

    def test_sidecar_lives_with_grammar(self):
        self.assertTrue(gm.sidecar_path("grammar").endswith("curriculum/grammar/mnemonics.json"))
        self.assertEqual(gm.PROMPT_VERSION["grammar"], 1)
```

- [ ] **Step 2: Run to see them fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: FAIL — `KeyError: 'grammar'` / `AttributeError: ... require_reviewed_origins`.

- [ ] **Step 3: Write the prompt**

Create `curriculum/_build/generate_content/prompts/grammar-mnemonic.md`:

````markdown
# Write the mnemonic for one {{LEVEL}} grammar point

The learner meets 「{{FORM}}」 in a sentence and has to remember what it means.
Your mnemonic gives them a hook: a tiny story in which someone says an English
word that **sounds like** the form, and saying it **is** the meaning. Then a very
short Japanese example shows where the form goes. Follow the teaching voice above.

## The point

- Form: {{FORM}} (accepted forms: {{ACCEPTED_FORMS}})
- Meaning: {{MEANING}}
- Structure: {{STRUCTURE}}
- Family: {{FAMILY}}

How the lesson opens (for the meaning only — do not repeat it):

{{LESSON_OPENING}}

## Origin

{{ORIGIN}}

## What to write

One `mnemonic_text`: a story of **one sentence, or two short ones**, then **one
Japanese example sentence ending in 。**. 100–240 characters in total, tags not
counted. Most sentences under 18 words, none over 25.

1. **Sound + meaning, one joke.** A character in a concrete scene says or does an
   English sound-alike of the form, and that is the meaning. For a long form,
   hook the part that carries the meaning (しまう in てしまう, not て).
2. **The example.** The last sentence: Japanese only, the form attached to a
   word, ending in 。. Use only words from the allowed list below, and only kanji
   those words contain — the learner sees no furigana here.

Tags — only these two:

- `<reading>` around the English sound-alike, and around the form's kana inside
  the example: `"<reading>OK</reading>"` … `買っ<reading>ておく</reading>。`
- `<grammar>` around the English words that state the meaning:
  `<grammar>ready for later</grammar>`.

These are the target:

> The night before the picnic, Koichi buys the drinks, puts them down by the door
> and nods "<reading>OK</reading>": all set <grammar>for later</grammar>. 買っ<reading>ておく</reading>。

> Little Shima eats the whole birthday cake, every last crumb, then whispers
> "<reading>shh, Ma!</reading>", because it is <grammar>all gone, and oops</grammar>. 食べ<reading>てしまう</reading>。

> At the market, Grandma Kane jabs a finger at one fish and cries "<reading>Oh!</reading>
> That one!", so the seller knows <grammar>exactly what</grammar> she will buy. 魚<reading>を</reading>買う。

> Sei stands up in class and asks "<reading>Wha</reading>t about me?", and now everyone
> knows <grammar>the topic</grammar> of her next sentence. 私<reading>は</reading>学生です。

Never explain grammar terms, never compare with other points, never invent a
history for the form.

## Cast

{{CAST_BLOCK}}

## Words allowed in the example

{{ALLOWED_VOCAB}}
{{VALIDATOR_FEEDBACK}}

Call the `submit_grammar_mnemonic` tool exactly once with:

- `mnemonic_text`: the story and the example, with the tags.
````

- [ ] **Step 4: Wire the generator**

In `generate_mnemonics.py`:

1. Change `PROMPT_VERSION = {"radical": 1, "kanji": 4, "vocab": 6}` to `PROMPT_VERSION = {"radical": 1, "kanji": 4, "vocab": 6, "grammar": 1}` and add above it, at the end of the comment block:

```python
#: Grammar starts at 1 (grammar mnemonics spec, 2026-10-17): a one- or
#: two-sentence story tying an English sound-alike of the form to its meaning,
#: ending on a Japanese example. Prompt changes during the pilot need no bump:
#: nothing is reviewed until the pilot is.
```

2. Add to `SUBMIT_TOOLS`:

```python
    "grammar": {
        "name": "submit_grammar_mnemonic",
        "description": "Submit the completed mnemonic for one grammar point. Call exactly once.",
        "strict": True,
        "input_schema": {
            "type": "object",
            "additionalProperties": False,
            "required": ["mnemonic_text"],
            "properties": {"mnemonic_text": {"type": "string"}},
        },
    },
```

3. `PROMPT_FILES["grammar"] = "grammar-mnemonic.md"` (add the entry to the dict literal) and `KIND_DIR` gains `"grammar": "grammar"`.
4. In `build_user_prompt`, replace the final `else:` branch's head with an explicit radical branch and add grammar before it:

```python
    elif kind == "grammar":
        subs = {
            "{{LEVEL}}": ctx["level"].upper(),
            "{{FORM}}": ctx["form"],
            "{{ACCEPTED_FORMS}}": "、".join(ctx["accepted_forms"]),
            "{{MEANING}}": ctx["meaning"],
            "{{STRUCTURE}}": ctx["structure"],
            "{{FAMILY}}": ctx["family"] or "(none)",
            "{{LESSON_OPENING}}": ctx["lesson_opening"],
            "{{ORIGIN}}": mc.format_grammar_origin(ctx["origin"]),
            "{{CAST_BLOCK}}": mc.format_grammar_cast(),
            "{{ALLOWED_VOCAB}}": grammar_pool_context.format_vocab_list(ctx["allowed_vocab"]),
            "{{VALIDATOR_FEEDBACK}}": _feedback_block(validator_errors),
        }
```

and add the import `from generate_content import context as grammar_pool_context  # noqa: E402` next to the other `generate_content` imports.

5. `_context_for`: add `"grammar": mc.grammar_context` to the builder dict.
6. `WEB_SKELETON["grammar"] = '```json\n{\n  "mnemonic_text": "..."\n}\n```'`.
7. Add after `_default_slugs`:

```python
def require_reviewed_origins(table=None):
    """Grammar generation runs only on a complete, reviewed origin table: an
    origin the maintainer has not checked must never reach a story."""
    table = table or mc.load_grammar_origins()
    errors = mc.origin_table_errors(table, mc.grammar_mnemonic_slugs())
    if errors:
        raise SystemExit("grammar_origins.json cannot drive generation:\n"
                         + "\n".join(f"- {e}" for e in errors))
    if table["review_status"] != "reviewed":
        raise SystemExit("grammar_origins.json is not reviewed yet; the maintainer "
                         "sets \"review_status\": \"reviewed\" after checking every origin")
```

8. In `main()`: `choices=["kanji", "radical", "vocab", "grammar"]`; after `args = parser.parse_args()` add:

```python
    if args.kind == "grammar":
        require_reviewed_origins()
```

Note `test_incomplete_table_is_refused` passes an empty `origins` with the real scope, so `origin_table_errors` reports 161 missing slugs — the message contains "has no entry for".

- [ ] **Step 5: Run the tests**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_grammar_mnemonics -v`
Expected: all PASS. Then `.venv/bin/python -m generate_content.generate_mnemonics requests --type grammar --level n5 --slugs wa-topic` → `SystemExit: grammar_origins.json is not reviewed yet …` (the table is still a draft — correct).

- [ ] **Step 6: Commit**

```bash
git add curriculum/_build/generate_content/prompts/grammar-mnemonic.md curriculum/_build/generate_content/generate_mnemonics.py curriculum/_build/generate_content/test_grammar_mnemonics.py
git commit -m "Grammar mnemonics: --type grammar and its prompt"
```

---

### Task 5: Build — inline the sidecar, schema field, remove seeds

**Files:**
- Modify: `curriculum/_build/generate.py`
- Modify: `curriculum/schema/curriculum.schema.json`
- Modify: `curriculum/_build/n5_grammar.py`, `curriculum/_build/n4_grammar.py`
- Modify: `curriculum/_build/generate_content/test_generate_grammar_level.py`

**Interfaces:**
- Consumes: sidecar shape from Task 4.
- Produces: `generate.GRAMMAR_MNEMONICS_PATH`; `_build_grammar_level(..., mnemonic_entries=None)`; grammar items carry `mnemonic_text` when the sidecar has one.

- [ ] **Step 1: Write the failing tests**

Append to `test_generate_grammar_level.py` (inside the module, new class):

```python
from unittest import mock  # noqa: E402


class GrammarMnemonicInlineTest(unittest.TestCase):
    ENTRY = {"mnemonic_text": "A story. 寒いから。",
             "_meta": {"generator_model": "m", "prompt_version": "1", "review_status": "draft"}}

    def build_with(self, entries):
        return generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, (), known_vocab_forms=VOCAB, mnemonic_entries=entries
        )["items"][0]

    def test_sidecar_text_is_inlined(self):
        item = self.build_with({"zz-test-kara": self.ENTRY})
        self.assertEqual(item["mnemonic_text"], "A story. 寒いから。")
        self.assertEqual(item["_meta"]["review_status"], "draft")

    def test_no_entry_means_no_field(self):
        self.assertNotIn("mnemonic_text", self.build_with({}))

    def test_draft_mnemonic_keeps_a_reviewed_lesson_behind_the_gate(self):
        lesson = ({"review_status": "reviewed", "generator_model": "lesson-model"}, "Body.")
        with mock.patch.object(generate, "_load_lesson", return_value=lesson):
            item = self.build_with({"zz-test-kara": self.ENTRY})
        self.assertEqual(item["_meta"]["review_status"], "draft")
        self.assertEqual(item["_meta"]["generator_model"], "lesson-model")


class GrammarSeedsRemovedTest(unittest.TestCase):
    def test_no_skeleton_entry_has_a_mnemonic_seed(self):
        from n4_grammar import N4_GRAMMAR
        from n5_grammar import N5_GRAMMAR
        self.assertEqual([g["slug"] for g in N5_GRAMMAR + N4_GRAMMAR if "mnemonic" in g], [])
```

- [ ] **Step 2: Run to see them fail**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level -v`
Expected: FAIL — `TypeError: _build_grammar_level() got an unexpected keyword argument 'mnemonic_entries'`, and the seeds test lists 161 slugs.

- [ ] **Step 3: Implement**

`generate.py`:
1. After `VOCAB_MNEMONICS_PATH = ...` add:

```python
#: Grammar mnemonic sidecar (docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md),
#: inlined into grammar items as `mnemonic_text`. Absent until the grammar
#: generator has run.
GRAMMAR_MNEMONICS_PATH = os.path.join(CURRICULUM_DIR, "grammar", "mnemonics.json")
```

2. Signature: `def _build_grammar_level(jlpt_level, grammar_entries, vocab_forms, known_readings=None, all_grammar_slugs=(), known_vocab_forms=None, pool_entries=None, mnemonic_entries=None):`
3. At the end of the per-item loop, directly before `items.append(item)`, add:

```python
        mnemonic = (mnemonic_entries or {}).get(g["slug"])
        if mnemonic and mnemonic.get("mnemonic_text"):
            item["mnemonic_text"] = mnemonic["mnemonic_text"]
            # The least reviewed of lesson and mnemonic wins, so a draft
            # mnemonic keeps a reviewed lesson behind compile's draft gate.
            _merge_sidecar_meta(item, _sidecar_meta(mnemonic))
```

4. Both callers pass the sidecar: in `build_grammar_point` add `mnemonic_entries=_load_sidecar(GRAMMAR_MNEMONICS_PATH),` to the `_build_grammar_level(` call; in the `write_json(... "grammar" ...)` call add `mnemonic_entries=_load_sidecar(GRAMMAR_MNEMONICS_PATH),` after `pool_entries=load_pool_sidecar(),`.

Schema — in `grammarItem.properties`, after `"meaning"` add:

```json
        "mnemonic_text": { "type": "string", "minLength": 1 },
```

Seeds — remove the 161 seed lines and the field from both docstrings:

```bash
cd curriculum/_build
sed -i '' '/^        "mnemonic": "/d' n5_grammar.py n4_grammar.py
sed -i '' 's/  slug, primary_form, meaning, structure, mnemonic, conjugation_rules (dict),/  slug, primary_form, meaning, structure, conjugation_rules (dict),/' n5_grammar.py n4_grammar.py
grep -c '"mnemonic"' n5_grammar.py n4_grammar.py
```

Expected: both counts `0`. Each seed is one line with 8-space indent (74 in N5, 87 in N4); check `git diff --stat` shows exactly 75 and 88 deletions.

- [ ] **Step 4: Run tests and regenerate**

Run: `cd curriculum/_build && .venv/bin/python -m unittest generate_content.test_generate_grammar_level generate_content.test_grammar_mnemonics -v`
Expected: all PASS.
Then from the repo root: `curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5 && curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n4 && git status --short curriculum/grammar`
Expected: `curriculum/grammar/n5.json` and `n4.json` unchanged (no sidecar yet, and seeds never reached the JSON).

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/generate.py curriculum/schema/curriculum.schema.json curriculum/_build/n5_grammar.py curriculum/_build/n4_grammar.py curriculum/_build/generate_content/test_generate_grammar_level.py
git commit -m "Curriculum: inline grammar mnemonics; drop the unused seeds"
```

---

### Task 6: Compile grammar `mnemonic_text`

**Files:**
- Modify: `scripts/compile-curriculum.ts:153-171` (type), `:898` (insert)
- Modify: `scripts/__fixtures__/valid/grammar/n5.json`
- Modify: `scripts/compile-curriculum.test.ts:493-496`

**Interfaces:**
- Consumes: schema field from Task 5.
- Produces: `items.mnemonic_text` set for grammar rows.

- [ ] **Step 1: Write the failing test**

In `scripts/__fixtures__/valid/grammar/n5.json`, add to the `desu` item after `"meaning": "copula",`:

```json
      "mnemonic_text": "A waiter bows and says \"<reading>dess</reading>\": <grammar>polite is</grammar>. 本<reading>です</reading>。",
```

In `scripts/compile-curriculum.test.ts`, replace

```ts
      expect(grammarMnemonic.mnemonic_text).toBeNull();
```

with

```ts
      expect(grammarMnemonic.mnemonic_text).toBe(
        'A waiter bows and says "<reading>dess</reading>": <grammar>polite is</grammar>. 本<reading>です</reading>。',
      );
```

- [ ] **Step 2: Run to see it fail**

Run: `npx jest --config jest.config.cjs scripts/compile-curriculum.test.ts -t "Rev 1 fields"` (the test that holds the grammar assertion)
Expected: FAIL — received `null`.

- [ ] **Step 3: Implement**

In `type GrammarItem`, after `meaning: string;` add `mnemonic_text?: string;`. In the grammar `insertItem.run({...})`, change `mnemonic_text: null,` to `mnemonic_text: grammarItem.mnemonic_text ?? null,`.

- [ ] **Step 4: Run tests**

Run: `npx jest --config jest.config.cjs scripts/` and `npm run validate-schema`
Expected: all PASS; validate-schema clean (pre-existing warnings only).

- [ ] **Step 5: Commit**

```bash
git add scripts/compile-curriculum.ts scripts/compile-curriculum.test.ts scripts/__fixtures__/valid/grammar/n5.json
git commit -m "Compile: write grammar mnemonic_text"
```

---

### Task 7: Mobile — the `<grammar>` highlight tag

**Files:**
- Modify: `mobile/src/utils/highlightTags.ts`
- Modify: `mobile/src/components/common/AnnotatedText.tsx`
- Modify: `mobile/src/components/common/AnnotatedText.test.tsx`
- Modify: `mobile/src/utils/mnemonicAccessibilityLabel.test.ts`

**Interfaces:**
- Produces: `HIGHLIGHT_TAG_RE` matches `grammar`; `AnnotatedText` renders `<grammar>` as `font-ui-bold text-primary`.

- [ ] **Step 1: Write the failing tests**

Add to `AnnotatedText.test.tsx` inside the `describe`:

```tsx
  it('marks a grammar meaning in bold primary text, apart from the gold reading', () => {
    render(
      <AnnotatedText text={'says "<reading>OK</reading>": all set <grammar>for later</grammar>.'} />,
    );

    const meaning = screen.getByText('for later').props.className;
    const sound = screen.getByText('OK').props.className;

    // The grammar accent is the same gold as the reading token, so the meaning
    // takes the primary text colour instead (grammar mnemonics spec §2).
    expect(meaning).toContain('font-ui-bold');
    expect(meaning).toContain('text-primary');
    expect(meaning).not.toContain('text-mnemonic-reading');
    expect(sound).toContain('text-mnemonic-reading');
  });
```

Add to `mnemonicAccessibilityLabel.test.ts`:

```ts
  it('strips the reading and grammar tags a grammar mnemonic carries', () => {
    expect(
      buildMnemonicAccessibilityLabel(
        'Koichi nods "<reading>OK</reading>": all set <grammar>for later</grammar>.',
        'do in advance',
        'ておく',
      ),
    ).toBe('Koichi nods "OK": all set for later.');
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `cd mobile && npx jest src/components/common/AnnotatedText.test.tsx src/utils/mnemonicAccessibilityLabel.test.ts`
Expected: FAIL — the raw `<grammar>` markup renders as text.

- [ ] **Step 3: Implement**

`highlightTags.ts`: change the regex to

```ts
export const HIGHLIGHT_TAG_RE =
  /<(radical|part|kanji|vocabulary|reading|grammar)(?: form="([^"<>]*)")?>([\s\S]*?)<\/\1>/g;
```

and add to its doc comment: "A grammar mnemonic marks its meaning with `<grammar>` (grammar mnemonics spec, 2026-10-17)."

`AnnotatedText.tsx`: the `Segment['tag']` union gains `| 'grammar'`; `TAG_ACCENT` gains

```ts
  // A grammar mnemonic's meaning. The grammar accent is the reading token's
  // gold, and both tags sit in the same sentence, so the meaning takes the
  // primary text colour: bold is the highlight.
  grammar: 'text-primary',
```

- [ ] **Step 4: Run tests and lint**

Run: `cd mobile && npx jest src/components/common/AnnotatedText.test.tsx src/utils/mnemonicAccessibilityLabel.test.ts && npm run lint`
Expected: PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/utils/highlightTags.ts mobile/src/components/common/AnnotatedText.tsx mobile/src/components/common/AnnotatedText.test.tsx mobile/src/utils/mnemonicAccessibilityLabel.test.ts
git commit -m "Mobile: <grammar> highlight tag"
```

---

### Task 8: Mobile — mnemonic block on the detail page and lesson step 2

**Files:**
- Create: `mobile/src/components/learn/GrammarMnemonicBlock.tsx`
- Create: `mobile/src/components/learn/GrammarMnemonicBlock.test.tsx`
- Modify: `mobile/src/components/learn/GrammarDetail.tsx`, `GrammarDetail.test.tsx`
- Modify: `mobile/src/components/lesson/LessonItemSections.tsx`, `LessonItemSections.test.tsx`

**Interfaces:**
- Consumes: `AnnotatedText` with `<grammar>` (Task 7); `MNEMONIC_PROSE` from `ItemMnemonicSections`; `item.mnemonicText` (already selected by `itemRepository`).
- Produces: `GrammarMnemonicBlock({ mnemonicText }: { mnemonicText: string | null })`, testIDs `grammar-mnemonic` / `grammar-mnemonic-placeholder`.

- [ ] **Step 1: Write the failing tests**

`GrammarMnemonicBlock.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import React from 'react';

import { GrammarMnemonicBlock } from '@/components/learn/GrammarMnemonicBlock';

describe('GrammarMnemonicBlock', () => {
  it('renders the mnemonic under a Mnemonic heading', () => {
    render(<GrammarMnemonicBlock mnemonicText={'nods "<reading>OK</reading>": <grammar>for later</grammar>.'} />);

    expect(screen.getByTestId('grammar-mnemonic')).toBeTruthy();
    expect(screen.getByText('Mnemonic')).toBeTruthy();
    expect(screen.getByText('for later')).toBeTruthy();
  });

  it('says the mnemonic is coming when the point has none yet', () => {
    render(<GrammarMnemonicBlock mnemonicText={null} />);

    expect(screen.getByTestId('grammar-mnemonic-placeholder')).toBeTruthy();
    expect(screen.getByText('Mnemonic coming soon')).toBeTruthy();
  });
});
```

`GrammarDetail.test.tsx`: replace the test `never renders a curriculum mnemonic, only the learner-owned one` with:

```tsx
  it('renders the curriculum mnemonic before the lesson body, and the learner-owned one', () => {
    render(
      <GrammarDetail
        item={{ ...baseItem, mnemonicText: 'A waiter says "<reading>dess</reading>": <grammar>polite is</grammar>. 本です。' }}
        acceptedAnswers={acceptedAnswers}
        grammarRule={{ ...grammarRule, explanationMarkdown: 'The lesson.' }}
        exampleSentences={exampleSentences}
      />,
    );

    expect(screen.getByTestId('grammar-mnemonic')).toBeTruthy();
    expect(screen.getByText('polite is')).toBeTruthy();
    const ids = screen.UNSAFE_root
      .findAll((node) => typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string);
    expect(ids.indexOf('grammar-mnemonic')).toBeLessThan(ids.indexOf('grammar-lesson-body'));
    expect(screen.getByTestId('personal-mnemonic-editor')).toBeTruthy();
  });
```

`LessonItemSections.test.tsx`, in `describe('LessonMnemonicSectionView — grammar')`: in the first test, replace the two comment lines and `expect(screen.queryByTestId('lesson-mnemonic-empty')).toBeNull();` with

```tsx
    // No curriculum mnemonic yet on this fixture: the block says so.
    expect(screen.getByTestId('grammar-mnemonic-placeholder')).toBeTruthy();
```

and add a test:

```tsx
  it('puts the mnemonic above the rules', () => {
    render(
      <LessonMnemonicSectionView
        {...props}
        item={{ ...item, mnemonicText: 'Sei asks "<reading>Wha</reading>t about me?": <grammar>the topic</grammar>. 私は学生です。' }}
      />,
    );

    const ids = screen.UNSAFE_root
      .findAll((node) => typeof node.props.testID === 'string')
      .map((node) => node.props.testID as string);
    expect(ids.indexOf('grammar-mnemonic')).toBeGreaterThan(-1);
    expect(ids.indexOf('grammar-mnemonic')).toBeLessThan(ids.indexOf('grammar-how-it-works'));
  });
```

- [ ] **Step 2: Run to see them fail**

Run: `cd mobile && npx jest src/components/learn/GrammarMnemonicBlock.test.tsx src/components/learn/GrammarDetail.test.tsx src/components/lesson/LessonItemSections.test.tsx`
Expected: FAIL — module `GrammarMnemonicBlock` not found.

- [ ] **Step 3: Implement**

`GrammarMnemonicBlock.tsx`:

```tsx
import React from 'react';
import { View } from 'react-native';

import { AnnotatedText } from '@/components/common/AnnotatedText';
import { ContentPlaceholderNotice } from '@/components/common/ContentPlaceholderNotice';
import { SectionHeading } from '@/components/common/SectionHeading';
import { MNEMONIC_PROSE } from '@/components/learn/ItemMnemonicSections';

type GrammarMnemonicBlockProps = {
  mnemonicText: string | null;
};

/**
 * A grammar point's curriculum mnemonic (grammar mnemonics spec §7): a short
 * story in which an English sound-alike of the form is its meaning, ending on a
 * Japanese example. Every N5/N4 point gets one, so a missing one is content the
 * pipeline has not reached yet and says so, the same as a vocabulary word.
 */
export function GrammarMnemonicBlock({ mnemonicText }: GrammarMnemonicBlockProps) {
  return (
    <View
      className="mt-space-md"
      testID={mnemonicText ? 'grammar-mnemonic' : 'grammar-mnemonic-placeholder'}>
      <SectionHeading label="Mnemonic" />
      {mnemonicText ? (
        <AnnotatedText text={mnemonicText} className={MNEMONIC_PROSE} />
      ) : (
        <ContentPlaceholderNotice label="Mnemonic coming soon" />
      )}
    </View>
  );
}
```

`GrammarDetail.tsx`: import `GrammarMnemonicBlock` (alphabetical, after `GrammarUsesSection`), and render it directly after `<AcceptedAnswersDisclosure acceptedAnswers={acceptedAnswers} />`:

```tsx
      <GrammarMnemonicBlock mnemonicText={item.mnemonicText} />
```

`LessonItemSections.tsx`:
1. Import `GrammarMnemonicBlock` next to `GrammarUsesSection`.
2. Replace `/** Grammar carries no mnemonic: its second section teaches the rules instead. */` with `/** Grammar's second section is its mnemonic followed by the rules, so its pill reads "Usage". */`.
3. In the `LessonMnemonicSectionView` doc comment, replace the paragraph starting "Grammar has no mnemonic of its own" with: "Grammar shows its curriculum mnemonic first, then the essay's rules section — the stepper calls the page "Usage" for grammar."
4. Grammar branch body becomes:

```tsx
      <View testID="lesson-section-mnemonic">
        <GrammarMnemonicBlock mnemonicText={item.mnemonicText} />

        {rules ? <GrammarRulesSection markdown={rules} /> : null}

        <PersonalMnemonicEditor itemId={item.id} />
      </View>
```

- [ ] **Step 4: Run tests and lint**

Run: `cd mobile && npx jest src/components/learn src/components/lesson && npm run lint`
Expected: PASS, lint clean.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/components/learn/GrammarMnemonicBlock.tsx mobile/src/components/learn/GrammarMnemonicBlock.test.tsx mobile/src/components/learn/GrammarDetail.tsx mobile/src/components/learn/GrammarDetail.test.tsx mobile/src/components/lesson/LessonItemSections.tsx mobile/src/components/lesson/LessonItemSections.test.tsx
git commit -m "Mobile: grammar mnemonic on the detail page and lesson step 2"
```

---

### Task 9: Mobile — Browse "No mnemonic" pill covers grammar

**Files:**
- Modify: `mobile/src/data/curriculum/browseRepository.ts:231-234`
- Modify: `mobile/src/data/curriculum/browseRepository.test.ts`

- [ ] **Step 1: Write the failing test**

In `describe('buildBrowsePageQuery')` add:

```ts
  it('treats grammar like every other type for the No mnemonic pill', () => {
    const query = buildBrowsePageQuery(input(), { limit: 40, offset: 0 });

    expect(query?.sql).not.toContain("i.item_type = 'grammar' OR");
    expect(query?.sql).toContain('(i.mnemonic_text IS NOT NULL');
  });
```

- [ ] **Step 2: Run to see it fail**

Run: `cd mobile && npx jest src/data/curriculum/browseRepository.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Replace

```ts
      // Grammar carries its prose in `grammar_rules.explanation_markdown`, not
      // in a mnemonic column, so it is never a skeleton row.
      ` (i.item_type = 'grammar' OR i.mnemonic_text IS NOT NULL` +
```

with

```ts
      // Grammar has a curriculum mnemonic too (grammar mnemonics spec), so it
      // shows the pill like every other type until its mnemonic ships.
      ` (i.mnemonic_text IS NOT NULL` +
```

- [ ] **Step 4: Run tests**

Run: `cd mobile && npx jest src/data/curriculum src/components/browse`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/data/curriculum/browseRepository.ts mobile/src/data/curriculum/browseRepository.test.ts
git commit -m "Browse: grammar shows No mnemonic until its mnemonic ships"
```

---

### Task 10: Studio server — mnemonic field, mnemonic status, merged row status

**Files:**
- Modify: `web/server/curriculum/sidecar.ts`
- Modify: `web/server/curriculum/writer.ts`
- Modify: `web/server/curriculum/api.ts`
- Create: `web/server/curriculum/grammarMnemonicStatus.test.ts`
- Modify: `package.json` (root) — `"test:studio"` script

**Interfaces:**
- Produces (sidecar.ts): `mergeGrammarReviewStatus(lesson: ReviewStatus, mnemonic: ReviewStatus | null): ReviewStatus`; `readGrammarMnemonicStatus(repoRoot, slug): ReviewStatus | null`; `readGrammarLessonStatus(repoRoot, slug): ReviewStatus`; `persistGrammarMnemonicReviewStatus(repoRoot, slug, reviewStatus): PersistResult`; `MNEMONIC_FIELDS.grammar = ['mnemonic_text']`.
- Produces (writer.ts): `updateGrammarMnemonicReviewStatus(repoRoot, level: JlptLevel, slug, reviewStatus): SaveResult`; `updateReviewStatus` / `updateReviewStatusBulk` write the merged status to grammar rows.
- Produces (api.ts): GET `/item/:type/:slug` adds `mnemonicReviewStatus: ReviewStatus | null` (non-null only for grammar with a sidecar entry); PATCH `/item/grammar/:slug/mnemonic-meta` with body `{ review_status }`.

- [ ] **Step 1: Write the failing tests**

Create `web/server/curriculum/grammarMnemonicStatus.test.ts`:

```ts
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import {
  mergeGrammarReviewStatus,
  persistGrammarMnemonicReviewStatus,
  readGrammarLessonStatus,
  readGrammarMnemonicStatus,
} from './sidecar.js';
import { updateGrammarMnemonicReviewStatus, updateReviewStatus } from './writer.js';

const REPO = path.resolve(import.meta.dirname, '../../..');

/** A scratch repo: the real curriculum (minus _build) plus a draft mnemonic for wa-topic. */
function scratchRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'studio-grammar-'));
  fs.cpSync(path.join(REPO, 'curriculum'), path.join(root, 'curriculum'), {
    recursive: true,
    filter: (src) => !src.includes(`${path.sep}_build`),
  });
  const sidecar = path.join(root, 'curriculum', 'grammar', 'mnemonics.json');
  fs.writeFileSync(
    sidecar,
    JSON.stringify({ 'wa-topic': { mnemonic_text: 'x', _meta: { review_status: 'draft' } } }, null, 2) + '\n',
  );
  return root;
}

function rowStatus(root: string, slug: string): unknown {
  const file = JSON.parse(fs.readFileSync(path.join(root, 'curriculum', 'grammar', 'n5.json'), 'utf8'));
  return file.items.find((i: { slug: string }) => i.slug === slug)._meta?.review_status;
}

test('merge keeps the least reviewed status, and none counts as absent', () => {
  assert.equal(mergeGrammarReviewStatus('reviewed', 'draft'), 'draft');
  assert.equal(mergeGrammarReviewStatus('reviewed', 'flagged_for_rewrite'), 'flagged_for_rewrite');
  assert.equal(mergeGrammarReviewStatus('reviewed', null), 'reviewed');
  assert.equal(mergeGrammarReviewStatus('none', 'draft'), 'draft');
  assert.equal(mergeGrammarReviewStatus('none', null), 'none');
});

test('reads the mnemonic and lesson statuses separately', () => {
  const root = scratchRepo();
  assert.equal(readGrammarMnemonicStatus(root, 'wa-topic'), 'draft');
  assert.equal(readGrammarMnemonicStatus(root, 'ga'), null);
  assert.equal(readGrammarLessonStatus(root, 'wa-topic'), 'reviewed');
});

test('mnemonic status writes only the sidecar', () => {
  const root = scratchRepo();
  const lesson = path.join(root, 'curriculum', 'grammar', 'lessons', 'wa-topic.md');
  const before = fs.readFileSync(lesson, 'utf8');
  assert.deepEqual(persistGrammarMnemonicReviewStatus(root, 'wa-topic', 'reviewed'), { ok: true });
  assert.equal(readGrammarMnemonicStatus(root, 'wa-topic'), 'reviewed');
  assert.equal(fs.readFileSync(lesson, 'utf8'), before);
});

test('mnemonic status refuses a point with no mnemonic entry', () => {
  const result = persistGrammarMnemonicReviewStatus(scratchRepo(), 'ga', 'reviewed');
  assert.equal(result.ok, false);
});

test('lesson status flip keeps the row at the mnemonic\'s draft', () => {
  const root = scratchRepo();
  assert.deepEqual(updateReviewStatus(root, 'grammar', 'N5', 'wa-topic', 'reviewed'), { ok: true });
  assert.equal(rowStatus(root, 'wa-topic'), 'draft');
});

test('mnemonic review lifts the row once the lesson is reviewed too', () => {
  const root = scratchRepo();
  assert.deepEqual(updateGrammarMnemonicReviewStatus(root, 'N5', 'wa-topic', 'reviewed'), { ok: true });
  assert.equal(rowStatus(root, 'wa-topic'), 'reviewed');
  assert.equal(readGrammarLessonStatus(root, 'wa-topic'), 'reviewed');
});
```

Add to the root `package.json` `scripts`: `"test:studio": "tsx --test web/server/**/*.test.ts"`.

Before writing the tests, confirm `wa-topic` is `reviewed` in `curriculum/grammar/lessons/wa-topic.md` frontmatter (all 161 are, per `curriculum/grammar/*.json`); if it is not, use a slug that is.

- [ ] **Step 2: Run to see them fail**

Run: `npm run test:studio`
Expected: FAIL — `SyntaxError: The requested module './sidecar.js' does not provide an export named 'mergeGrammarReviewStatus'`.

- [ ] **Step 3: Implement — sidecar.ts**

1. `MNEMONIC_FIELDS.grammar` → `['mnemonic_text']`.
2. Add after `persistGrammarReviewStatus`:

```ts
/** generate.py's `_merge_sidecar_meta` order: the least reviewed status wins. */
const STATUS_RANK: Record<Exclude<ReviewStatus, 'none'>, number> = {
  flagged_for_rewrite: 0,
  draft: 1,
  reviewed: 2,
};

/**
 * The status generate.py writes on a grammar row: the least reviewed of the
 * lesson's and the mnemonic's. 'none' (and a point with no mnemonic) counts as
 * absent, the same as a missing `review_status` key there.
 */
export function mergeGrammarReviewStatus(
  lesson: ReviewStatus,
  mnemonic: ReviewStatus | null,
): ReviewStatus {
  const present = [lesson, mnemonic].filter(
    (s): s is Exclude<ReviewStatus, 'none'> => s !== null && s !== 'none',
  );
  if (present.length === 0) return 'none';
  return present.reduce((a, b) => (STATUS_RANK[b] < STATUS_RANK[a] ? b : a));
}

/** The grammar mnemonic sidecar entry's own status; null when the point has no entry. */
export function readGrammarMnemonicStatus(repoRoot: string, slug: string): ReviewStatus | null {
  const file = readJsonFile<SidecarFile>(sidecarPath(repoRoot, 'grammar', 'mnemonics'), {});
  const entry = file[slug];
  if (!entry) return null;
  const status = (entry._meta as Record<string, unknown> | undefined)?.review_status;
  return typeof status === 'string' ? (status as ReviewStatus) : 'none';
}

/** `review_status:` from a grammar lesson's frontmatter; 'none' when it has none. */
export function readGrammarLessonStatus(repoRoot: string, slug: string): ReviewStatus {
  const filePath = lessonPath(repoRoot, slug);
  if (!fs.existsSync(filePath)) return 'none';
  const match = /^---\n([\s\S]*?)\n---\n/.exec(fs.readFileSync(filePath, 'utf8'));
  const line = match ? /^review_status:\s*(\S+)\s*$/m.exec(match[1]) : null;
  return line ? (line[1] as ReviewStatus) : 'none';
}

/**
 * Writes a grammar mnemonic's own review status to curriculum/grammar/mnemonics.json.
 * The lesson frontmatter is never touched, so reviewing a mnemonic cannot change
 * a reviewed lesson. A point with no mnemonic entry has nothing to review.
 */
export function persistGrammarMnemonicReviewStatus(
  repoRoot: string,
  slug: string,
  reviewStatus: ReviewStatus,
): PersistResult {
  const filePath = sidecarPath(repoRoot, 'grammar', 'mnemonics');
  const file = readJsonFile<SidecarFile>(filePath, {});
  if (!file[slug]) {
    return {
      ok: false,
      errors: [`${slug} has no entry in curriculum/grammar/mnemonics.json — generate its mnemonic first.`],
    };
  }
  const entry = { ...file[slug] };
  const meta = { ...((entry._meta as Record<string, unknown>) ?? {}) };
  if (reviewStatus === 'none') {
    delete meta.review_status;
  } else {
    meta.review_status = reviewStatus;
  }
  if (Object.keys(meta).length > 0) {
    entry._meta = meta;
  } else {
    delete entry._meta;
  }
  file[slug] = entry;
  writeJsonFile(filePath, file);
  return { ok: true };
}
```

- [ ] **Step 4: Implement — writer.ts**

1. Import `mergeGrammarReviewStatus`, `persistGrammarMnemonicReviewStatus`, `readGrammarLessonStatus`, `readGrammarMnemonicStatus` from `./sidecar.js`.
2. In `updateReviewStatus`, replace `applyReviewStatus(row, meta, reviewStatus);` with:

```ts
  // A grammar row carries the least reviewed of lesson and mnemonic, which is
  // what generate.py writes; anything else fails CI's regeneration check.
  const rowStatus =
    type === 'grammar'
      ? mergeGrammarReviewStatus(reviewStatus, readGrammarMnemonicStatus(repoRoot, slug))
      : reviewStatus;
  applyReviewStatus(row, meta, rowStatus);
```

3. In `updateReviewStatusBulk`, replace `applyReviewStatus(row, meta, reviewStatus);` with:

```ts
      const rowStatus =
        type === 'grammar'
          ? mergeGrammarReviewStatus(reviewStatus, readGrammarMnemonicStatus(repoRoot, slug))
          : reviewStatus;
      applyReviewStatus(row, meta, rowStatus);
```

4. Add after `updateReviewStatus`:

```ts
/**
 * A grammar mnemonic's own review status. The sidecar takes the status; the
 * shipped row takes the merge with the lesson's, as generate.py would write it.
 */
export function updateGrammarMnemonicReviewStatus(
  repoRoot: string,
  level: JlptLevel,
  slug: string,
  reviewStatus: ReviewStatus,
): SaveResult {
  const curriculumDir = path.join(repoRoot, 'curriculum');
  const opened = openLevelFile(curriculumDir, 'grammar', level);
  if ('errors' in opened) {
    return { ok: false, errors: opened.errors };
  }
  const { filePath, relative, file, rows } = opened;
  const index = rows.findIndex((row, i) => rowSlug('grammar', row, level, i) === slug);
  if (index === -1) {
    return { ok: false, errors: [`${relative}: no item with slug "${slug}"`] };
  }

  const row = rows[index];
  const meta = (row._meta && typeof row._meta === 'object' ? row._meta : {}) as Record<string, unknown>;
  applyReviewStatus(row, meta, mergeGrammarReviewStatus(readGrammarLessonStatus(repoRoot, slug), reviewStatus));

  const { errors } = validateFile(curriculumDir, relative, file);
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  const persisted = persistGrammarMnemonicReviewStatus(repoRoot, slug, reviewStatus);
  if (!persisted.ok) {
    return persisted;
  }
  writeLevelFile(filePath, file);
  reload(repoRoot);
  return { ok: true };
}
```

- [ ] **Step 5: Implement — api.ts**

1. Import `updateGrammarMnemonicReviewStatus` from `./writer.js` and `readGrammarMnemonicStatus` from `./sidecar.js`.
2. In GET `/item/:type/:slug`, add to the response object: `mnemonicReviewStatus: type === 'grammar' ? readGrammarMnemonicStatus(repoRoot, item.slug) : null,`.
3. After the PATCH `/item/:type/:slug/meta` route add:

```ts
  router.patch('/item/grammar/:slug/mnemonic-meta', (req: Request, res: Response) => {
    const index = getCurriculum(repoRoot);
    const item = index.bySlug.get(itemKey('grammar', req.params.slug));
    if (!item) {
      res.status(404).json({ error: 'Item not found' });
      return;
    }
    const reviewStatus = req.body?.review_status;
    if (!EDITABLE_STATUSES.includes(reviewStatus)) {
      res.status(400).json({
        ok: false,
        errors: [`review_status must be one of ${EDITABLE_STATUSES.join(', ')}`],
      });
      return;
    }
    const result = updateGrammarMnemonicReviewStatus(repoRoot, item.level, req.params.slug, reviewStatus);
    if (!result.ok) {
      res.status(400).json(result);
      return;
    }
    const updated = getCurriculum(repoRoot).bySlug.get(itemKey('grammar', req.params.slug));
    res.json({ ok: true, item: updated });
  });
```

- [ ] **Step 6: Run tests and lint**

Run: `npm run test:studio && (cd web && npm run lint)`
Expected: 6 tests PASS; lint clean.

- [ ] **Step 7: Commit**

```bash
git add web/server/curriculum/sidecar.ts web/server/curriculum/writer.ts web/server/curriculum/api.ts web/server/curriculum/grammarMnemonicStatus.test.ts package.json
git commit -m "Studio: grammar mnemonic field and its own review status"
```

---

### Task 11: Studio UI — show, edit and review the mnemonic; Guide stage

**Files:**
- Modify: `web/src/lib/mnemonicTags.tsx`, `web/src/theme.css`
- Modify: `web/src/lib/editSchema.ts`
- Modify: `web/src/components/ReviewStatusControl.tsx`
- Modify: `web/src/pages/detail/GrammarDetail.tsx`, `web/src/pages/ItemDetail.tsx`
- Modify: `web/src/types/api.ts`, `web/src/types/curriculumRaw.ts`
- Modify: `web/src/lib/guide.ts`, `web/server/curriculum/completeness.ts`

**Interfaces:**
- Consumes: Task 10's GET field `mnemonicReviewStatus` and PATCH route.
- Produces: `ReviewStatusControl` prop `endpoint?: 'meta' | 'mnemonic-meta'` (default `'meta'`); `GrammarDetail` props gain `slug: string`, `mnemonicReviewStatus: ReviewStatus | null`, `onChanged: () => void`.

- [ ] **Step 1: Tag rendering**

`mnemonicTags.tsx`: `TAG_PATTERN` becomes `/<(radical|part|kanji|vocabulary|reading|grammar)(?: form="([^"<>]*)")?>(.*?)<\/\1>/g`; the doc comment lists `<grammar>`. `theme.css`, after `.mnemonic-tag--reading`:

```css
/* A grammar mnemonic's meaning. The app shows it bold in the primary text
   colour (the grammar gold is taken by <reading>), so no fill here either. */
.mnemonic-tag--grammar {
  color: var(--text);
}
```

- [ ] **Step 2: Edit field and types**

`editSchema.ts`, grammar list: after the `meaning` entry add `{ key: 'mnemonic_text', label: 'Mnemonic', kind: 'textarea' },` (editable — Task 10 made it sidecar-backed). Update the grammar note string at line 34 to: `'Grammar is rebuilt from curriculum/_build/{n5,n4}_grammar.py, curriculum/grammar/lessons/<slug>.md and curriculum/grammar/mnemonics.json — only the mnemonic is editable here.'`.
`curriculumRaw.ts` `GrammarRaw`: add `mnemonic_text?: string;`. `api.ts` (types) `ItemDetailResponse`: add `mnemonicReviewStatus: ReviewStatus | null;`.

- [ ] **Step 3: Status control endpoint**

`ReviewStatusControl.tsx`: add prop `endpoint?: 'meta' | 'mnemonic-meta'` to `Props`, destructure with default `'meta'`, and use `` `/api/item/${type}/${slug}/${endpoint}` `` in the fetch.

- [ ] **Step 4: Grammar page panel**

`GrammarDetail.tsx` (Studio): add imports `MnemonicText` from `../../lib/mnemonicTags`, `ReviewStatusControl` from `../../components/ReviewStatusControl`, `StatusBadge` from `../../components/StatusBadge`, and `type ReviewStatus` from `../../types/api`. Props gain `slug: string; mnemonicReviewStatus: ReviewStatus | null; onChanged: () => void;`. Insert after the Structure block (after the `raw.family` line):

```tsx
      <h3 className="panel-title">Mnemonic</h3>
      {raw.mnemonic_text ? (
        <>
          <p className="mnemonic-text">
            <MnemonicText text={raw.mnemonic_text} />
          </p>
          <div className="item-header__badges">
            <span className="panel-muted">Mnemonic status:</span>
            <StatusBadge status={mnemonicReviewStatus ?? 'none'} />
            <ReviewStatusControl
              type="grammar"
              slug={slug}
              status={mnemonicReviewStatus ?? 'none'}
              endpoint="mnemonic-meta"
              onChanged={onChanged}
            />
          </div>
        </>
      ) : (
        <p className="panel-muted">No mnemonic yet.</p>
      )}
```

`ItemDetail.tsx`: `TypeSection` takes `onChanged: () => void` and passes `slug={item.slug} mnemonicReviewStatus={item.mnemonicReviewStatus} onChanged={onChanged}` to `GrammarDetail`; the call site of `TypeSection` passes `onChanged={refresh}`. Check `StatusBadge` accepts `'none'` (it receives `item.reviewStatus`, whose type includes `'none'`).

- [ ] **Step 5: Guide stage and completeness**

`completeness.ts` grammar list: add `{ name: 'mnemonic_text', ok: (r) => isNonEmptyString(r.mnemonic_text) },` first.
`guide.ts`: change `mnemonicLanes(kind: 'radical' | 'kanji' | 'vocab')` to accept `'grammar'` too (the `dir` expression already maps non-vocab kinds to themselves). Add a stage after `mnemonics-vocab`, same shape as it:

```ts
  {
    id: 'mnemonics-grammar',
    title: 'Grammar mnemonics',
    what: 'A one- or two-sentence story in which an English sound-alike of the form is its meaning, ending on a Japanese example.',
    produces: [{ type: 'grammar', field: 'mnemonic_text' }],
    requires: ['facts'],
    requiresNote:
      'curriculum/_build/grammar_origins.json must be complete and set to "reviewed" first — the generator refuses otherwise.',
    lanes: mnemonicLanes('grammar'),
    finish: assembleSteps(),
  },
```

If `requires: ['facts']` is not a valid stage id in this file, use the id the `examples-vocab` stage uses.

- [ ] **Step 6: Build, lint, look**

Run: `(cd web && npm run lint && npm run build)`; then `npm run studio`, open `http://localhost:4701` → a grammar item. Expected: a "Mnemonic" panel with "No mnemonic yet." (no sidecar yet); the Guide lists "Grammar mnemonics". Stop the server.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/mnemonicTags.tsx web/src/theme.css web/src/lib/editSchema.ts web/src/components/ReviewStatusControl.tsx web/src/pages/detail/GrammarDetail.tsx web/src/pages/ItemDetail.tsx web/src/types/api.ts web/src/types/curriculumRaw.ts web/src/lib/guide.ts web/server/curriculum/completeness.ts
git commit -m "Studio: show, edit and review grammar mnemonics"
```

---

### Task 12: Workflow runbooks accept `grammar`

**Files:**
- Modify: `docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow.md`
- Modify: `docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow-automation-prompt.md`
- Modify: `docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md`
- Modify: `docs/workflows/radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md`
- Modify: `docs/workflows/README.md`

- [ ] **Step 1: Edit each automation prompt**

In each of the three automation prompts:
1. The type line "Content type (one of `radical`, `kanji` or `vocab`)" → "(one of `radical`, `kanji`, `vocab` or `grammar`)".
2. In the auto-select script comment `# KIND: 'radical', 'kanji' or 'vocab'` → add `or 'grammar'`. No code change is needed: `KIND_DIR['grammar']` is `'grammar'` and grammar has no components, so it falls back to sequential groups like radicals.
3. Directly after the layer-order paragraph ("So a layer must be finished…"), add:

```markdown
**Grammar** sits outside the radical → kanji → vocab chain: its prompt uses no
other layer's prose, so it can run at any time. Two conditions instead:
`curriculum/_build/grammar_origins.json` must cover every N5/N4 grammar slug and
carry `"review_status": "reviewed"` (every command with `--type grammar` stops
with an error otherwise — report it, do not edit the file yourself), and only
`--level n5` and `--level n4` have grammar in scope. The gate rules are in
`validate_mnemonics.validate_grammar`: one or two story sentences plus a
Japanese example ending in 。, `<reading>` on the English sound-alike and on the
form's kana, `<grammar>` on the meaning, example words and kanji at or below
the level, and the origin's keyword in the story (or no origin claim at all).
After ingesting grammar, run `generate.py --level <level>` (grammar is not banded).
```

4. Where a type-specific writing rule list exists (e.g. the subagent prompt's "For vocab, obey the reading block exactly" bullet), add a sibling bullet: "**For grammar, the sound-alike and the meaning are one joke** — a character says the English sound-alike while doing the meaning; the story acts out the origin when the prompt gives one, and never states an origin when it says there is none."

- [ ] **Step 2: Edit the reference workflow and README**

`radical-kanji-vocab-mnemonic-web-chat-workflow.md`: add a short "Grammar" section with the same paragraph as Step 1.3 plus the spec link `docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md`. `docs/workflows/README.md`: table row label "Radical / kanji / vocab mnemonics" → "Radical / kanji / vocab / grammar mnemonics".

- [ ] **Step 3: Commit**

```bash
git add docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow.md docs/workflows/radical-kanji-vocab-mnemonic-web-chat-workflow-automation-prompt.md docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md docs/workflows/radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md docs/workflows/README.md
git commit -m "Workflows: grammar as a mnemonic type"
```

---

### Task 13: Origin review, then the pilot (maintainer gates)

**Files:**
- Modify: `curriculum/_build/grammar_origins.json` (maintainer's changes only)
- Create (generated): `curriculum/grammar/mnemonics.json`
- Modify (generated): `curriculum/grammar/n5.json`, `curriculum/grammar/n4.json`

- [ ] **Step 1: Ask for the origin review — STOP**

Show the maintainer the origin entries (only the non-null ones, as `slug — form — word "gloss" [keywords]`) and the count of nulls. Ask them to correct entries and to set `"review_status": "reviewed"`. Do not continue until the file says `reviewed` and `test_shipped_table_covers_exactly_the_scope` passes.

- [ ] **Step 2: Generate the pilot**

Pilot slugs: N5 `wa-topic,wo,ga,desu,masu,mashou,te-iru,tai,kara-because`; N4 `teoku`. Use the subagent lane (`docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md`) with `<type = grammar>`, but pass these slugs instead of the auto-select list:

```bash
cd curriculum/_build
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type grammar --level n5 --slugs wa-topic,wo,ga,desu,masu,mashou,te-iru,tai,kara-because
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type grammar --level n4 --slugs teoku
```

Write each reply to `generate_content/web/mnemonics/<level>/grammar/<slug>.reply.md` and ingest:

```bash
.venv/bin/python -m generate_content.generate_mnemonics ingest --type grammar --level <level> --slug <slug> --model <subagent-model>
```

Expected: 10 PASS lines; `curriculum/grammar/mnemonics.json` has 10 entries, all `review_status: draft`.

- [ ] **Step 3: Regenerate and look**

Run (repo root): `curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5 && curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n4`, then `npm run validate-schema`. Expected: 10 grammar items gain `mnemonic_text` and `_meta.review_status: draft`; no other field changes (check with a script that compares each item to `git show HEAD:curriculum/grammar/<level>.json` minus `mnemonic_text` and `_meta`).

- [ ] **Step 4: Ask for the pilot review — STOP**

Ask the maintainer to review the 10 in Studio (Mnemonic panel, "Mnemonic status"). Apply their prompt or gate changes (no `PROMPT_VERSION` bump: nothing is reviewed yet); regenerate the items they reject.

- [ ] **Step 5: Commit**

```bash
git add curriculum/_build/grammar_origins.json curriculum/grammar/mnemonics.json curriculum/grammar/n5.json curriculum/grammar/n4.json
git commit -m "Curriculum: grammar mnemonic pilot (10 points)"
```

(Add prompt or gate files changed in Step 4 by explicit path.)

---

### Task 14: The other 151 points (maintainer gate)

**Files:**
- Modify (generated): `curriculum/grammar/mnemonics.json`, `curriculum/grammar/n5.json`, `curriculum/grammar/n4.json`

- [ ] **Step 1: Generate in batches**

Run the subagent lane with `<type = grammar>`, `<level = n5>` then `<level = n4>`, auto-select on (it skips the 10 pilot slugs, which are done at prompt version 1). Commit after each batch:

```bash
git add curriculum/grammar/mnemonics.json curriculum/grammar/n5.json curriculum/grammar/n4.json
git commit -m "Curriculum: grammar mnemonics, <level> batch <n>"
```

Expected at the end: `mnemonics.json` has 161 entries; any `flagged_for_rewrite` slug is listed for the maintainer.

- [ ] **Step 2: Ask for the review — STOP**

The maintainer reviews all 151 in Studio. Fix or regenerate what they reject. Do not continue until every entry is `reviewed`:

```bash
python3 -c "import json; d=json.load(open('curriculum/grammar/mnemonics.json')); print(len(d), sorted({v['_meta']['review_status'] for v in d.values()}))"
```

Expected: `161 ['reviewed']`.

---

### Task 15: Seed, docs, full verification, PR

**Files:**
- Modify (generated): `curriculum/grammar/n5.json`, `n4.json`, `mobile/assets/curriculum-seed/curriculum.db`, `mobile/assets/curriculum-seed/curriculum-seed.json`, `curriculum/metadata.json`
- Modify: `docs/working-history.md`, `docs/content/content-pipeline-plan.md`, `docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md` (Status line)

- [ ] **Step 1: Regenerate and compile**

Run (repo root):

```bash
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n5
curriculum/_build/.venv/bin/python curriculum/_build/generate.py --level n4
npm run validate-schema && npm run compile-curriculum
sqlite3 mobile/assets/curriculum-seed/curriculum.db "select count(*) from items where item_type='grammar' and mnemonic_text is not null"
```

Expected: compile prints no "unreviewed content" warning for grammar; the count is `161`.

- [ ] **Step 2: Full test pass**

Run:

```bash
(cd curriculum/_build && .venv/bin/python -m unittest discover -s generate_content -p 'test_*.py')
npx jest --config jest.config.cjs
npm run test:studio
npm run check-contrast
(cd mobile && npm test && npm run lint)
(cd web && npm run lint)
```

Expected: all pass. Report any failure with its output; do not claim done.

- [ ] **Step 3: Check in the app**

Use the `run` skill: open a grammar detail page (ておく) — the "Mnemonic" block is under the header, `<reading>` gold, `<grammar>` bold primary; start a grammar lesson — step 2 "Usage" shows the mnemonic above "How it works"; Browse shows no "No mnemonic" pill on grammar rows.

- [ ] **Step 4: Docs**

- `docs/working-history.md`: add a row for this spec (Done when Step 3 passes, else Partial with what is left).
- `docs/content/content-pipeline-plan.md`: under the Revision 1 grammar row ("grammar | **none** — drop `mnemonic_text`…"), add a note: "Reversed 2026-10-17: grammar has a story mnemonic again — a sound-alike hook, not the old one-line summary. See docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md."
- Spec Status line → "Done".

- [ ] **Step 5: Commit and open the PR**

```bash
git add curriculum/grammar/n5.json curriculum/grammar/n4.json mobile/assets/curriculum-seed/curriculum.db mobile/assets/curriculum-seed/curriculum-seed.json curriculum/metadata.json docs/working-history.md docs/content/content-pipeline-plan.md docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md
git commit -m "Curriculum: ship 161 reviewed grammar mnemonics"
git push -u origin grammar-mnemonics
```

(Add any other file the compile changed, by explicit path, after `git status`.) Then `gh pr create --base main` with a summary and test plan, ending with the PR attribution lines. Ask the maintainer before pushing if they have not already said to open the PR.
