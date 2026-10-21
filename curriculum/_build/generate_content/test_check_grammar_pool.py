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
            {"furigana": "暑[あつ]いので、コートを着[き]ます。", "kind": "other_grammar"},
            {"furigana": "寒[さむ]いので、コートを着[き]ません。", "kind": "other_grammar"},
        ])
        errors = [e for e in self.errors(s) if "rule 6" in e]
        # 3 drops コート; 4 lacks から; 5 has no other-grammar form; 6 does not
        # parse; 7 drops 寒い (暑い is a different word); 8 has every word and
        # ので, but swapped back it is 寒いから、コートを着ません。, which is not
        # an accepted answer (only the swap-back check catches this one).
        self.assertEqual(len(errors), 6)
        self.assertTrue(any("alternate[7]" in e for e in errors))

    def test_rule6_pronoun_may_be_dropped(self):
        s = sentence(
            "私は寒いから、コートを着ます。",
            [{"vocabulary_slug": "watashi", "start": 0, "end": 1},
             {"vocabulary_slug": "samui", "start": 2, "end": 4},
             {"vocabulary_slug": "kooto", "start": 7, "end": 10},
             {"vocabulary_slug": "kiru-wear", "start": 11, "end": 14, "inflection": "masu"}],
            {"start": 4, "end": 6},
            alts=[{"furigana": "寒[さむ]いから、コートを着[き]ます。", "kind": "valid"}],
        )
        vocab = {**VOCAB, "watashi": "私"}
        errors = pool.sentence_errors(s, item([s]), ALLOWED | {"私"}, OTHER, vocab,
                                      pronoun_slugs=frozenset({"watashi"}))
        self.assertEqual([e for e in errors if "rule 6" in e], [])


    def test_rule6_suru_verb_may_take_wo(self):
        s = sentence("先生に電話します。",
                     [{"vocabulary_slug": "sensei", "start": 0, "end": 2},
                      {"vocabulary_slug": "denwa-suru", "start": 3, "end": 8, "inflection": "masu"}],
                     None,
                     alts=[{"furigana": "先[せん]生[せい]に電[でん]話[わ]をします。", "kind": "valid"}])
        vocab = {**VOCAB, "sensei": "先生", "denwa-suru": "電話する"}
        errors = pool._alternate_errors(s, item([s]), [], vocab, frozenset())
        self.assertEqual(errors, [])

    def test_split_suru_slugs(self):
        linked = {"denwa-suru": "電話する", "bikkuri-suru": "びっくりする", "sensei": "先生"}
        self.assertEqual(pool.split_suru_slugs("先生に電話をしました。", linked), {"denwa-suru"})
        self.assertEqual(pool.split_suru_slugs("電話を見ました。", linked), set())
        self.assertEqual(pool.split_suru_slugs("先生に電話します。", linked), set())

    def test_rule6_valid_alternate_may_use_another_accepted_form(self):
        s = sentence("水ではありません。", [{"vocabulary_slug": "mizu", "start": 0, "end": 1}],
                     {"start": 1, "end": 7},
                     alts=[{"furigana": "水[みず]じゃありません。", "kind": "valid"},
                           {"furigana": "水[みず]でした。", "kind": "valid"}])
        point = dict(item([s], slug="dewa-arimasen"),
                     accepted_forms=["ではありません", "じゃありません"])
        errors = [e for e in pool.sentence_errors(s, point, ALLOWED, [], VOCAB) if "rule 6" in e]
        # じゃありません is this point's own form; でした is not.
        self.assertEqual(len(errors), 1)
        self.assertIn("alternate[1]", errors[0])


