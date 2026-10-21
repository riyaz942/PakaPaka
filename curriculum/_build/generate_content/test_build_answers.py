# curriculum/_build/generate_content/test_build_answers.py
# -*- coding: utf-8 -*-
import argparse
import copy
import json
import os
import shutil
import sys
import tempfile
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import build_answers as ba  # noqa: E402

TEA = "お茶が熱いうちに飲んだ方がいいですよ。"
TEA_WA = "お茶は熱いうちに飲んだ方がいいですよ。"
MEETING = "会議の間、電話を消した。"
MEETING_FIXED = "会議の間に、電話を消した。"


class NormalizeTest(unittest.TestCase):
    def test_normalize(self):
        self.assertEqual(ba.normalize("お茶は、熱い　ウチに。"), "お茶は熱いうちに")


class CheckReplyTest(unittest.TestCase):
    SENTENCES = [TEA, MEETING, "雨の場合、傘を持って行きます。"]

    def test_check_reply_good_and_bad(self):
        good = {"sentences": [
            {"japanese": TEA, "verdict": "ok", "reason": "x"},
            {"japanese": MEETING, "verdict": "fix", "fixed": MEETING_FIXED, "reason": "x"},
            {"japanese": self.SENTENCES[2], "verdict": "unfixable", "reason": "x"},
        ]}
        self.assertEqual(ba.check_reply_errors(good, self.SENTENCES), [])
        bad = {"sentences": [
            {"japanese": TEA, "verdict": "fix", "reason": "x"},
            {"japanese": MEETING, "verdict": "fix", "fixed": MEETING, "reason": "x"},
            {"japanese": "知らない文。", "verdict": "ok", "reason": "x"},
        ]}
        errors = ba.check_reply_errors(bad, self.SENTENCES)
        self.assertTrue(any("sentences[0]" in e and "fixed" in e for e in errors))
        self.assertTrue(any("sentences[1]" in e and "fixed" in e for e in errors))
        self.assertTrue(any("sentences[2]" in e and "not a listed sentence" in e for e in errors))
        self.assertTrue(any(self.SENTENCES[2] in e and "exactly one" in e for e in errors))

    def test_not_a_list(self):
        self.assertEqual(ba.check_reply_errors({}, [TEA]), ["sentences must be a list"])


class ApplyFixesTest(unittest.TestCase):
    ENTRY = {"sentences": [
        {"japanese": MEETING, "english": "x", "vocabulary_slugs": [],
         "alternates": [{"japanese": "会議の間は、電話を消した。", "kind": "valid"}]},
        {"japanese": TEA, "english": "x", "vocabulary_slugs": [], "alternates": []},
    ], "_meta": {"review_status": "draft"}}

    def test_apply_fixes_replaces_text_and_clears_alternates(self):
        reply = {"sentences": [
            {"japanese": MEETING, "verdict": "fix", "fixed": MEETING_FIXED, "reason": "one action"},
            {"japanese": TEA, "verdict": "ok", "reason": "x"},
        ]}
        fixed, fixes = ba.apply_fixes(self.ENTRY, reply)
        self.assertEqual(fixed["sentences"][0]["japanese"], MEETING_FIXED)
        self.assertEqual(fixed["sentences"][0]["alternates"], [])
        self.assertEqual(fixed["sentences"][1]["japanese"], TEA)
        expected = [{"old": MEETING, "new": MEETING_FIXED, "reason": "one action"}]
        self.assertEqual(fixes, expected)
        self.assertEqual(fixed["_meta"]["sentence_fixes"], expected)
        self.assertEqual(self.ENTRY["sentences"][0]["japanese"], MEETING)  # input untouched


class ProposeReplyTest(unittest.TestCase):
    def test_propose_reply_errors(self):
        good = {"answers": [{"japanese": TEA, "candidates": [TEA_WA]}]}
        self.assertEqual(ba.propose_reply_errors(good, [TEA]), [])
        too_many = {"answers": [{"japanese": TEA, "candidates": [f"{i}" for i in range(11)]}]}
        errors = ba.propose_reply_errors(too_many, [TEA])
        self.assertTrue(any(TEA in e and "10" in e for e in errors))
        missing = {"answers": [{"japanese": TEA, "candidates": []}]}
        errors = ba.propose_reply_errors(missing, [TEA, MEETING])
        self.assertTrue(any(MEETING in e and "exactly one" in e for e in errors))

    def test_candidates_must_be_strings(self):
        reply = {"answers": [{"japanese": TEA, "candidates": [""]}]}
        self.assertTrue(ba.propose_reply_errors(reply, [TEA]))


