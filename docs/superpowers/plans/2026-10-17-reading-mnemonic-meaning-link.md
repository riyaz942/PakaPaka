# Reading Mnemonics Continue the Meaning Story — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kanji and vocabulary reading mnemonics continue the scene of their meaning mnemonic — in future generation (prompt rule) and in stored N5 + N4 items that do not yet (triage → rewrite fix lane).

**Architecture:** Two prompt edits carry the rule into future generation. A small Python module (`generate_content/reading_link.py`) does the mechanical parts of the fix lane — select candidates, check the triage list, gate and apply rewrites, verify nothing else moved. The judgment parts (triage, rewrite) are agent work driven by two new prompt files and run through the single-session workflow, with a subagent-lane variant.

**Tech Stack:** Python 3.12 (`curriculum/_build/.venv`), `unittest`, existing `mnemonic_context` / `validate_mnemonics` / `cast` modules, Markdown prompts, npm scripts at repo root.

**Spec:** `docs/superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md`

## Global Constraints

- Levels in scope: **N5 + N4 only**. The 50 `flagged_for_rewrite` kanji (all N3+) are out.
- Kanji candidates: `review_status: reviewed` with a non-empty `reading_mnemonic`.
- Vocabulary candidates: non-empty `reading_mnemonic` and no `reading_taught_by` (pointer readings skipped).
- "Connected" = the reading scene continues the meaning scene (same object, place or action). A connected reading that does not name the meaning word is **kept**.
- Only `reading_mnemonic` changes. `meaning_mnemonic` and `description` stay byte-identical.
- A rewritten item gets `_meta.review_status: "draft"`. `_meta.prompt_version` does not change.
- `PROMPT_VERSION` in `generate_mnemonics.py` does not change.
- Rewrites pass `validate_draft(..., enforce_readability=True)` on their `reading_mnemonic` errors. At most 2 repair attempts; still failing → reported, not written.
- Reason in the triage list: 12 words or fewer.
- No mechanical "same scene" gate.
- Sidecar JSON is written `json.dump(..., ensure_ascii=False, indent=2)` + trailing `"\n"` (same as `generate_mnemonics.write_sidecar`).
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Work on branch `reading-mnemonic-meaning-link` (already created; spec committed as `cda8cd2`).

## Review Focus

1. **Stored meaning mnemonics fail today's fresh-draft gate** (e.g. 品 goods is 3 sentences, untagged `form`). A rewrite must not be rejected for meaning-field errors it did not cause → `apply_rewrites` keeps only `reading_mnemonic…` errors (Task 2, `test_meaning_field_errors_are_ignored`).
2. **A rewrite for an item that triage did not mark** (typo in slug, maintainer moved it to `kept`) must not be written → Task 2, `test_unmarked_rewrite_is_refused`.
3. **Re-running `apply` after a repair** must be idempotent — already-applied rewrites write the same bytes, the passing count does not drift → Task 2, `test_apply_twice_is_stable`.
4. **A triage list that drops or duplicates an item** must be caught before rewrite → Task 1, `test_missing_and_duplicate_rows`.
5. **The maintainer later flips drafts to `reviewed`** — `verify` must still pass, because only `_meta` moved → Task 2, `test_review_status_change_on_marked_item_is_allowed`.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `curriculum/_build/generate_content/reading_link.py` | Create | Mechanical fix-lane steps: `select`, `check-list`, `apply`, `verify` |
| `curriculum/_build/generate_content/test_reading_link.py` | Create | Unit tests for the module |
| `curriculum/_build/generate_content/prompts/kanji-mnemonic.md` | Modify | Hard "continue the meaning scene" rule + examples |
| `curriculum/_build/generate_content/prompts/vocab-mnemonic.md` | Modify | Same rule in the full-story branch |
| `curriculum/_build/generate_content/prompts/reading-link-triage.md` | Create | Agent triage instructions |
| `curriculum/_build/generate_content/prompts/reading-link-rewrite.md` | Create | Agent rewrite instructions |
| `docs/workflows/radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md` | Modify | New "Reading-link fix" section; band 150–280 → 90–200 |
| `docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md` | Modify | Short "Reading-link fix" section (groups of ≤4) |
| `docs/working-history.md` | Modify | Plan row + status |
| `curriculum/_build/reports/reading-link-{candidates,calibration,list,rewrites}.json` | Create (by running) | Fix-lane working files, committed as the record |
| `curriculum/kanji/mnemonics.json`, `curriculum/vocabulary/mnemonics.json` | Modify (by `apply`) | New readings for marked items |

All commands below run from `curriculum/_build` unless stated.

---

### Task 1: `reading_link.py` — select candidates and check the triage list

**Files:**
- Create: `curriculum/_build/generate_content/reading_link.py`
- Create: `curriculum/_build/generate_content/test_reading_link.py`

**Interfaces:**
- Consumes: `mnemonic_context.load_items(kind, level)`, `mnemonic_context.kanji_context(level, slug, cast=None)`, `mnemonic_context.vocab_context(level, slug, cast=None)`, `mnemonic_context._reading_teachers()`, `mnemonic_context.CURRICULUM_DIR`, `cast.load_cast()`.
- Produces:
  - `select_candidates(sidecars: dict, levels=("n5","n4")) -> list[dict]` — `sidecars` is `{"kanji": {...}, "vocab": {...}}` (the two sidecar JSONs). Each candidate: `{"kind", "slug", "level", "form", "meaning", "reading", "cast": list[str], "meaning_mnemonic", "reading_mnemonic"}`.
  - `list_errors(candidates: list[dict], listing: dict) -> list[str]`.
  - `levels_by_slug(kind: str, levels=("n5","n4")) -> dict[str, str]`.
  - Constants `LEVELS`, `CANDIDATES_PATH`, `CALIBRATION_PATH`, `LIST_PATH`, `REWRITES_PATH`, `SIDECAR`, `MAX_REASON_WORDS`, helpers `load_json(path)`, `dump_json(path, data)`.
  - CLI: `python -m generate_content.reading_link select` / `check-list`.

- [x] **Step 1: Write the failing tests**

Create `curriculum/_build/generate_content/test_reading_link.py`:

