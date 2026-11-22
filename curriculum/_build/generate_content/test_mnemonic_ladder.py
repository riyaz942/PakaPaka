# curriculum/_build/generate_content/test_mnemonic_ladder.py
# -*- coding: utf-8 -*-
"""The mnemonic lane reads ladder levels (level-ladder plan, Task 6a).

Real slugs: pain (痛) is a level 6 kanji and younger-of (尗) a level 6 radical,
neither with a mnemonic yet; kinou (昨日) is a word whose 昨 was banded after
the word under JLPT and now sits at or below it."""
import os
import sys
import unittest

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import context  # noqa: E402
from generate_content import generate_mnemonics as gm  # noqa: E402
from generate_content import mnemonic_context as mc  # noqa: E402
from generate_content.validate_mnemonics import validate_draft  # noqa: E402

PAIN_DRAFT = {
    "meaning_mnemonic": (
        "Your <radical form=\"疒\">sickness</radical> sends you down a long "
        "<radical form=\"甬\">walled path</radical> with no way out, and every step "
        "on it is <kanji form=\"痛\">pain</kanji>."
    ),
    "reading_mnemonic": (
        "Each step makes you shout <reading>つう</reading>, like \"too!\", because "
        "this is far too much <kanji form=\"痛\">pain</kanji> for one person to bear."
    ),
}

YOUNGER_OF_DRAFT = {
    "mnemonic_text": (
        "A tiny sprout pokes up beside a tall stalk, the little one of the pair, "
        "so it reads as <radical form=\"尗\">younger of</radical> the two."
    ),
    "image_prompt": (
        "A tall green bean stalk with a tiny new sprout pushing up from the soil "
        "right beside it, the small one leaning toward the big one."
    ),
}


class LevelNamesTest(unittest.TestCase):
    def test_level_folder_is_level_and_two_digits(self):
        self.assertEqual(context.level_dir(4), "level-04")
        self.assertEqual(context.level_dir(60), "level-60")

    def test_levels_arg_takes_one_level_or_a_range(self):
        self.assertEqual(gm.parse_levels("4"), [4])
        self.assertEqual(gm.parse_levels("1-3"), [1, 2, 3])
        for bad in ("0", "61", "3-1", "n5", "1-"):
            with self.assertRaises(SystemExit):
                gm.parse_levels(bad)


class ContextTest(unittest.TestCase):
    def test_load_items_is_every_level_in_ladder_order(self):
        kanji = mc.load_items("kanji")
        self.assertEqual(len(kanji), 2000)
        self.assertEqual([k["level"] for k in kanji], sorted(k["level"] for k in kanji))

    def test_all_slugs_is_one_level(self):
        slugs = mc.all_slugs("kanji", 1)
        self.assertEqual(len(slugs), 18)
        self.assertEqual(slugs, [k["slug"] for k in mc.load_items("kanji") if k["level"] == 1])

    def test_kanji_context_takes_a_slug_and_carries_its_level(self):
        ctx = mc.kanji_context("pain")
        self.assertEqual((ctx["char"], ctx["level"]), ("痛", 6))
        self.assertTrue(ctx["components"])

    def test_radical_context_takes_a_slug_and_carries_its_level(self):
        ctx = mc.radical_context("younger-of")
        self.assertEqual((ctx["form"], ctx["level"]), ("尗", 6))

    def test_unknown_slug_raises(self):
        with self.assertRaises(KeyError):
            mc.kanji_context("zz-no-such-kanji")

    def test_vocab_story_names_every_kanji_at_or_below_the_word_level(self):
        ctx = mc.vocab_context("kinou")
        self.assertEqual(ctx["form"], "昨日")
        self.assertIn("昨", [c["char"] for c in ctx["components"]])
        self.assertEqual(ctx["untaught_components"], [])


class LaneTest(unittest.TestCase):
    def test_default_slugs_are_the_level_items_with_no_mnemonic(self):
        slugs = gm.default_slugs("kanji", [6])
        self.assertIn("pain", slugs)
        sidecar = gm.load_sidecar("kanji")
        self.assertTrue(all(s not in sidecar for s in slugs))
        self.assertTrue(any(s in sidecar for s in mc.all_slugs("kanji", 6)))

    def test_an_empty_sidecar_entry_is_no_mnemonic(self):
        # leather (level 6) has a `{}` entry in radicals/mnemonics.json.
        self.assertEqual(gm.load_sidecar("radical")["leather"], {})
        slugs = gm.default_slugs("radical", [6])
        self.assertIn("leather", slugs)
        self.assertIn("younger-of", slugs)

    def test_draft_and_staging_paths_use_the_level_folder(self):
        self.assertEqual(
            os.path.relpath(gm._draft_path(6, "kanji", "pain"), gm.DRAFTS_DIR),
            os.path.join("level-06", "kanji", "pain.json"))
        self.assertEqual(
            os.path.relpath(gm.staging_path(6, "radical", "younger-of", "reply"), gm.WEB_DIR),
            os.path.join("level-06", "radical", "younger-of.reply.md"))

    def test_kanji_request_for_a_new_level_6_kanji(self):
        req = gm.build_request("kanji", "pain", 1, mc.kanji_context("pain"))
        self.assertEqual(req["custom_id"], "level-06--kanji--pain--attempt1")
        prompt = req["params"]["messages"][0]["content"]
        self.assertTrue(prompt.startswith("# Write the mnemonics for one level 6 kanji"))
        self.assertIn("痛", prompt)

    def test_radical_web_prompt_for_a_new_level_6_radical(self):
        text = gm._web_prompt_text("radical", mc.radical_context("younger-of"))
        self.assertIn("web/mnemonics/level-06/radical/younger-of.reply.md", text)
        self.assertIn("ingest \\\n         --type radical --slug younger-of", text)
        self.assertIn("# Write the mnemonic for one level 6 radical", text)

    def test_custom_id_round_trips(self):
        self.assertEqual(gm._split_custom_id("level-06--kanji--pain--attempt2"),
                         (6, "kanji", "pain", 2))

    def test_gate_accepts_a_valid_fresh_kanji_draft(self):
        self.assertEqual(validate_draft("kanji", "pain", PAIN_DRAFT, enforce_readability=True), [])

    def test_gate_accepts_a_valid_fresh_radical_draft(self):
        self.assertEqual(
            validate_draft("radical", "younger-of", YOUNGER_OF_DRAFT, enforce_readability=True), [])


if __name__ == "__main__":
    unittest.main()