class FilterTest(unittest.TestCase):
    def test_filter_drops_normalised_duplicates(self):
        kept, dropped = ba.filter_candidates(
            ["お茶が熱いうちに飲んだ方がいいですよ", TEA_WA, TEA_WA], [TEA], lambda c: [])
        self.assertEqual(kept, [TEA_WA])
        self.assertEqual(len(dropped), 2)
        self.assertTrue(all("duplicate" in reason for _, reason in dropped))

    def test_filter_drops_gate_failures_with_reason(self):
        error = "rule 6: missing words ['ocha']"
        kept, dropped = ba.filter_candidates(
            [TEA_WA, "おちゃはあついうちに飲んだ方がいいですよ。"], [TEA],
            lambda c: [error] if c.startswith("おちゃ") else [])
        self.assertEqual(kept, [TEA_WA])
        self.assertEqual(dropped, [("おちゃはあついうちに飲んだ方がいいですよ。", error)])


class OtherGrammarPairsTest(unittest.TestCase):
    def test_other_grammar_pairs(self):
        self.assertEqual(
            ba.other_grammar_pairs(TEA, "うちに", ["お茶が熱い間に飲んだ方がいいですよ。"], TEA_WA),
            ["お茶は熱い間に飲んだ方がいいですよ。"])

    def test_no_pair_when_the_valid_alternate_lacks_the_chunk(self):
        self.assertEqual(
            ba.other_grammar_pairs(TEA, "うちに", ["お茶が熱い間に飲んだ方がいいですよ。"],
                                   "お茶は熱い前に飲んだ方がいいですよ。"), [])


CANDIDATES = [(0, TEA_WA), (0, "お茶が熱いうちに飲んだ方はいいですよ。")]
REPLY = {"verdicts": [
    {"candidate": CANDIDATES[0][1], "verdict": "valid", "reason": "x"},
    {"candidate": CANDIDATES[1][1], "verdict": "wrong", "reason": "x"},
]}


class VerdictTest(unittest.TestCase):
    def test_good_reply(self):
        self.assertEqual(ba.verdict_errors(REPLY, CANDIDATES), [])

    def test_missing_unknown_and_bad_verdicts(self):
        bad = {"verdicts": [
            {"candidate": CANDIDATES[0][1], "verdict": "maybe"},
            {"candidate": "お茶を熱いうちに。", "verdict": "valid"},
            "x",
        ]}
        errors = ba.verdict_errors(bad, CANDIDATES)
        self.assertTrue(any("verdicts[0]" in e and "verdict" in e for e in errors))
        self.assertTrue(any("verdicts[1]" in e and "not a listed candidate" in e for e in errors))
        self.assertTrue(any("verdicts[2]" in e and "object" in e for e in errors))
        self.assertTrue(any(CANDIDATES[1][1] in e and "exactly one" in e for e in errors))

    def test_not_a_list(self):
        self.assertEqual(ba.verdict_errors({}, CANDIDATES), ["verdicts must be a list"])


class MergeTest(unittest.TestCase):
    ENTRY = {"sentences": [{"japanese": TEA, "english": "x", "vocabulary_slugs": [],
                            "alternates": [{"japanese": "お茶が熱い間に飲んだ方がいいですよ。",
                                            "kind": "other_grammar"}]}],
             "_meta": {"review_status": "reviewed"}}

    def test_merge_adds_valid_and_pairs_keeps_status(self):
        merged = ba.merged_entry(self.ENTRY, CANDIDATES, REPLY, "m", {0: "うちに"})
        self.assertEqual(merged["sentences"][0]["alternates"], [
            {"japanese": "お茶が熱い間に飲んだ方がいいですよ。", "kind": "other_grammar"},
            {"japanese": TEA_WA, "kind": "valid"},
            {"japanese": "お茶は熱い間に飲んだ方がいいですよ。", "kind": "other_grammar"},
        ])
        self.assertEqual(merged["_meta"]["review_status"], "reviewed")
        self.assertEqual(merged["_meta"]["answers_check"], {"version": "1", "model": "m"})
        self.assertEqual(len(self.ENTRY["sentences"][0]["alternates"]), 1)  # input untouched