```python
# curriculum/_build/generate_content/test_reading_link.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import reading_link as rl  # noqa: E402

# Real slugs from the shipped level files; the sidecars are fabricated so the
# tests do not depend on the prose stored today.
#   polish (研, N4 kanji, けん → Ken), protect (N3 kanji), abunai (危ない, N5
#   vocab, story reading), watashitachi (reading taught by watashi), boku (N5).
REVIEWED = {"generator_model": "m", "prompt_version": "4", "review_status": "reviewed"}
DRAFT = {"generator_model": "m", "prompt_version": "4", "review_status": "draft"}


def sidecars():
    return {
        "kanji": {
            "polish": {"meaning_mnemonic": "M polish", "reading_mnemonic": "R polish",
                       "_meta": dict(REVIEWED)},
            "special": {"meaning_mnemonic": "M special", "reading_mnemonic": "R special",
                        "_meta": dict(DRAFT)},
            "protect": {"meaning_mnemonic": "M protect", "reading_mnemonic": "R protect",
                        "_meta": dict(REVIEWED)},
        },
        "vocab": {
            "abunai": {"meaning_mnemonic": "M abunai", "reading_mnemonic": "R abunai",
                       "_meta": dict(REVIEWED)},
            "watashitachi": {"meaning_mnemonic": "M w", "reading_mnemonic": "R w",
                             "_meta": dict(REVIEWED)},
            "boku": {"meaning_mnemonic": "M boku", "_meta": dict(REVIEWED)},
        },
    }


class SelectTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.cands = rl.select_candidates(sidecars())
        cls.keys = {(c["kind"], c["slug"]) for c in cls.cands}

    def test_reviewed_n5_n4_kanji_is_selected(self):
        self.assertIn(("kanji", "polish"), self.keys)

    def test_draft_kanji_is_skipped(self):
        self.assertNotIn(("kanji", "special"), self.keys)

    def test_n3_kanji_is_skipped(self):
        self.assertNotIn(("kanji", "protect"), self.keys)

    def test_story_vocab_is_selected(self):
        self.assertIn(("vocab", "abunai"), self.keys)

    def test_pointer_vocab_is_skipped(self):
        self.assertNotIn(("vocab", "watashitachi"), self.keys)

    def test_vocab_without_reading_is_skipped(self):
        self.assertNotIn(("vocab", "boku"), self.keys)

    def test_candidate_fields(self):
        polish = next(c for c in self.cands if c["slug"] == "polish")
        self.assertEqual(polish["level"], "n4")
        self.assertEqual(polish["form"], "研")
        self.assertEqual(polish["reading"], "けん")
        self.assertIn("けん: Ken, the sword-collecting dog", polish["cast"])
        self.assertEqual(polish["meaning_mnemonic"], "M polish")
        self.assertEqual(polish["reading_mnemonic"], "R polish")
        abunai = next(c for c in self.cands if c["slug"] == "abunai")
        self.assertEqual((abunai["form"], abunai["reading"], abunai["meaning"]),
                         ("危ない", "あぶない", "dangerous"))


CANDS = [{"kind": "kanji", "slug": "polish"}, {"kind": "kanji", "slug": "happiness"},
         {"kind": "vocab", "slug": "abunai"}]


def good_list():
    return {
        "marked": [{"kind": "kanji", "slug": "happiness",
                    "reason": "shop intercom scene; meaning scene is a sprouting stalk"}],
        "kept": [{"kind": "kanji", "slug": "polish"}, {"kind": "vocab", "slug": "abunai"}],
        "stats": {"total": 3, "marked": 1, "kept": 2},
    }


class ListErrorsTest(unittest.TestCase):
    def test_good_list(self):
        self.assertEqual(rl.list_errors(CANDS, good_list()), [])

    def test_missing_and_duplicate_rows(self):
        listing = good_list()
        listing["kept"] = [{"kind": "kanji", "slug": "polish"},
                           {"kind": "kanji", "slug": "happiness"}]
        errors = rl.list_errors(CANDS, listing)
        self.assertTrue(any("kanji/happiness appears twice" in e for e in errors), errors)
        self.assertTrue(any("vocab/abunai is in neither" in e for e in errors), errors)

    def test_unknown_row(self):
        listing = good_list()
        listing["kept"].append({"kind": "kanji", "slug": "nope"})
        listing["stats"]["kept"] = 3
        self.assertTrue(any("kanji/nope is not a candidate" in e
                            for e in rl.list_errors(CANDS, listing)))

    def test_reason_rules(self):
        listing = good_list()
        listing["marked"][0]["reason"] = " ".join(["word"] * 13)
        self.assertTrue(any("13 words" in e for e in rl.list_errors(CANDS, listing)))
        listing["marked"][0]["reason"] = ""
        self.assertTrue(any("no reason" in e for e in rl.list_errors(CANDS, listing)))

    def test_stats_must_match(self):
        listing = good_list()
        listing["stats"] = {"total": 4, "marked": 2, "kept": 2}
        errors = rl.list_errors(CANDS, listing)
        self.assertTrue(any("stats.total" in e for e in errors), errors)
        self.assertTrue(any("stats.marked" in e for e in errors), errors)


if __name__ == "__main__":
    unittest.main()
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m unittest generate_content.test_reading_link -v`
Expected: ERROR — `ImportError: cannot import name 'reading_link'`.

- [x] **Step 3: Write the module (select + list check)**

Create `curriculum/_build/generate_content/reading_link.py`:

