# curriculum/_build/generate_content/test_particle_alternates.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import particle_alternates as pa  # noqa: E402

TEA = "お茶が熱いうちに飲んだ方がいいですよ。"
TEA_SPAN = {"start": 5, "end": 8}


class CandidatesTest(unittest.TestCase):
    def test_swaps_one_particle_outside_the_grammar_span(self):
        self.assertEqual(pa.particle_swap_candidates(TEA, TEA_SPAN), [
            "お茶は熱いうちに飲んだ方がいいですよ。",
            "お茶が熱いうちに飲んだ方はいいですよ。",
        ])

    def test_never_swaps_inside_the_grammar_span(self):
        # The に of うちに is the grammar itself: no うちには candidate.
        self.assertFalse(any("うちには" in c for c in pa.particle_swap_candidates(TEA, TEA_SPAN)))

    def test_known_answers_are_not_proposed_again(self):
        known = {"お茶は熱いうちに飲んだ方がいいですよ。"}
        self.assertEqual(pa.particle_swap_candidates(TEA, TEA_SPAN, known),
                         ["お茶が熱いうちに飲んだ方はいいですよ。"])

    def test_particles_next_to_another_particle_are_left_alone(self):
        candidates = pa.particle_swap_candidates("学校には行きます。", None)
        self.assertEqual(candidates, [])


CANDIDATES = [(0, "お茶は熱いうちに飲んだ方がいいですよ。"), (0, "お茶が熱いうちに飲んだ方はいいですよ。")]
REPLY = {"verdicts": [
    {"candidate": CANDIDATES[0][1], "verdict": "valid", "reason": "x"},
    {"candidate": CANDIDATES[1][1], "verdict": "wrong", "reason": "x"},
]}


class ReplyTest(unittest.TestCase):
    def test_good_reply(self):
        self.assertEqual(pa.reply_errors(REPLY, CANDIDATES), [])

    def test_missing_unknown_and_bad_verdicts(self):
        bad = {"verdicts": [
            {"candidate": CANDIDATES[0][1], "verdict": "maybe"},
            {"candidate": "お茶を熱いうちに。", "verdict": "valid"},
            "x",
        ]}
        errors = pa.reply_errors(bad, CANDIDATES)
        self.assertTrue(any("verdicts[0]" in e and "verdict" in e for e in errors))
        self.assertTrue(any("verdicts[1]" in e and "not a listed candidate" in e for e in errors))
        self.assertTrue(any("verdicts[2]" in e and "object" in e for e in errors))
        self.assertTrue(any(CANDIDATES[1][1] in e and "exactly one" in e for e in errors))

    def test_not_a_list(self):
        self.assertEqual(pa.reply_errors({}, CANDIDATES), ["verdicts must be a list"])


class MergeTest(unittest.TestCase):
    ENTRY = {"sentences": [{"japanese": TEA, "english": "x", "vocabulary_slugs": [],
                            "alternates": []}],
             "_meta": {"review_status": "reviewed"}}

    def test_adds_only_valid_and_returns_the_point_to_draft(self):
        merged = pa.merged_entry(self.ENTRY, CANDIDATES, REPLY, "m")
        self.assertEqual(merged["sentences"][0]["alternates"],
                         [{"japanese": CANDIDATES[0][1], "kind": "valid"}])
        self.assertEqual(merged["_meta"]["review_status"], "draft")
        self.assertEqual(merged["_meta"]["particle_check"], {"version": "1", "model": "m"})
        self.assertEqual(self.ENTRY["sentences"][0]["alternates"], [])  # input untouched

    def test_no_valid_keeps_the_review_status(self):
        reply = {"verdicts": [dict(v, verdict="wrong") for v in REPLY["verdicts"]]}
        merged = pa.merged_entry(self.ENTRY, CANDIDATES, reply, "m")
        self.assertEqual(merged["_meta"]["review_status"], "reviewed")


class SelectTest(unittest.TestCase):
    def test_skips_checked_points(self):
        slugs = [g["slug"] for g in pa.context.load_grammar("n4")][:2]
        sidecar = {slugs[0]: {"_meta": {"particle_check": {"version": pa.CHECK_VERSION}}},
                   slugs[1]: {"_meta": {}}}
        self.assertEqual(pa.select_slugs("n4", 5, sidecar), [slugs[1]])


if __name__ == "__main__":
    unittest.main()
