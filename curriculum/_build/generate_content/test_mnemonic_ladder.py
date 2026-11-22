# curriculum/_build/generate_content/test_mnemonic_ladder.py
# -*- coding: utf-8 -*-
"""The mnemonic lane reads ladder levels (level-ladder plan, Task 6a).

Real slugs: pain (痛) is a level 6 kanji and younger-of (尗) a level 6 radical
(they had no mnemonic when this was written; no test depends on that — the
selection and sidecar tests use patched data, so they stay green as Task 8
fills the sidecars); kinou (昨日) is a word whose 昨 was banded after the word
under JLPT and now sits at or below it."""
import argparse
import io
import json
import os
import sys
import tempfile
import types
import unittest
from unittest import mock

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
        self.assertTrue(kanji)
        self.assertTrue(all(isinstance(k["level"], int) for k in kanji))
        self.assertEqual([k["level"] for k in kanji], sorted(k["level"] for k in kanji))

    def test_all_slugs_is_one_level(self):
        items = [{"slug": "a", "level": 1}, {"slug": "b", "level": 2}, {"slug": "c", "level": 1}]
        with mock.patch.object(mc, "load_items", return_value=items):
            self.assertEqual(mc.all_slugs("kanji", 1), ["a", "c"])

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
    @staticmethod
    def selection(kind, sidecar, by_level):
        with mock.patch.object(gm, "load_sidecar", return_value=sidecar), \
                mock.patch.object(mc, "all_slugs", side_effect=lambda _d, lvl: by_level[lvl]):
            return gm.default_slugs(kind, sorted(by_level))

    def test_default_slugs_are_the_level_items_with_no_mnemonic(self):
        sidecar = {"done": {"meaning_mnemonic": "x"}}
        self.assertEqual(self.selection("kanji", sidecar, {6: ["done", "new"], 7: ["later"]}),
                         ["new", "later"])

    def test_an_empty_sidecar_entry_is_no_mnemonic(self):
        # radicals/mnemonics.json holds `{}` entries (leather, ...): no mnemonic.
        sidecar = {"empty": {}, "done": {"mnemonic_text": "x"}}
        self.assertEqual(self.selection("radical", sidecar, {6: ["empty", "done", "new"]}),
                         ["empty", "new"])

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


class SidecarMergeTest(unittest.TestCase):
    """`run` and `collect` merge only the slugs they handled, so a stale draft
    file never overwrites a sidecar entry reviewed since."""

    REVIEWED = {"meaning_mnemonic": "reviewed", "_meta": {"review_status": "reviewed"}}

    def setUp(self):
        tmp = tempfile.TemporaryDirectory()
        self.addCleanup(tmp.cleanup)
        self.drafts = os.path.join(tmp.name, "drafts")
        self.sidecar = os.path.join(tmp.name, "mnemonics.json")
        with open(self.sidecar, "w", encoding="utf-8") as f:
            json.dump({"x": self.REVIEWED}, f)
        # x: reviewed in the sidecar, an older passing draft on disk.
        # z: a passing draft on disk that never reached the sidecar.
        for slug in ("x", "z"):
            self.draft(slug, {"meaning_mnemonic": f"stale {slug}"})
        fake = types.ModuleType("anthropic")
        ended = types.SimpleNamespace(processing_status="ended")
        fake.Anthropic = lambda: types.SimpleNamespace(messages=types.SimpleNamespace(
            batches=types.SimpleNamespace(retrieve=lambda _id: ended)))
        for patcher in (
            mock.patch.dict(sys.modules, {"anthropic": fake}),
            mock.patch.object(gm, "DRAFTS_DIR", self.drafts),
            mock.patch.object(gm, "sidecar_path", lambda _kind: self.sidecar),
            mock.patch.object(gm, "_context_for", lambda _kind, slug: {"level": 6, "slug": slug}),
            mock.patch.object(gm, "validate_draft", lambda *a, **k: []),
            mock.patch.object(gm, "build_request", lambda kind, slug, attempt, ctx, errors=None: {
                "custom_id": f"level-06--{kind}--{slug}--attempt{attempt}"}),
        ):
            patcher.start()
            self.addCleanup(patcher.stop)

    def draft(self, slug, tool_input):
        path = os.path.join(self.drafts, "level-06", "kanji", f"{slug}.json")
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"slug": slug, "level": 6, "kind": "kanji", "attempts": [],
                       "status": "draft", "tool_input": tool_input,
                       "prompt_version": gm.PROMPT_VERSION["kanji"]}, f)

    def entries(self):
        with open(self.sidecar, encoding="utf-8") as f:
            return json.load(f)

    @staticmethod
    def answers(slugs):
        return {f"level-06--kanji--{s}--attempt1": {"tool_input": {"meaning_mnemonic": f"new {s}"}}
                for s in slugs}

    def test_run_keeps_a_reviewed_entry_and_merges_what_it_handled(self):
        with mock.patch.object(gm, "_submit_and_collect",
                               lambda _c, requests, _t: self.answers(
                                   r["custom_id"].split("--")[2] for r in requests)), \
                mock.patch("sys.stdout", io.StringIO()):
            gm.cmd_run(argparse.Namespace(kind="kanji", slugs=["x", "y", "z"]))
        entries = self.entries()
        self.assertEqual(entries["x"], self.REVIEWED)
        self.assertEqual(entries["y"]["meaning_mnemonic"], "new y")
        self.assertEqual(entries["z"]["meaning_mnemonic"], "stale z")

    def test_collect_merges_only_the_batch_slugs(self):
        with mock.patch.object(gm, "_batch_outcomes", lambda *_a: self.answers(["y"])), \
                mock.patch("sys.stdout", io.StringIO()):
            gm.cmd_collect(argparse.Namespace(kind="kanji", batch_id="msgbatch_1"))
        entries = self.entries()
        self.assertEqual(set(entries), {"x", "y"})
        self.assertEqual(entries["x"], self.REVIEWED)


class NothingToDoTest(unittest.TestCase):
    def run_main(self, *argv):
        out = io.StringIO()
        with mock.patch.object(sys, "argv", ["generate_mnemonics", *argv]), \
                mock.patch.object(gm, "default_slugs", return_value=[]), \
                mock.patch.object(gm, "cmd_run") as run, \
                mock.patch.object(gm, "cmd_webprompts") as webprompts, \
                mock.patch("sys.stdout", out):
            gm.main()
        self.assertFalse(run.called or webprompts.called)
        return out.getvalue().strip()

    def test_run_with_an_empty_level_says_so(self):
        self.assertEqual(self.run_main("run", "--type", "kanji", "--level", "6"),
                         "nothing to do: no items without content at level 6")

    def test_webprompts_with_an_empty_range_says_so(self):
        self.assertEqual(self.run_main("webprompts", "--type", "radical", "--levels", "1-20"),
                         "nothing to do: no items without content at levels 1-20")


if __name__ == "__main__":
    unittest.main()
