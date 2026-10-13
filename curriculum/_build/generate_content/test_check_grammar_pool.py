# curriculum/_build/generate_content/test_check_grammar_pool.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import check_grammar_pool as pool  # noqa: E402

VOCAB = {"samui": "寒い", "kooto": "コート", "kiru-wear": "着る", "atsui": "暑い",
         "mizu": "水", "nomu": "飲む", "kyou": "今日", "iku": "行く"}
ALLOWED = {"寒い", "コート", "着る", "暑い", "水", "飲む", "今日", "行く"}
OTHER = ["ので", "けど"]


def sentence(jp, spans, grammar, register="polite", alts=None):
    s = {"japanese": jp, "english": "x", "word_spans": spans, "register": register,
         "vocabulary_slugs": [sp["vocabulary_slug"] for sp in spans]}
    if grammar:
        s["grammar_span"] = grammar
    if alts:
        s["build_alternates"] = alts
    return s


GOOD = sentence(
    "寒いから、コートを着ます。",
    [{"vocabulary_slug": "samui", "start": 0, "end": 2},
     {"vocabulary_slug": "kooto", "start": 5, "end": 8},
     {"vocabulary_slug": "kiru-wear", "start": 9, "end": 12, "inflection": "masu"}],
    {"start": 2, "end": 4},
)


def item(sentences, meanings=("because", "since", "so"), slug="kara"):
    return {"slug": slug, "accepted_forms": ["から"],
            "accepted_answers": [{"answer_type": "meaning", "answer_text": m} for m in meanings],
            "example_sentences": sentences}


class SentenceRulesTest(unittest.TestCase):
    def errors(self, s):
        return pool.sentence_errors(s, item([s]), ALLOWED, OTHER, VOCAB)

    def test_good_sentence(self):
        self.assertEqual(self.errors(GOOD), [])

    def test_rule1_missing_grammar_span(self):
        s = dict(GOOD)
        del s["grammar_span"]
        self.assertTrue(any("rule 1" in e for e in self.errors(s)))

    def test_rule2_uncovered_word(self):
        s = dict(GOOD, word_spans=GOOD["word_spans"][:2])
        self.assertTrue(any("rule 2" in e and "着" in e for e in self.errors(s)))

    def test_rule3_out_of_range_word(self):
        s = sentence("寒いから、帽子を被ります。",
                     [{"vocabulary_slug": "samui", "start": 0, "end": 2}], {"start": 2, "end": 4})
        self.assertTrue(any("rule 3" in e for e in self.errors(s)))

    def test_rule6_alternates(self):
        s = dict(GOOD, build_alternates=[
            {"furigana": "寒[さむ]いですから、コートを着[き]ます。", "kind": "valid"},
            {"furigana": "寒[さむ]いので、コートを着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ]いので、着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ]いので、コートを着[き]ます。", "kind": "valid"},
            {"furigana": "寒[さむ]いから、コートを着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ", "kind": "valid"},
        ])
        errors = [e for e in self.errors(s) if "rule 6" in e]
        # alt 3 drops コート; alt 4 lacks から; alt 5 has no other-grammar form;
        # alt 6 does not parse.
        self.assertEqual(len(errors), 4)


class FamilyScopeTest(unittest.TestCase):
    def test_n4_family_forms_include_n5_points(self):
        n5 = {g["slug"] for g in pool.context.load_grammar("n5")}
        n4 = {g["slug"] for g in pool.context.load_grammar("n4")}
        through = {g["slug"] for g in pool.grammar_through("n4")}
        self.assertEqual(through, n5 | n4)


class PointRulesTest(unittest.TestCase):
    def test_rule4_too_few_sentences(self):
        errors = pool.point_errors(item([GOOD]), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 4" in e for e in errors))

    def test_rule5_same_vocab_set(self):
        twin = dict(GOOD, japanese="寒いから、コートを着ます！")
        errors = pool.point_errors(item([GOOD, twin]), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 5" in e and "same words" in e for e in errors))

    def test_rule5_one_shape_only(self):
        errors = pool.point_errors(item([GOOD]), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 5" in e and "shape" in e for e in errors))

    def test_rule5_exempt(self):
        pool.VARIETY_EXEMPT.add("kara")
        try:
            errors = pool.point_errors(item([GOOD]), ALLOWED, OTHER, VOCAB)
            self.assertFalse(any("rule 5" in e and "shape" in e for e in errors))
        finally:
            pool.VARIETY_EXEMPT.discard("kara")

    def test_rule7_meanings(self):
        errors = pool.point_errors(item([GOOD], meanings=("because",)), ALLOWED, OTHER, VOCAB)
        self.assertTrue(any("rule 7" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