class GrammarOrderTest(unittest.TestCase):
    """Rule 8: a sentence uses only grammar the learner has met (or the core)."""

    def rule8(self, allowed):
        errors = pool.sentence_errors(GOOD, item([GOOD], slug="kara-because"), ALLOWED, OTHER,
                                      VOCAB, level="n5", allowed_grammar=frozenset(allowed))
        return [e for e in errors if "rule 8" in e]

    def test_core_and_earlier_grammar_pass(self):
        self.assertEqual(self.rule8(pool.CORE_GRAMMAR | {"kara-because"}), [])

    def test_later_grammar_is_an_error(self):
        errors = self.rule8({"kara-because", "masu"})
        self.assertEqual(len(errors), 1)
        self.assertIn("を", errors[0])

    def test_conjugated_word_counts_but_dictionary_form_does_not(self):
        # GOOD's 寒い is a word in dictionary form; 寒かった is the past tense.
        s = sentence("寒かったから、コートを着ます。",
                     [{"vocabulary_slug": "samui", "start": 0, "end": 4, "inflection": "ta"},
                      {"vocabulary_slug": "kooto", "start": 7, "end": 10},
                      {"vocabulary_slug": "kiru-wear", "start": 11, "end": 14, "inflection": "masu"}],
                     {"start": 4, "end": 6})
        errors = pool.sentence_errors(s, item([s], slug="kara-because"), ALLOWED, OTHER, VOCAB,
                                      level="n5",
                                      allowed_grammar=pool.CORE_GRAMMAR | {"kara-because"})
        later = [e for e in errors if "rule 8" in e]
        self.assertEqual(len(later), 1)
        self.assertIn("寒かっ", later[0])

    def test_allowed_grammar_follows_lesson_order(self):
        def point(level, slug):
            return next(g for g in pool.context.load_grammar(level) if g["slug"] == slug)
        first = pool.allowed_grammar_for("n5", point("n5", "wa-topic"))
        self.assertIn("wa-topic", first)
        self.assertIn("wo", first)            # core
        self.assertNotIn("te-form", first)    # a later lesson
        n4_first = pool.context.load_grammar("n4")[0]
        self.assertIn("te-form", pool.allowed_grammar_for("n4", n4_first))


class SwapBackPositionTest(unittest.TestCase):
    """The other-grammar swap happens at the grammar position, not at the
    first occurrence of the same-family form."""

    def rule6(self, jp, grammar, alt_plain, forms):
        spans = [{"vocabulary_slug": "mizu", "start": 0, "end": 1},
                 {"vocabulary_slug": "kyou", "start": 2, "end": 4},
                 {"vocabulary_slug": "nomu", "start": 5, "end": 8, "inflection": "masu"}]
        s = sentence(jp, spans, grammar,
                     alts=[{"furigana": alt_plain, "kind": "other_grammar"}])
        errors = pool.sentence_errors(s, item([s]), ALLOWED, forms, VOCAB)
        return [e for e in errors if "rule 6" in e]

    def test_swap_at_the_wrong_occurrence_is_rejected(self):
        # Grammar is the second は; the alternate swaps the first one.
        errors = self.rule6("水は今日は飲みます。", {"start": 4, "end": 5},
                            "水が今日は飲みます。", ["が"])
        self.assertEqual(len(errors), 1)

    def test_swap_at_the_grammar_position_is_accepted_after_an_earlier_match(self):
        # Grammar is が; the alternate's first は is not the swap target.
        errors = self.rule6("水は今日が飲みます。", {"start": 4, "end": 5},
                            "水は今日は飲みます。", ["は"])
        self.assertEqual(errors, [])


class PronounExemptionTest(unittest.TestCase):
    def test_only_droppable_personal_pronouns_are_exempt(self):
        exempt = pool.pronoun_slugs_through("n5")
        self.assertTrue({"watashi", "anata", "kare", "kanojo", "boku"} <= exempt)
        # Question words and demonstratives are content: dropping 何 changes
        # the sentence.
        self.assertEqual(exempt & {"nani", "nan", "doko", "dare", "kore", "sore", "itsu"}, set())

    def test_dropping_a_question_word_is_an_error(self):
        vocab = {**VOCAB, "nani": "何"}
        s = sentence(
            "何を飲みますか。",
            [{"vocabulary_slug": "nani", "start": 0, "end": 1},
             {"vocabulary_slug": "nomu", "start": 2, "end": 5, "inflection": "masu"}],
            {"start": 1, "end": 2},
            alts=[{"furigana": "飲[の]みますか。", "kind": "valid"}],
        )
        errors = pool.sentence_errors(s, item([s]), ALLOWED | {"何"}, OTHER, vocab,
                                      pronoun_slugs=pool.pronoun_slugs_through("n5"))
        self.assertTrue(any("rule 6" in e and "nani" in e for e in errors))


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
