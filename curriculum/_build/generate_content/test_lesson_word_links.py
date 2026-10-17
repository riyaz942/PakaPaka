# curriculum/_build/generate_content/test_lesson_word_links.py
# -*- coding: utf-8 -*-
import contextlib
import io
import os
import sys
import unittest

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import generate  # noqa: E402

FORMS = {"ashita": "明日", "hayai": "早い", "okiru": "起きる", "kore": "これ", "gakusei": "学生"}


class LessonWordLinksTest(unittest.TestCase):
    def test_dictionary_inflected_and_stem_words_get_markers(self):
        out = generate._annotate_lesson_markdown(
            "```jp\n明日は早く起きます。\n```", {"明日": "あした"}, "t", FORMS)
        self.assertIn("{{ashita||明日[あした]}}", out)
        self.assertIn("{{hayai|stem|早[はや]く}}", out)
        self.assertIn("{{okiru|masu|起[お]きます}}", out)

    def test_prose_kana_only_word_is_linked(self):
        out = generate._annotate_lesson_markdown("Say これ here.", None, "t", FORMS)
        self.assertEqual(out, "Say {{kore||これ}} here.")

    def test_inline_code_stays_plain(self):
        out = generate._annotate_lesson_markdown("Not `早い起きます` ok.", None, "t", FORMS)
        self.assertEqual(out, "Not `早い起きます` ok.")

    def test_span_cutting_a_furigana_group_is_dropped_with_warning(self):
        # 明日[あした] is one group; a span covering only 明 must not be emitted.
        span = {"vocabulary_slug": "aka", "start": 0, "end": 1}
        with contextlib.redirect_stderr(io.StringIO()) as err:
            out = generate._wrap_spans("明日", "明日[あした]", [span], "t")
        self.assertEqual(out, "明日[あした]")
        self.assertIn("warning", err.getvalue())

    def test_marker_characters_in_lesson_fail(self):
        with self.assertRaises(ValueError):
            generate._annotate_lesson_markdown("bad {{ text", None, "t", FORMS)

    def test_uses_get_word_spans(self):
        entry = {
            "slug": "zz-test-desu",  # no lesson file exists for this slug
            "primary_form": "です",
            "meaning": "is",
            "structure": "N + です",
            "conjugation_rules": {},
            "accepted_forms": ["です"],
            "examples": [],
            "vocabulary_slugs": ["gakusei"],
            "uses": [{"label": "l", "structure": "s", "japanese": "学生です。", "english": "e"}],
        }
        item = generate._build_grammar_level(
            "N5", [entry], FORMS, None, (), known_vocab_forms=FORMS)["items"][0]
        use = item["uses"][0]
        self.assertEqual(use["word_spans"], [{"vocabulary_slug": "gakusei", "start": 0, "end": 2}])


if __name__ == "__main__":
    unittest.main()