```python
# -*- coding: utf-8 -*-
"""Reading-link fix lane
(docs/superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md).

Stored N5 + N4 reading mnemonics whose scene does not continue the meaning
mnemonic's scene get a new `reading_mnemonic`. Whether a scene connects is a
judgment, so triage and rewrite are the agent's work
(prompts/reading-link-triage.md, prompts/reading-link-rewrite.md). This module
does the mechanical steps around them:

    select      write reports/reading-link-candidates.json
    check-list  check reports/reading-link-list.json against the candidates
    apply       gate reports/reading-link-rewrites.json and write the passing
                readings into the sidecars (--dry-run: gate only)
    verify      compare the sidecars with a git ref: only marked readings moved

Usage (from curriculum/_build):
    .venv/bin/python -m generate_content.reading_link select
    .venv/bin/python -m generate_content.reading_link check-list
    .venv/bin/python -m generate_content.reading_link apply --model <model> [--dry-run]
    .venv/bin/python -m generate_content.reading_link verify --base <git-ref>
"""

import argparse
import json
import os
import subprocess
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import cast as cast_lib  # noqa: E402
from generate_content import mnemonic_context as mc  # noqa: E402

LEVELS = ("n5", "n4")
KINDS = ("kanji", "vocab")
ITEM_DIR = {"kanji": "kanji", "vocab": "vocabulary"}
SIDECAR = {kind: os.path.join(mc.CURRICULUM_DIR, ITEM_DIR[kind], "mnemonics.json")
           for kind in KINDS}
REPORTS_DIR = os.path.join(BUILD_DIR, "reports")
CANDIDATES_PATH = os.path.join(REPORTS_DIR, "reading-link-candidates.json")
CALIBRATION_PATH = os.path.join(REPORTS_DIR, "reading-link-calibration.json")
LIST_PATH = os.path.join(REPORTS_DIR, "reading-link-list.json")
REWRITES_PATH = os.path.join(REPORTS_DIR, "reading-link-rewrites.json")
MAX_REASON_WORDS = 12


def load_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def dump_json(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def levels_by_slug(kind, levels=LEVELS):
    return {it["slug"]: lvl for lvl in levels
            for it in mc.load_items(ITEM_DIR[kind], lvl)}


def select_candidates(sidecars, levels=LEVELS):
    """Every N5 + N4 item whose reading mnemonic triage must judge: reviewed
    kanji, and vocabulary whose reading is a story — a word with no reading
    mnemonic, or one pointing back at the earlier word that taught the sound,
    has no scene to connect."""
    cast = cast_lib.load_cast()
    teachers = mc._reading_teachers()
    out = []
    for kind in KINDS:
        for slug, level in levels_by_slug(kind, levels).items():
            entry = sidecars[kind].get(slug) or {}
            reading_mnemonic = entry.get("reading_mnemonic")
            if not reading_mnemonic:
                continue
            if kind == "kanji" and entry.get("_meta", {}).get("review_status") != "reviewed":
                continue
            if kind == "vocab" and teachers.get(slug):
                continue
            if kind == "kanji":
                ctx = mc.kanji_context(level, slug, cast=cast)
                form, reading = ctx["char"], ctx["primary_reading"]
            else:
                ctx = mc.vocab_context(level, slug, cast=cast)
                form, reading = ctx["form"], ctx["reading"]
            out.append({
                "kind": kind,
                "slug": slug,
                "level": level,
                "form": form,
                "meaning": ctx["meaning"],
                "reading": reading,
                "cast": [f"{lore['reading']}: {lore['character']}"
                         for lore in ctx["reading_lore"]],
                "meaning_mnemonic": entry.get("meaning_mnemonic", ""),
                "reading_mnemonic": reading_mnemonic,
            })
    return out


def list_errors(candidates, listing):
    """Every candidate exactly once in `marked` or `kept`, a short reason on
    every marked row, and stats that match."""
    want = {(c["kind"], c["slug"]) for c in candidates}
    seen = {}
    errors = []
    for bucket in ("marked", "kept"):
        for row in listing.get(bucket, []):
            key = (row.get("kind"), row.get("slug"))
            name = f"{key[0]}/{key[1]}"
            if key not in want:
                errors.append(f"{bucket}: {name} is not a candidate")
            elif key in seen:
                errors.append(f"{name} appears twice ({seen[key]} and {bucket})")
            seen.setdefault(key, bucket)
            if bucket == "marked":
                words = (row.get("reason") or "").split()
                if not words:
                    errors.append(f"marked: {name} has no reason")
                elif len(words) > MAX_REASON_WORDS:
                    errors.append(f"marked: {name} reason is {len(words)} words; "
                                  f"keep it to {MAX_REASON_WORDS}")
    for kind, slug in sorted(want - set(seen)):
        errors.append(f"{kind}/{slug} is in neither marked nor kept")
    stats = listing.get("stats", {})
    if stats.get("total") != len(candidates):
        errors.append(f"stats.total is {stats.get('total')}; there are {len(candidates)} candidates")
    if stats.get("marked") != len(listing.get("marked", [])):
        errors.append(f"stats.marked is {stats.get('marked')}; "
                      f"marked has {len(listing.get('marked', []))} rows")
    return errors


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("select")
    sub.add_parser("check-list")
    args = parser.parse_args(argv)

    sidecars = {kind: load_json(SIDECAR[kind]) for kind in KINDS}
    if args.cmd == "select":
        candidates = select_candidates(sidecars)
        dump_json(CANDIDATES_PATH, candidates)
        counts = {kind: sum(c["kind"] == kind for c in candidates) for kind in KINDS}
        print(f"wrote {len(candidates)} candidate(s) to {CANDIDATES_PATH} "
              f"({counts['kanji']} kanji, {counts['vocab']} vocab)")
        return 0
    if args.cmd == "check-list":
        errors = list_errors(load_json(CANDIDATES_PATH), load_json(LIST_PATH))
        for e in errors:
            print(f"  - {e}")
        print("list OK" if not errors else f"{len(errors)} list error(s)")
        return 1 if errors else 0
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `.venv/bin/python -m unittest generate_content.test_reading_link -v`
Expected: all 12 tests PASS.

- [x] **Step 5: Smoke-run `select` on the real sidecars**

Run: `.venv/bin/python -m generate_content.reading_link select`
Expected: `wrote 737 candidate(s) to …/reports/reading-link-candidates.json (325 kanji, 412 vocab)`. If the numbers differ, check the sidecars have not changed since 2026-10-17 (`git log -1 -- ../kanji/mnemonics.json ../vocabulary/mnemonics.json`) and report the new numbers; do not change the selection rules. Delete the file afterwards (`rm reports/reading-link-candidates.json`) — Task 6 writes it again.

- [x] **Step 6: Commit**

```bash
git add generate_content/reading_link.py generate_content/test_reading_link.py
git commit -m "Reading-link fix: select candidates and check the triage list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `reading_link.py` — apply rewrites and verify untouched fields

**Files:**
- Modify: `curriculum/_build/generate_content/reading_link.py`
- Modify: `curriculum/_build/generate_content/test_reading_link.py`

**Interfaces:**
- Consumes: Task 1's `levels_by_slug`, `load_json`, `dump_json`, `SIDECAR`, `LIST_PATH`, `REWRITES_PATH`, `KINDS`; `validate_mnemonics.validate_draft(level, kind, slug, draft, ctx=None, enforce_readability=False) -> list[str]` (errors are strings prefixed with the field name, e.g. `"reading_mnemonic is too short …"`).
- Produces:
  - `apply_rewrites(sidecars: dict, listing: dict, rewrites: list[dict], model: str, levels=("n5","n4")) -> tuple[dict, dict[str, list[str]]]` — returns `(updated_sidecars, failures)`; `failures` keyed `"kind/slug"`. `rewrites` rows: `{"kind", "slug", "reading_mnemonic"}`.
  - `untouched_errors(base: dict, current: dict, listing: dict) -> list[str]`.
  - CLI: `apply --model <m> [--dry-run]`, `verify --base <ref>`.

- [x] **Step 1: Write the failing tests**

Append to `test_reading_link.py` (above the `if __name__` line):