class SelectTest(unittest.TestCase):
    def test_skips_checked_points(self):
        slugs = [g["slug"] for g in ba.context.load_grammar("n4")][:2]
        sidecar = {slugs[0]: {"_meta": {"answers_check": {"version": ba.CHECK_VERSION}}},
                   slugs[1]: {"_meta": {"particle_check": {"version": "1"}}}}
        self.assertEqual(ba.select_slugs("n4", 5, sidecar), [slugs[1]])


class GateTest(unittest.TestCase):
    """Real n4 data: the three cases from the spec."""

    @classmethod
    def setUpClass(cls):
        cls.sidecar = ba.generate.load_pool_sidecar()

    def entry(self, slug):
        return copy.deepcopy(self.sidecar[slug])

    def test_suru_wo_alternate_passes_on_baai(self):
        entry = self.entry("baai")
        sentence = next(s for s in entry["sentences"] if s["japanese"] == "遅れる場合は、先生に電話します。")
        sentence["alternates"] = [{"japanese": "遅れる場合は、先生に電話をします。", "kind": "valid"}]
        self.assertEqual(ba.point_gate_errors("n4", "baai", entry), [])

    def fixed_aida(self, fixed):
        """The aida entry with its meeting/phone sentence (whichever form the
        pool holds now) fixed to `fixed`."""
        entry = self.entry("aida")
        current = next(s["japanese"] for s in entry["sentences"] if "電話を消した" in s["japanese"])
        self.assertNotEqual(current, fixed)
        reply = {"sentences": [
            {"japanese": s["japanese"], "verdict": "ok", "reason": "x"}
            if s["japanese"] != current else
            {"japanese": current, "verdict": "fix", "fixed": fixed, "reason": "x"}
            for s in entry["sentences"]]}
        return ba.apply_fixes(entry, reply)[0]

    def test_fix_on_aida_passes_the_gate(self):
        current = next(s["japanese"] for s in self.entry("aida")["sentences"]
                       if "電話を消した" in s["japanese"])
        fixed = MEETING if current == MEETING_FIXED else MEETING_FIXED
        self.assertEqual(ba.fix_gate_errors("n4", "aida", self.fixed_aida(fixed)), [])

    def test_fix_that_drops_a_word_is_rejected(self):
        # The pool gate alone passes this: it never checks the main sentence
        # still holds its listed words.
        errors = ba.fix_gate_errors("n4", "aida", self.fixed_aida("会議の間に、消した。"))
        self.assertTrue(any("denwa" in e for e in errors))

    def test_errors_for_uchi_ni(self):
        item = ba.generate.build_grammar_point("n4", "uchi-ni", self.entry("uchi-ni"))
        built = next(s for s in item["example_sentences"] if s["japanese"] == TEA)
        ctx = ba.gate_context("n4")
        errors = lambda c: ba.candidate_errors(c, built, item, ctx)  # noqa: E731
        self.assertEqual(errors(TEA_WA), [])
        self.assertTrue(errors("おちゃはあついうちにのんだほうがいいですよ。"))
        self.assertTrue(errors("お茶は熱いうちに飲んだ方がいいよ。"))


class IngestTest(unittest.TestCase):
    def test_ingest_without_reply_files_exits(self):
        with tempfile.TemporaryDirectory() as tmp:
            pool_path = os.path.join(tmp, "pool.json")
            shutil.copy(ba.generate.POOL_SIDECAR, pool_path)
            with open(pool_path, encoding="utf-8") as f:
                before = f.read()
            with mock.patch.object(ba.generate, "POOL_SIDECAR", pool_path), \
                    mock.patch.object(ba, "WEB_DIR", tmp):
                os.makedirs(os.path.join(tmp, "n4"))
                with open(os.path.join(tmp, "n4", "uchi-ni.candidates.json"), "w",
                          encoding="utf-8") as f:
                    json.dump([[0, TEA_WA]], f)
                args = argparse.Namespace(level="n4", slug="uchi-ni", model="m")
                with self.assertRaises(SystemExit) as raised:
                    ba.cmd_ingest(args)
                self.assertIn("uchi-ni.judge.reply.md", str(raised.exception))
            with open(pool_path, encoding="utf-8") as f:
                self.assertEqual(f.read(), before)

    def test_ingest_without_candidates_file_exits(self):
        with tempfile.TemporaryDirectory() as tmp, mock.patch.object(ba, "WEB_DIR", tmp):
            args = argparse.Namespace(level="n4", slug="uchi-ni", model="m")
            with self.assertRaises(SystemExit) as raised:
                ba.cmd_ingest(args)
            self.assertIn("judgeprompts", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
