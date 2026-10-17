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


CANDIDATES = [{"kind": "kanji", "slug": "special",
               "reading_mnemonic": stored()["kanji"]["special"]["reading_mnemonic"]}]


class ApplyTest(unittest.TestCase):
    def test_passing_rewrite_is_written_as_draft(self):
        updated, failures = rl.apply_rewrites(
            stored(), LISTING,
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "opus-5.5", CANDIDATES)
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
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "m", CANDIDATES)
        self.assertNotIn("kanji/special", failures)

    def test_failing_rewrite_is_not_written(self):
        before = stored()
        updated, failures = rl.apply_rewrites(
            before, LISTING,
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": "A temple cow."}], "m", CANDIDATES)
        self.assertIn("kanji/special", failures)
        self.assertTrue(all(e.startswith("reading_mnemonic") for e in failures["kanji/special"]))
        self.assertEqual(updated, before)

    def test_unmarked_rewrite_is_refused(self):
        before = stored()
        updated, failures = rl.apply_rewrites(
            before, LISTING,
            [{"kind": "kanji", "slug": "polish", "reading_mnemonic": SPECIAL_OK}], "m", CANDIDATES)
        self.assertEqual(failures, {"kanji/polish": ["not in the marked list"]})
        self.assertEqual(updated, before)

    def test_input_is_not_mutated(self):
        before = stored()
        snapshot = copy.deepcopy(before)
        rl.apply_rewrites(before, LISTING,
                          [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "m", CANDIDATES)
        self.assertEqual(before, snapshot)

    def test_apply_twice_is_stable(self):
        rows = [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}]
        once, _ = rl.apply_rewrites(stored(), LISTING, rows, "m", CANDIDATES)
        twice, failures = rl.apply_rewrites(once, LISTING, rows, "m", CANDIDATES)
        self.assertEqual(failures, {})
        self.assertEqual(once, twice)

    def test_reapply_keeps_a_reviewed_rewrite(self):
        rows = [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}]
        once, _ = rl.apply_rewrites(stored(), LISTING, rows, "m", CANDIDATES)
        once["kanji"]["special"]["_meta"]["review_status"] = "reviewed"
        twice, failures = rl.apply_rewrites(once, LISTING, rows, "other-model", CANDIDATES)
        self.assertEqual(failures, {})
        self.assertEqual(twice, once)

    def test_studio_edit_is_not_overwritten(self):
        rows = [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}]
        once, _ = rl.apply_rewrites(stored(), LISTING, rows, "m", CANDIDATES)
        once["kanji"]["special"]["reading_mnemonic"] = SPECIAL_OK.replace("exactly", "just")
        twice, failures = rl.apply_rewrites(once, LISTING, rows, "m", CANDIDATES)
        self.assertEqual(failures, {"kanji/special": [rl.EDITED_SINCE_SELECT]})
        self.assertEqual(twice, once)


class UntouchedTest(unittest.TestCase):
    def setUp(self):
        self.base = stored()
        self.current, _ = rl.apply_rewrites(
            stored(), LISTING,
            [{"kind": "kanji", "slug": "special", "reading_mnemonic": SPECIAL_OK}], "m", CANDIDATES)

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


class IdentityNoteTest(unittest.TestCase):
    # A pointer meaning mnemonic has no scene, so the generation prompt must
    # hand the reading the parent story to continue.
    def test_identity_kanji_note_quotes_the_radical_image(self):
        from generate_content import mnemonic_context as mc
        ctx = mc.kanji_context("n5", "mountain")
        note = mc.format_identity(ctx)
        self.assertIn("> " + ctx["identical_radical"]["image"], note)
        self.assertIn("continues the radical's own image", note)

    def test_identity_word_note_quotes_the_kanji_story(self):
        from generate_content import mnemonic_context as mc
        ctx = mc.vocab_context("n5", "watashi")
        comp = ctx["identical_kanji"]
        note = mc.format_vocab_identity(comp, ctx["meaning"], ctx["form"])
        self.assertIn("> " + comp["meaning_mnemonic"], note)
        self.assertIn("continues the kanji's own meaning story", note)


if __name__ == "__main__":
    unittest.main()