```python
import copy  # noqa: E402

SPECIAL_OK = ("The temple monk <reading>Took</reading> chants 「<reading>とく</reading>」 "
              "over the one cow nobody may eat, which is exactly what makes it "
              "<kanji form=\"特\">special</kanji>.")
LISTING = {"marked": [{"kind": "kanji", "slug": "special", "reason": "konbini scene"}],
           "kept": [], "stats": {"total": 1, "marked": 1, "kept": 0}}


def stored():
    # 特 special as stored today: its meaning mnemonic lacks `form` attributes,
    # which the fresh-draft gate rejects — apply must ignore that.
    return {
        "kanji": {
            "special": {
                "meaning_mnemonic": "The one <radical>cow</radical> kept up at the "
                                    "<radical>Buddhist temple</radical> is never for eating, "
                                    "which makes it <kanji>special</kanji>.",
                "reading_mnemonic": "The intercom at Koichi's konbini loops <reading>とく</reading>.",
                "_meta": {"generator_model": "sonnet-5", "prompt_version": "4",
                          "review_status": "reviewed"},
            },
            "polish": {"meaning_mnemonic": "M", "reading_mnemonic": "R",
                       "_meta": {"generator_model": "x", "prompt_version": "4",
                                 "review_status": "reviewed"}},
        },
        "vocab": {},
    }


class ApplyTest(unittest.TestCase):
    def test_passing_rewrite_is_written_as_draft(self):
        updated, failures = rl.apply_rewrites(
            stored(), LISTING,
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "opus-5.5")
        self.assertEqual(failures, {})
        entry = updated["kanji"]["special"]
        self.assertEqual(entry["reading_mnemonic"], SPECIAL_OK)
        self.assertEqual(entry["meaning_mnemonic"], stored()["kanji"]["special"]["meaning_mnemonic"])
        self.assertEqual(entry["_meta"], {"generator_model": "opus-5.5", "prompt_version": "4",
                                          "review_status": "draft"})
        self.assertEqual(list(entry), ["meaning_mnemonic", "reading_mnemonic", "_meta"])

    def test_meaning_field_errors_are_ignored(self):
        _, failures = rl.apply_rewrites(
            stored(), LISTING,
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "m")
        self.assertNotIn("kanji/special", failures)

    def test_failing_rewrite_is_not_written(self):
        before = stored()
        updated, failures = rl.apply_rewrites(
            before, LISTING,
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": "A temple cow."}], "m")
        self.assertIn("kanji/special", failures)
        self.assertTrue(all(e.startswith("reading_mnemonic") for e in failures["kanji/special"]))
        self.assertEqual(updated, before)

    def test_unmarked_rewrite_is_refused(self):
        before = stored()
        updated, failures = rl.apply_rewrites(
            before, LISTING,
            [{"kind": "kanji", "slug": "polish", "reading_mnemonic": SPECIAL_OK}], "m")
        self.assertEqual(failures, {"kanji/polish": ["not in the marked list"]})
        self.assertEqual(updated, before)

    def test_input_is_not_mutated(self):
        before = stored()
        snapshot = copy.deepcopy(before)
        rl.apply_rewrites(before, LISTING,
                          [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "m")
        self.assertEqual(before, snapshot)

    def test_apply_twice_is_stable(self):
        rows = [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}]
        once, _ = rl.apply_rewrites(stored(), LISTING, rows, "m")
        twice, failures = rl.apply_rewrites(once, LISTING, rows, "m")
        self.assertEqual(failures, {})
        self.assertEqual(once, twice)


class UntouchedTest(unittest.TestCase):
    def setUp(self):
        self.base = stored()
        self.current, _ = rl.apply_rewrites(
            stored(), LISTING,
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "m")

    def test_clean_apply_verifies(self):
        self.assertEqual(rl.untouched_errors(self.base, self.current, LISTING), [])

    def test_meaning_change_is_caught(self):
        self.current["kanji"]["special"]["meaning_mnemonic"] = "changed"
        self.assertEqual(rl.untouched_errors(self.base, self.current, LISTING),
                         ["kanji/special meaning_mnemonic changed"])

    def test_unmarked_change_is_caught(self):
        self.current["kanji"]["polish"]["reading_mnemonic"] = "changed"
        self.assertEqual(rl.untouched_errors(self.base, self.current, LISTING),
                         ["kanji/polish changed but is not marked"])

    def test_prompt_version_change_is_caught(self):
        self.current["kanji"]["special"]["_meta"]["prompt_version"] = "5"
        self.assertEqual(rl.untouched_errors(self.base, self.current, LISTING),
                         ["kanji/special _meta.prompt_version changed"])

    def test_review_status_change_on_marked_item_is_allowed(self):
        self.current["kanji"]["special"]["_meta"]["review_status"] = "reviewed"
        self.assertEqual(rl.untouched_errors(self.base, self.current, LISTING), [])

    def test_slug_set_change_is_caught(self):
        del self.current["kanji"]["polish"]
        self.assertEqual(rl.untouched_errors(self.base, self.current, LISTING),
                         ["kanji: slug set changed"])
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `.venv/bin/python -m unittest generate_content.test_reading_link -v`
Expected: the 12 Task 1 tests PASS; the new ones ERROR with `AttributeError: module 'generate_content.reading_link' has no attribute 'apply_rewrites'` / `'untouched_errors'`.

- [x] **Step 3: Implement `apply_rewrites`, `untouched_errors` and the CLI**

In `reading_link.py`, add the import below the `mnemonic_context` import:

```python
from generate_content.validate_mnemonics import validate_draft  # noqa: E402
```

Add after `list_errors`:

```python
def apply_rewrites(sidecars, listing, rewrites, model, levels=LEVELS):
    """Gate each rewrite and return (updated sidecars, failures). Only the
    `reading_mnemonic` errors count: a stored meaning mnemonic predates the
    fresh-draft rules, and this lane does not touch it. A rewrite for an item
    triage did not mark is refused."""
    marked = {(row["kind"], row["slug"]) for row in listing.get("marked", [])}
    level_of = {kind: levels_by_slug(kind, levels) for kind in KINDS}
    updated = {kind: dict(entries) for kind, entries in sidecars.items()}
    failures = {}
    for row in rewrites:
        kind, slug, text = row["kind"], row["slug"], row["reading_mnemonic"]
        name = f"{kind}/{slug}"
        if (kind, slug) not in marked:
            failures[name] = ["not in the marked list"]
            continue
        entry = updated[kind][slug]
        draft = {k: v for k, v in entry.items() if k != "_meta"}
        draft["reading_mnemonic"] = text
        errors = [e for e in validate_draft(level_of[kind][slug], kind, slug, draft,
                                            enforce_readability=True)
                  if e.startswith("reading_mnemonic")]
        if errors:
            failures[name] = errors
            continue
        updated[kind][slug] = {
            **entry,
            "reading_mnemonic": text,
            "_meta": {**entry.get("_meta", {}), "generator_model": model,
                      "review_status": "draft"},
        }
    return updated, failures


def untouched_errors(base, current, listing):
    """Unmarked entries byte-identical; on marked entries only
    `reading_mnemonic` and `_meta` (minus prompt_version) may differ."""
    marked = {(row["kind"], row["slug"]) for row in listing.get("marked", [])}
    errors = []
    for kind in KINDS:
        b, c = base[kind], current[kind]
        if set(b) != set(c):
            errors.append(f"{kind}: slug set changed")
        for slug in sorted(set(b) & set(c)):
            if (kind, slug) not in marked:
                if b[slug] != c[slug]:
                    errors.append(f"{kind}/{slug} changed but is not marked")
                continue
            for field in sorted(set(b[slug]) | set(c[slug])):
                if field in ("reading_mnemonic", "_meta"):
                    continue
                if b[slug].get(field) != c[slug].get(field):
                    errors.append(f"{kind}/{slug} {field} changed")
            if (b[slug].get("_meta", {}).get("prompt_version")
                    != c[slug].get("_meta", {}).get("prompt_version")):
                errors.append(f"{kind}/{slug} _meta.prompt_version changed")
    return errors


def _git_sidecars(ref):
    repo = os.path.dirname(mc.CURRICULUM_DIR)
    out = {}
    for kind in KINDS:
        rel = os.path.relpath(SIDECAR[kind], repo)
        text = subprocess.run(["git", "show", f"{ref}:{rel}"], cwd=repo, check=True,
                              capture_output=True, text=True).stdout
        out[kind] = json.loads(text)
    return out
```

In `main`, register the two subcommands after `sub.add_parser("check-list")`:

```python
    apply_p = sub.add_parser("apply")
    apply_p.add_argument("--model", required=True,
                         help="provenance recorded in _meta.generator_model")
    apply_p.add_argument("--dry-run", action="store_true", help="gate only, write nothing")
    verify_p = sub.add_parser("verify")
    verify_p.add_argument("--base", required=True,
                          help="git ref holding the sidecars before the rewrite")
```

and replace the final `return 2` with:

```python
    if args.cmd == "apply":
        rewrites = load_json(REWRITES_PATH)
        updated, failures = apply_rewrites(sidecars, load_json(LIST_PATH), rewrites, args.model)
        for name, errors in failures.items():
            print(f"FAIL {name}")
            for e in errors:
                print(f"  - {e}")
        if not args.dry_run:
            for kind in KINDS:
                if updated[kind] != sidecars[kind]:
                    dump_json(SIDECAR[kind], updated[kind])
        verb = "checked" if args.dry_run else "applied"
        print(f"{verb} {len(rewrites) - len(failures)} of {len(rewrites)} rewrite(s); "
              f"{len(failures)} failing")
        return 1 if failures else 0
    if args.cmd == "verify":
        errors = untouched_errors(_git_sidecars(args.base), sidecars, load_json(LIST_PATH))
        for e in errors:
            print(f"  - {e}")
        print("verify OK" if not errors else f"{len(errors)} unexpected change(s)")
        return 1 if errors else 0
    return 2
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `.venv/bin/python -m unittest generate_content.test_reading_link -v`
Expected: all 24 tests PASS.

