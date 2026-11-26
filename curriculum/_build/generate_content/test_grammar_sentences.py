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

    def test_anchor_on_text_that_is_not_the_grammar_raises(self):
        # ので is present, but it is not an accepted form of a から point.
        with self.assertRaises(ValueError):
            gs.grammar_span("寒いので、コートを着ます。", ["から", "ですから"], form="寒い|ので")

    def test_authored_form_without_any_accepted_form_raises(self):
        with self.assertRaises(ValueError):
            gs.grammar_span("寒いので、コートを着ます。", ["から"], form="ので")

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

    def test_kamaimasen_is_not_negative(self):
        # てもかまいません / てもかまわない mean "may" — affirmative in sense.
        self.assertEqual(gs.sentence_shape("ここで待ってもかまいません。"), (False, False, False))
        self.assertEqual(gs.sentence_shape("ここで待ってもかまわない。"), (False, False, False))
        self.assertEqual(gs.sentence_shape("ここで待ってもかまいませんか。"), (True, False, False))


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
            [{"jp": "今日は寒いから。", "en": "Because it's cold today.", "form": "から", "start": 5}],
        )


class ClozeEdgeCaseTest(unittest.TestCase):
    def test_every_blank_is_filled(self):
        self.assertEqual(
            gs.fill_cloze("週末は映画＿＿＿買い物＿＿＿したいです。", "とか"),
            "週末は映画とか買い物とかしたいです。",
        )

    def test_longer_blank_run_leaves_no_stray_mark(self):
        self.assertEqual(
            gs.fill_cloze("お酒を飲まない＿＿＿＿。", "ことにしました"),
            "お酒を飲まないことにしました。",
        )

    def test_conjugation_chain_is_not_a_sentence(self):
        variants = [{"jp_cloze": "書く → 書い＿＿＿", "english": "write", "answer": "て"}]
        self.assertEqual(gs.cloze_examples(variants, existing_japanese=set()), [])

    def test_start_is_the_blank_position_not_the_first_match(self):
        variants = [{"jp_cloze": "どこから帰ります＿＿＿。", "english": "Where from?", "answer": "か"}]
        [example] = gs.cloze_examples(variants, existing_japanese=set())
        self.assertEqual(example["jp"], "どこから帰りますか。")
        self.assertEqual(example["start"], 8)


class PoliteRequestTest(unittest.TestCase):
    def test_kudasai_is_polite(self):
        self.assertEqual(gs.register_of("ちょっと待ってください。"), "polite")


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
