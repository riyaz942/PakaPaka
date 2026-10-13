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