- [x] **Step 5: Run the other generate_content tests (no regressions)**

Run: `.venv/bin/python -m unittest discover -s generate_content -p "test_*.py" -t .`
Expected: OK.

- [x] **Step 6: Commit**

```bash
git add generate_content/reading_link.py generate_content/test_reading_link.py
git commit -m "Reading-link fix: gate and apply rewrites, verify untouched fields

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Prompt rule for future generation + fresh-draft check

**Files:**
- Modify: `curriculum/_build/generate_content/prompts/kanji-mnemonic.md` (section "The reading mnemonic: the sound and the meaning in one joke", lines ~97–146; "What to write" item 2, lines ~290–298)
- Modify: `curriculum/_build/generate_content/prompts/vocab-mnemonic.md` ("What to write" item 2, full-story bullet, lines ~279–284)

**Interfaces:**
- Consumes: `generate_mnemonics webprompts` (renders prompts into the gitignored `generate_content/web/mnemonics/<level>/<type>/<slug>.prompt.md`), `validate_draft`.
- Produces: the rule text the triage and rewrite prompts (Task 4) point at by section name: **"Continue the meaning scene"**.

- [x] **Step 1: Kanji prompt — add the rule and examples**

In `prompts/kanji-mnemonic.md`, in the list "So it needs all four of these…", change the intro line and add a fifth item after item 4:

Old:
```markdown
So it needs all four of these, in one or two short sentences:
```
New:
```markdown
So it needs all five of these, in one or two short sentences:
```

After the item that starts `4. **A laugh.**` (and its continuation line `fourth review.`), insert:

```markdown
5. **The meaning mnemonic's scene.** The reading continues the scene the
   meaning mnemonic built — the same object, place or action. See "Continue
   the meaning scene" below.
```

Replace the paragraph:

```markdown
Tie the scene to the meaning mnemonic where you can — the same place, the same
aftermath — so the two reinforce each other instead of competing for the same
memory. Don't re-explain the decomposition here; the components belong to the
meaning mnemonic. This one is about the *sound*.
```

with:

```markdown
### Continue the meaning scene

This is a rule, not a preference. The reading mnemonic picks up the meaning
mnemonic's scene — its object, its place or its action — and the reading's
cast character walks into it. Do not give the cast character a scene of its
own. Two unrelated scenes compete for the same memory; one scene told twice
reinforces it.

**Right** — the meaning mnemonic and the reading mnemonic share the sword:

> Meaning: To <kanji form="研">polish</kanji> a sword you drag its blade back
> and forth across a flat <radical form="石">stone</radical> propped on a
> steady <radical form="开">bench</radical> until it shines back at you.
>
> Reading: No sword goes back on the wall until <reading>Ken</reading> the
> sword-collecting dog has <kanji form="研">polish</kanji>ed it to a mirror,
> and he growls 「<reading>けん</reading>」 at every last smudge.

**Wrong** — the sound and the cast are right, but the scene is new:

> Meaning: A <radical form="𢆉">sprouting stalk</radical> coming up through
> your own patch of <radical form="土">earth</radical> is the cheapest
> <kanji form="幸">happiness</kanji> going.
>
> Reading: Koichi hears the shrine's jingling luck all the way across town and
> races back to <reading>coax</reading> every customer into buying charms,
> chanting <reading>こう</reading>, <reading>こう</reading> over the intercom.

The stalk and the earth never come back; the learner gets a shop and a
chant, and nothing joins them to the sprout.

> Meaning: The one <radical form="牛">cow</radical> kept up at the
> <radical form="寺">Buddhist temple</radical> is never for eating, which makes
> it <kanji form="特">special</kanji>.
>
> Reading: The intercom at Koichi's konbini loops the same announcement: that
> onigiri took first place today. The clerk's mumble flattens the word into
> <reading>とく</reading>, sounding just like <reading>took</reading>.

No cow, no temple, and no *special* — a konbini that could belong to any kanji.

**Check before you finish:** cover the meaning mnemonic. Does the reading
still point back at it — the same sword, the same crates, the same cave? If
not, it is not finished.

Don't re-explain the decomposition here; the components belong to the
meaning mnemonic. The reading reuses the *scene*, not the component list.
```

- [x] **Step 2: Kanji prompt — "What to write" item 2**

In the same file, in item `2. **\`reading_mnemonic\`**`, replace:

```markdown
   carries the sound) does something the meaning explains, the kana
```

with:

```markdown
   carries the sound) walks into the meaning mnemonic's scene and does
   something the meaning explains (see "Continue the meaning scene"), the kana
```

- [x] **Step 3: Vocab prompt — full-story bullet**

In `prompts/vocab-mnemonic.md`, replace:

```markdown
   - When it says to write a **full story**, write one sentence or two short
     ones in which the sound and this word's meaning are the same joke: the
     reading's cast character does something the meaning explains, the kana
     appears verbatim, and the meaning sits in a `<vocabulary>` tag. If the
     sentence would still make sense with a different word's meaning dropped
     into it, it is not finished.
```

with:

```markdown
   - When it says to write a **full story**, write one sentence or two short
     ones in which the sound and this word's meaning are the same joke: the
     reading's cast character walks into the scene your meaning mnemonic just
     built — the same object, place or action — and does something the
     meaning explains, the kana appears verbatim, and the meaning sits in a
     `<vocabulary>` tag. Do not give the cast character a scene of its own:
     two unrelated scenes compete for one memory. If the sentence would still
     make sense with a different word's meaning dropped into it, or if it
     would still make sense without your meaning mnemonic, it is not finished.

     Right — the trail from the meaning mnemonic comes back:

     > Meaning: The rope bridge on the mountain trail is missing every third
     > plank, and the river roars a long way down through each gap. Standing
     > where one bad step drops you into that is
     > <vocabulary form="危ない">dangerous</vocabulary>.
     >
     > Reading: A marmot on the mountain trail whistles something like
     > <reading>'a boo, nigh'</reading> whenever a hiker drifts toward the
     > cliff edge. Hikers learned that the shrill <reading>あぶない</reading>
     > whistle means the next step is
     > <vocabulary form="危ない">dangerous</vocabulary>.
```

- [x] **Step 4: Confirm `PROMPT_VERSION` is unchanged**

Run: `git diff --stat HEAD -- generate_content/generate_mnemonics.py`
Expected: no output.

- [x] **Step 5: Fresh-draft check — render prompts for 3 N3 kanji and 2 N4 vocab**

Pick the N3 kanji: the first 3 N3 kanji slugs in `kanji/n3.json` whose `webprompts` call succeeds (start with `protect,committee,anti`). Pick the N4 vocab with:

```bash
.venv/bin/python - <<'EOF'
import json, sys
sys.path.insert(0, ".")
from generate_content import mnemonic_context as mc
side = json.load(open("../vocabulary/mnemonics.json", encoding="utf-8"))
teachers = mc._reading_teachers()
picked = []
for it in mc.load_items("vocabulary", "n4"):
    s = it["slug"]
    if s in side or teachers.get(s):
        continue
    ctx = mc.vocab_context("n4", s)
    if ctx["regularity"]["kind"] in ("kun_word", "irregular"):
        picked.append(s)
    if len(picked) == 6:
        break
print(",".join(picked))
EOF
```

Then render (try the vocab slugs in order until two render; a `ValueError` about a missing `meaning_mnemonic` means that word's kanji have no prose yet — skip it):

```bash
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type kanji --level n3 --slugs protect,committee,anti
.venv/bin/python -m generate_content.generate_mnemonics webprompts --type vocab --level n4 --slugs <slug1>,<slug2>
```

Confirm each rendered vocab prompt asks for a full-story reading: `grep -l "full story" generate_content/web/mnemonics/n4/vocab/*.prompt.md`.

- [x] **Step 6: Fresh-draft check — write the 5 replies and gate them (not saved)**

For each rendered `web/mnemonics/<level>/<type>/<slug>.prompt.md`, read it fully and write the reply JSON yourself to `web/mnemonics/<level>/<type>/<slug>.reply.md`, following the prompt exactly. Then gate without ingesting:

```bash
.venv/bin/python - <<'EOF'
import json, glob, os, sys
sys.path.insert(0, ".")
from generate_content.validate_mnemonics import validate_draft
from generate_content.generate_mnemonics import _first_json_object
for path in sorted(glob.glob("generate_content/web/mnemonics/*/*/*.reply.md")):
    level, kind, name = path.split(os.sep)[-3:]
    slug = name[:-len(".reply.md")]
    draft = _first_json_object(open(path, encoding="utf-8").read())
    errors = validate_draft(level, kind, slug, draft, enforce_readability=True)
    print("PASS" if not errors else "FAIL", level, kind, slug)
    for e in errors:
        print("  -", e)
    print("  M:", draft.get("meaning_mnemonic"))
    print("  R:", draft.get("reading_mnemonic"))
EOF
```

Expected: 5 × PASS, and for each, the `R:` line reuses an object, place or action from its `M:` line. If a reply fails the gate, fix it (max 2 attempts). If a reading does not continue the scene even though the prompt was followed, the prompt wording in Steps 1–3 is too weak — strengthen it and redo Steps 5–6.

- [x] **Step 7: Clean up the check files**

Run: `rm -rf generate_content/web/mnemonics/n3/kanji generate_content/web/mnemonics/n4/vocab`
(gitignored, but keep the working tree clean for the real lanes). Confirm the sidecars are untouched: `git diff --stat -- ../kanji/mnemonics.json ../vocabulary/mnemonics.json` → no output.

- [x] **Step 8: Commit**

```bash
git add generate_content/prompts/kanji-mnemonic.md generate_content/prompts/vocab-mnemonic.md
git commit -m "Mnemonic prompts: reading continues the meaning scene

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Paste the 5 M/R pairs into the task report for the maintainer.

---

### Task 4: Triage and rewrite prompts

**Files:**
- Create: `curriculum/_build/generate_content/prompts/reading-link-triage.md`
- Create: `curriculum/_build/generate_content/prompts/reading-link-rewrite.md`

**Interfaces:**
- Consumes: `reports/reading-link-candidates.json` (Task 1 shape), the "Continue the meaning scene" section (Task 3), `reading_link check-list` / `apply` (Tasks 1–2).
- Produces: `reports/reading-link-list.json` (`{"marked": [{"kind","slug","reason"}], "kept": [{"kind","slug"}], "stats": {"total","marked","kept"}}`) and `reports/reading-link-rewrites.json` (`[{"kind","slug","reading_mnemonic"}]`).

- [x] **Step 1: Write `prompts/reading-link-triage.md`**

```markdown
# Triage reading mnemonics — mark the ones whose scene does not connect

You are auditing the reading mnemonics of a Japanese-learning app. Each kanji
and each vocabulary word has a meaning mnemonic (a scene that explains the
meaning) and a reading mnemonic (a scene that carries the sound). Many reading
mnemonics start a new scene that has nothing to do with the meaning scene, so
the learner holds two unrelated images and nothing joins the sound to the
meaning. Your job is to find those. You are **marking only** — do not rewrite
anything.

## File to read

`curriculum/_build/reports/reading-link-candidates.json` — a list of
candidates. Each has `kind` (`kanji` / `vocab`), `slug`, `form`, `meaning`,
`reading`, `cast`, `meaning_mnemonic` and `reading_mnemonic`. Write it first
if it is missing:

    cd curriculum/_build && .venv/bin/python -m generate_content.reading_link select

Read it in chunks of about 50 candidates. Judge every candidate.

## The one question

**Does the reading scene continue the meaning scene?** It continues it when it
reuses the meaning scene's object, place or action — the same sword, the same
crates, the same cave, the same mountain trail.

- **Keep** when the scene continues, even if the reading never names the
  meaning word. Naming the meaning is not this audit's business.
- **Mark** when the reading builds a new scene — a new place, new objects, a
  new event — that would make as much sense next to any other meaning
  mnemonic.
- A cast character's name is not a scene. Ken the dog appearing is not a
  link; Ken polishing *the sword* is.
- Do not judge length, humour, tags or style. One question only.

## Calibration — these five are settled

| Item | Verdict | Why |
|---|---|---|
| kanji `polish` 研 | keep | Ken polishes the sword from the meaning scene |
| kanji `goods` 品 | keep | inspector stamps the crates from the meaning scene |
| kanji `research` 究 | keep | the queue forms at the cave from the meaning scene |
| kanji `happiness` 幸 | mark | shop intercom; meaning scene is a stalk in earth |
| kanji `special` 特 | mark | konbini intercom; meaning scene is the temple cow |

## Output

Write `curriculum/_build/reports/reading-link-list.json`:

```json
{
  "marked": [
    { "kind": "kanji", "slug": "happiness",
      "reason": "shop intercom scene; meaning scene is a sprouting stalk" }
  ],
  "kept": [ { "kind": "kanji", "slug": "polish" } ],
  "stats": { "total": 737, "marked": 1, "kept": 736 }
}
```

- Every candidate appears exactly once, in `marked` or `kept`.
- `reason`: 12 words or fewer, naming both scenes.
- `stats.total` = number of candidates; `stats.marked` = rows in `marked`;
  `stats.kept` = rows in `kept`.

When you are calibrating (the workflow will say so), judge only the five items
above and write `curriculum/_build/reports/reading-link-calibration.json` in
the same shape, with `stats.total` 5.

Then check the full list mechanically:

    cd curriculum/_build && .venv/bin/python -m generate_content.reading_link check-list

Fix every error it prints. Then stop: the maintainer reviews the list before
any rewrite.
```

- [x] **Step 2: Write `prompts/reading-link-rewrite.md`**

```markdown
# Rewrite marked reading mnemonics so they continue the meaning scene

Triage marked these items because their reading mnemonic builds a scene
unrelated to the meaning mnemonic. Rewrite **only `reading_mnemonic`**.
The meaning mnemonic and the description stay exactly as they are — the
rewrite is built on them.

## Inputs

- `curriculum/_build/reports/reading-link-list.json` — `marked` is your work
  list; the maintainer has reviewed it. Rewrite nothing outside it.
- `curriculum/_build/reports/reading-link-candidates.json` — per item: `form`,
  `meaning`, `reading`, `cast`, the stored `meaning_mnemonic` and the old
  `reading_mnemonic`.
- The rule and its examples: section "Continue the meaning scene" in
  `curriculum/_build/generate_content/prompts/kanji-mnemonic.md`, and the
  full-story bullet of "What to write" in `prompts/vocab-mnemonic.md`. Read
  both before the first rewrite.

## Rules for the new `reading_mnemonic`

1. **Continue the meaning scene.** Reuse its object, place or action. The
   cast character walks into that scene.
2. **Cast.** Use the cast character listed in `cast` for this item's
   `reading`. If none is listed for that reading, invent a character whose
   name carries the sound. Keep what the old reading did right — its sound
   hook is often fine; it is the scene that changes.
3. **The sound.** The kana of `reading` appears verbatim inside
   `<reading>…</reading>`, and the English sound-alike hook is also inside
   `<reading>…</reading>`.
4. **The meaning.** Name the item's `meaning` once, tagged with its character:
   `<kanji form="研">polish</kanji>` for kanji,
   `<vocabulary form="危ない">dangerous</vocabulary>` for vocabulary. Write
   the character only in the `form` attribute, never in the prose.
5. **Shape.** One sentence or two short ones, about 90–200 characters for
   kanji and 90–220 for vocabulary (the gate's hard ceiling is 240 for both). No `<radical>` tags in a reading
   mnemonic; for vocabulary, no `<kanji>` tags either.
6. **Check:** cover the meaning mnemonic. Does the reading still point back
   to it? If not, it is not finished.

## Output

Write `curriculum/_build/reports/reading-link-rewrites.json` — one row per
item you rewrote, appending to rows already there:

```json
[
  { "kind": "kanji", "slug": "special",
    "reading_mnemonic": "The temple monk <reading>Took</reading> chants 「<reading>とく</reading>」 over the one cow nobody may eat, which is exactly what makes it <kanji form=\"特\">special</kanji>." }
]
```

Then gate without writing:

    cd curriculum/_build && .venv/bin/python -m generate_content.reading_link apply --model <your-model-id> --dry-run

For every `FAIL`, fix that row using the printed errors and run the dry run
again — at most 2 repair attempts per item. An item still failing after that
is removed from the rewrites file and reported to the maintainer. When the dry
run shows 0 failing, apply for real (same command without `--dry-run`).
```

- [x] **Step 3: Check the two prompts agree with the code**

Run: `grep -n "reading-link-\(list\|candidates\|rewrites\|calibration\)\.json\|reading_link \(select\|check-list\|apply\)" generate_content/prompts/reading-link-*.md`
Expected: every path matches a `*_PATH` constant in `reading_link.py`, and every command is a real subcommand (`select`, `check-list`, `apply`).

- [x] **Step 4: Commit**

```bash
git add generate_content/prompts/reading-link-triage.md generate_content/prompts/reading-link-rewrite.md
git commit -m "Reading-link fix: triage and rewrite prompts

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Workflow docs and working history

**Files:**
- Modify: `docs/workflows/radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md` (line ~191 band; new section before "Notes on differences from the subagent workflow")
- Modify: `docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md` (new section before "Notes on differences from the Gemini web-chat automation prompt")
- Modify: `docs/working-history.md` (Content plans table)

**Interfaces:**
- Consumes: the prompt files (Task 4) and CLI (Tasks 1–2) by exact name.
- Produces: the runbook Tasks 6–9 follow.

- [x] **Step 1: Fix the stale band (single-session doc)**

Replace:
```
    kanji reading            roughly **150–280** characters
```
with:
```
    kanji reading            roughly **90–200** characters, one sentence or
                             two short ones, continuing the meaning scene
```

- [x] **Step 2: Add the "Reading-link fix" section (single-session doc)**

Insert before the line `Notes on differences from the subagent workflow`:

```markdown
Reading-link fix — stored N5 + N4 readings that do not continue the meaning scene

A separate, one-off lane. It does not generate new items; it rewrites only
the `reading_mnemonic` of stored items whose reading scene is unrelated to the
meaning scene. Spec:
`docs/superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md`.
All commands run from `curriculum/_build`.

1. Select. `.venv/bin/python -m generate_content.reading_link select` writes
   `reports/reading-link-candidates.json` (reviewed N5 + N4 kanji; N5 + N4
   vocabulary with a story reading).
2. Calibrate. Follow `generate_content/prompts/reading-link-triage.md` for the
   five calibration items only and write `reports/reading-link-calibration.json`.
   Expected: keep polish, goods, research; mark happiness, special. If not,
   fix the triage prompt and calibrate again. Do not start step 3 until it
   matches.
3. Triage. Follow `reading-link-triage.md` for every candidate, writing
   `reports/reading-link-list.json`, then run
   `.venv/bin/python -m generate_content.reading_link check-list` until it
   prints `list OK`. **Stop.** The maintainer reviews the list and may move
   rows between `marked` and `kept`.
4. Pilot. Follow `generate_content/prompts/reading-link-rewrite.md` for
   kanji `happiness` and `special` only; `apply --dry-run`, then `apply`.
   **Stop.** The maintainer approves both new readings.
5. Rewrite the rest of `marked`, in chunks of about 25: append to
   `reports/reading-link-rewrites.json`, `apply --model <model> --dry-run`,
   repair (at most 2 attempts per item), then `apply --model <model>`.
6. Verify and build:
   `.venv/bin/python -m generate_content.reading_link verify --base <sha before step 4>`
   (must print `verify OK`), then `.venv/bin/python generate.py --level n5`,
   `.venv/bin/python generate.py --level n4`, and from the repo root
   `npm run validate-schema && npm run compile-curriculum`.
7. Every rewritten item is now `review_status: draft`. The maintainer
   reviews them in Studio.
```

- [x] **Step 3: Add the subagent-lane section (subagent doc)**

Insert before the line `Notes on differences from the Gemini web-chat automation prompt`:

```markdown
Reading-link fix — subagent variant

Same seven steps as the "Reading-link fix" section of
`radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md`,
with two changes:

- **Triage (step 3):** split `reports/reading-link-candidates.json` into
  groups of ≤4 candidates. Each subagent gets `prompts/reading-link-triage.md`
  and its group, and returns `marked` / `kept` rows only. The coordinator
  merges the rows into `reports/reading-link-list.json`, writes `stats`, and
  runs `check-list`. Calibration (step 2) and the maintainer stop are not
  delegated.
- **Rewrite (step 5):** groups of ≤4 marked items. Each subagent gets
  `prompts/reading-link-rewrite.md` and its group, and returns rewrite rows
  only. The coordinator appends them to `reports/reading-link-rewrites.json`
  and runs `apply --dry-run`; a failing item goes back to the same group's
  subagent with the printed errors (at most 2 attempts). The pilot (step 4)
  is not delegated.

Subagents never write the sidecars or the report files themselves.
```

- [x] **Step 4: Add the plan row (working history)**

In `docs/working-history.md`, in the `## Content plans — \`docs/content/\`` table, add after the `| [Radical mnemonic images]…` row:

```markdown
| [Reading mnemonics continue the meaning story (spec, 2026-10-17)](./superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md) | **In progress** — plan `docs/superpowers/plans/2026-10-17-reading-mnemonic-meaning-link.md`. Prompt rule, `reading_link.py`, triage/rewrite prompts and workflow docs done 2026-10-17; triage of 325 N5+N4 kanji + 412 vocab story readings not run yet |
```

- [x] **Step 5: Commit**

```bash
cd /Users/riyazahmed/Projects/japanese-learning
git add docs/workflows/radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md \
        docs/workflows/radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md \
        docs/working-history.md
git commit -m "Workflow docs: reading-link fix lane; kanji reading band 90-200

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Run — select and calibrate (maintainer stop)

**Files:**
- Create (by running): `curriculum/_build/reports/reading-link-candidates.json`, `curriculum/_build/reports/reading-link-calibration.json`

- [x] **Step 1: Select**

Run: `.venv/bin/python -m generate_content.reading_link select`
Expected: `wrote 737 candidate(s) … (325 kanji, 412 vocab)`.

- [x] **Step 2: Calibrate**

Follow `generate_content/prompts/reading-link-triage.md` in calibration mode for `polish`, `goods`, `research`, `happiness`, `special` — judge each from its candidate row **without looking at the calibration table's verdict first** (read the rows, decide, then compare). Write `reports/reading-link-calibration.json`.

- [x] **Step 3: Compare with the expected result**

```bash
.venv/bin/python - <<'EOF'
import json
c = json.load(open("reports/reading-link-calibration.json", encoding="utf-8"))
marked = {r["slug"] for r in c["marked"]}
kept = {r["slug"] for r in c["kept"]}
ok = marked == {"happiness", "special"} and kept == {"polish", "goods", "research"}
print("calibration OK" if ok else f"MISMATCH marked={sorted(marked)} kept={sorted(kept)}")
EOF
```

Expected: `calibration OK`. On mismatch, sharpen the "one question" wording in `reading-link-triage.md`, commit that change, and redo Steps 2–3.

- [x] **Step 4: Commit and stop**

```bash
git add reports/reading-link-candidates.json reports/reading-link-calibration.json
git commit -m "Reading-link fix: candidates and triage calibration

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Report the calibration result to the maintainer and continue to Task 7 only if it is OK.

---

### Task 7: Run — full triage (maintainer stop)

**Files:**
- Create (by running): `curriculum/_build/reports/reading-link-list.json`

- [x] **Step 1: Triage all 737 candidates**

Follow `reading-link-triage.md` for every candidate, in chunks of about 50, appending to `reports/reading-link-list.json`. (Subagent lane: groups of ≤4, per the subagent doc section.)

- [x] **Step 2: Check the list**

Run: `.venv/bin/python -m generate_content.reading_link check-list`
Expected: `list OK`. Fix every printed error and rerun.

- [x] **Step 3: Commit and stop**

```bash
git add reports/reading-link-list.json
git commit -m "Reading-link fix: triage list

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Report to the maintainer: totals (marked / kept, per kind) and 10 sample marked rows with reasons. **Wait** for the maintainer's review. Apply any moves they ask for (edit the list, rerun `check-list`, commit "Reading-link fix: triage list after review").

---

### Task 8: Run — pilot rewrite (maintainer stop)

**Files:**
- Create (by running): `curriculum/_build/reports/reading-link-rewrites.json`
- Modify (by `apply`): `curriculum/kanji/mnemonics.json`

- [ ] **Step 1: Record the base sha**

Run: `git rev-parse HEAD` — keep it as `<base>` for Task 9's `verify`.

- [ ] **Step 2: Rewrite `happiness` and `special`**

Follow `reading-link-rewrite.md` for kanji `happiness` and `special` only. Write both rows to `reports/reading-link-rewrites.json`.

- [ ] **Step 3: Gate, then apply**

Run: `.venv/bin/python -m generate_content.reading_link apply --model claude-opus-5-5 --dry-run`
Expected: `checked 2 of 2 rewrite(s); 0 failing`. Repair failures (≤2 attempts). Then run the same command without `--dry-run`.
Expected: `applied 2 of 2 rewrite(s); 0 failing`.

- [ ] **Step 4: Verify**

Run: `.venv/bin/python -m generate_content.reading_link verify --base <base>`
Expected: `verify OK`.

- [ ] **Step 5: Commit and stop**

```bash
git add reports/reading-link-rewrites.json ../kanji/mnemonics.json
git commit -m "Reading-link fix: pilot rewrite of happiness and special

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

Show the maintainer both items — meaning mnemonic, old reading, new reading. **Wait** for approval. If they ask for changes, edit the rows, rerun Step 3–4, commit.

---

### Task 9: Run — rewrite the rest, verify, build

**Files:**
- Modify (by running): `curriculum/_build/reports/reading-link-rewrites.json`, `curriculum/kanji/mnemonics.json`, `curriculum/vocabulary/mnemonics.json`, shipped `curriculum/kanji/n5.json`, `n4.json`, `curriculum/vocabulary/n5.json`, `n4.json` (by `generate.py`)
- Modify: `docs/working-history.md`

- [ ] **Step 1: Rewrite the remaining marked items in chunks of about 25**

For each chunk: follow `reading-link-rewrite.md`, append the rows, run `apply --model claude-opus-5-5 --dry-run`, repair (≤2 attempts per item; remove an item that still fails and note it), then `apply --model claude-opus-5-5`. Commit after each chunk:

```bash
git add reports/reading-link-rewrites.json ../kanji/mnemonics.json ../vocabulary/mnemonics.json
git commit -m "Reading-link fix: rewrite chunk <n>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

- [ ] **Step 2: Confirm every marked item was rewritten or reported**

```bash
.venv/bin/python - <<'EOF'
import json
marked = {(r["kind"], r["slug"]) for r in json.load(open("reports/reading-link-list.json"))["marked"]}
done = {(r["kind"], r["slug"]) for r in json.load(open("reports/reading-link-rewrites.json"))}
print("missing:", sorted(marked - done))
print("extra:", sorted(done - marked))
EOF
```

Expected: `extra: []`; `missing` lists only the items reported as still failing.

- [ ] **Step 3: Verify untouched fields**

Run: `.venv/bin/python -m generate_content.reading_link verify --base <base from Task 8>`
Expected: `verify OK`.

- [ ] **Step 4: Build**

```bash
.venv/bin/python generate.py --level n5
.venv/bin/python generate.py --level n4
cd /Users/riyazahmed/Projects/japanese-learning && npm run validate-schema && npm run compile-curriculum
```

Expected: all four commands exit 0. `compile-curriculum` warns about draft prose — that is expected (the rewritten items are `draft`).

- [ ] **Step 5: Run the module tests once more**

Run (from `curriculum/_build`): `.venv/bin/python -m unittest generate_content.test_reading_link -v`
Expected: 24 PASS.

- [ ] **Step 6: Update working history**

Replace the row added in Task 5 Step 4 with the final status, filling the real numbers:

```markdown
| [Reading mnemonics continue the meaning story (spec, 2026-10-17)](./superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md) | **Done <date>** — prompt rule in `kanji-mnemonic.md` / `vocab-mnemonic.md` (`PROMPT_VERSION` unchanged); triage of 737 N5+N4 candidates (325 kanji, 412 vocab story readings) marked <K> kanji + <V> vocab; <R> rewritten via `reading_link.py`, now `draft` awaiting Studio review; <F> still failing, listed in the plan report. Meaning mnemonics byte-identical (`reading_link verify`) |
```

- [ ] **Step 7: Commit**

```bash
cd /Users/riyazahmed/Projects/japanese-learning
git status --short
git add curriculum/kanji curriculum/vocabulary mobile/assets/curriculum-seed/curriculum.db docs/working-history.md
git commit -m "Reading-link fix: rewrites done, shipped JSON rebuilt

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

`compile-curriculum` writes `mobile/assets/curriculum-seed/curriculum.db` (Git LFS). Check `git status --short` first and stage only files the build changed — never `.DS_Store`. If `compile-curriculum` also touched `curriculum/metadata.json` or another tracked file, stage it too.

Report to the maintainer: counts, the failing items (if any), and that the rewritten items wait for Studio review.
