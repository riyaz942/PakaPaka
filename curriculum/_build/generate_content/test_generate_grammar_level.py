# curriculum/_build/generate_content/test_generate_grammar_level.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import generate  # noqa: E402

VOCAB = {"samui": "寒い", "kooto": "コート", "kiru-wear": "着る", "kyou": "今日",
         "iru": "いる", "kaeru": "帰る"}


def entry(**overrides):
    base = {
        "slug": "zz-test-kara",  # no lesson file exists for this slug
        "primary_form": "から",
        "meaning": "because (reason)",
        "structure": "Clause + から",
        "conjugation_rules": {"reason": True},
        "accepted_forms": ["から", "ですから"],
        "examples": [
            generate_ex("寒いから、コートを着ます。", "Because it's cold, I'll wear a coat.",
                        ["samui", "kooto", "kiru-wear"],
                        alts=[("寒いですから、コートを着ます。", "valid"),
                              ("寒いので、コートを着ます。", "other_grammar")]),
        ],
        "vocabulary_slugs": ["samui"],
        "family": "connectors",
        "accepted_meanings": ["because", "since", "so"],
        "cloze_variants": [
            {"jp_cloze": "今日は寒い＿＿＿。", "english": "Because it's cold today.",
             "answer": "から", "nudge": "n"},
            {"jp_cloze": "寒い＿＿＿、コートを着ます。", "english": "dup", "answer": "から",
             "nudge": "n"},
        ],
    }
    base.update(overrides)
    return base


def generate_ex(jp, en, vocab=None, **kw):
    from n5_grammar import ex
    return ex(jp, en, vocab, **kw)


def build(entries):
    return generate._build_grammar_level(
        "N5", entries, VOCAB, None, (), known_vocab_forms=VOCAB
    )["items"][0]


class GrammarLevelTest(unittest.TestCase):
    def test_accepted_meanings_become_accepted_answers(self):
        item = build([entry()])
        self.assertEqual(item["accepted_answers"], [
            {"answer_type": "meaning", "answer_text": "because", "is_primary": True},
            {"answer_type": "meaning", "answer_text": "since", "is_primary": False},
            {"answer_type": "meaning", "answer_text": "so", "is_primary": False},
        ])

    def test_authored_example_gets_span_register_alternates(self):
        first = build([entry()])["example_sentences"][0]
        self.assertEqual(first["grammar_span"], {"start": 2, "end": 4})
        self.assertEqual(first["register"], "polite")
        valid, other = first["build_alternates"]
        self.assertEqual(valid["furigana"], "寒[さむ]いですから、コートを着[き]ます。")
        self.assertEqual(valid["kind"], "valid")
        self.assertEqual("".join(u["surface"] for u in valid["units"]),
                         "寒いですからコートを着ます")
        self.assertEqual(other, {"furigana": "寒[さむ]いので、コートを着[き]ます。",
                                 "kind": "other_grammar"})

    def test_cloze_variants_become_examples_once(self):
        sentences = build([entry()])["example_sentences"]
        self.assertEqual([s["japanese"] for s in sentences],
                         ["寒いから、コートを着ます。", "今日は寒いから。"])
        cloze = sentences[1]
        self.assertEqual(cloze["sort_order"], 1)
        self.assertEqual(cloze["grammar_span"], {"start": 5, "end": 7})
        self.assertEqual(cloze["register"], "plain")
        self.assertEqual(cloze["vocabulary_slugs"], ["kyou", "samui"])
        self.assertNotIn("build_alternates", cloze)

    def test_missing_authored_form_is_a_build_error(self):
        bad = entry(examples=[generate_ex("寒いです。", "It's cold.", ["samui"], form="から")],
                    cloze_variants=[])
        with self.assertRaises(ValueError):
            build([bad])

    def test_cloze_span_is_the_blank_not_an_earlier_match(self):
        # か inside から must not be highlighted for the question marker か.
        ka = entry(accepted_forms=["か"], examples=[], cloze_variants=[
            {"jp_cloze": "どこから帰ります＿＿＿。", "english": "Where from?",
             "answer": "か", "nudge": "n"}])
        [sentence] = build([ka])["example_sentences"]
        self.assertEqual(sentence["japanese"], "どこから帰りますか。")
        self.assertEqual(sentence["grammar_span"], {"start": 8, "end": 9})

    def test_cloze_derived_links_skip_the_grammar_own_words(self):
        # いる inside います is the grammar, not a word to list on a Build card.
        te_iru = entry(accepted_forms=["ています"], examples=[], cloze_variants=[
            {"jp_cloze": "コートを着て＿＿＿。", "english": "I am wearing a coat.",
             "answer": "います", "nudge": "n"}])
        [sentence] = build([te_iru])["example_sentences"]
        self.assertEqual(sentence["japanese"], "コートを着ています。")
        self.assertEqual(sentence["vocabulary_slugs"], ["kooto", "kiru-wear"])

    def test_grammar_example_gets_stem_span(self):
        vocab = {**VOCAB, "iku-v": "行く"}
        item = generate._build_grammar_level(
            "N5",
            [entry(slug="zz-test-mashou", primary_form="ましょう", accepted_forms=["ましょう"],
                   examples=[generate_ex("一緒に行きましょう。", "Let's go together.", ["iku-v"])],
                   cloze_variants=[])],
            vocab, None, (), known_vocab_forms=vocab,
        )["items"][0]
        spans_ = item["example_sentences"][0]["word_spans"]
        self.assertIn({"vocabulary_slug": "iku-v", "start": 3, "end": 5,
                       "surface_form": "行き", "inflection": "stem"}, spans_)

    def test_pool_sentence_carries_answer_units(self):
        vocab = {**VOCAB, "kotoshi": "今年", "gakkou": "学校", "nihongo": "日本語",
                 "benkyou": "勉強する"}
        slugs = ["kotoshi", "gakkou", "nihongo", "benkyou"]
        item = generate._build_grammar_level(
            "N5",
            [entry(slug="zz-test-de", primary_form="で", accepted_forms=["で"],
                   examples=[generate_ex("今年は学校で日本語を勉強します。", "x", slugs,
                                         alts=[("今年は学校で日本語を勉強しました。", "valid")])],
                   cloze_variants=[])],
            vocab, None, (), known_vocab_forms=vocab,
        )["items"][0]
        sentence = item["example_sentences"][0]
        self.assertEqual(sentence["answer_units"][1], {
            "surface": "は", "reading": "は", "role": "particle", "in_grammar": False})
        self.assertEqual(sentence["build_alternates"][0]["units"][-1]["surface"], "勉強しました")

    def test_unannotatable_kanji_alternate_is_a_build_error(self):
        bad = entry(examples=[generate_ex("寒いから、コートを着ます。", "x",
                                          ["samui", "kooto", "kiru-wear"],
                                          alts=[("寒[いから", "valid")])],
                    cloze_variants=[])
        with self.assertRaises(ValueError):
            build([bad])

    POOL = {
        "accepted_meanings": ["because", "since", "so", "as"],
        "sentences": [
            {"japanese": "寒いから、コートを着ます。", "english": "Because it's cold, I'll wear a coat.",
             "vocabulary_slugs": ["samui", "kooto", "kiru-wear"],
             "alternates": [{"japanese": "寒いですから、コートを着ます。", "kind": "valid"}]},
            {"japanese": "今日は寒いから。", "english": "Because it's cold today.",
             "vocabulary_slugs": ["kyou", "samui"], "form": "寒い|から"},
        ],
        "_meta": {"generator_model": "test", "prompt_version": "1", "review_status": "draft"},
    }

    def test_pool_entry_replaces_examples_cloze_and_meanings(self):
        item = generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, (), known_vocab_forms=VOCAB,
            pool_entries={"zz-test-kara": self.POOL},
        )["items"][0]
        self.assertEqual([s["japanese"] for s in item["example_sentences"]],
                         ["寒いから、コートを着ます。", "今日は寒いから。"])
        self.assertEqual(item["example_sentences"][1]["grammar_span"], {"start": 5, "end": 7})
        self.assertEqual([a["answer_text"] for a in item["accepted_answers"]],
                         ["because", "since", "so", "as"])
        self.assertEqual(item["example_sentences"][0]["build_alternates"][0]["kind"], "valid")
        self.assertNotIn("_meta", item)

    def test_point_without_pool_entry_is_unchanged(self):
        item = generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, (), known_vocab_forms=VOCAB, pool_entries={},
        )["items"][0]
        self.assertEqual(len(item["example_sentences"]), 2)

    def test_cloze_variants_do_not_ship(self):
        self.assertNotIn("cloze_variants", build([entry()]))

    def test_generate_level_refuses_a_failing_pool(self):
        from unittest import mock
        with mock.patch.object(generate.pool_check, "check_level",
                               return_value={"kara-because": ["rule 4: 2 passing sentences, need 8"]}), \
             mock.patch.object(generate, "write_json"):
            with self.assertRaises(SystemExit) as raised:
                generate.generate_level("n5")
        self.assertIn("kara-because", str(raised.exception))


from unittest import mock  # noqa: E402


class GrammarMnemonicInlineTest(unittest.TestCase):
    ENTRY = {"mnemonic_text": "A story. 寒いから。",
             "_meta": {"generator_model": "m", "prompt_version": "1", "review_status": "draft"}}

    def build_with(self, entries):
        return generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, (), known_vocab_forms=VOCAB, mnemonic_entries=entries
        )["items"][0]

    def test_sidecar_text_is_inlined(self):
        item = self.build_with({"zz-test-kara": self.ENTRY})
        self.assertEqual(item["mnemonic_text"], "A story. {{samui||寒い}}から。")
        self.assertEqual(item["_meta"]["review_status"], "draft")

    def test_no_entry_means_no_field(self):
        self.assertNotIn("mnemonic_text", self.build_with({}))

    def test_draft_mnemonic_keeps_a_reviewed_lesson_behind_the_gate(self):
        lesson = ({"review_status": "reviewed", "generator_model": "lesson-model"}, "Body.")
        with mock.patch.object(generate, "_load_lesson", return_value=lesson):
            item = self.build_with({"zz-test-kara": self.ENTRY})
        self.assertEqual(item["_meta"]["review_status"], "draft")
        self.assertEqual(item["_meta"]["generator_model"], "lesson-model")


class GrammarMnemonicSidecarErrorsTest(unittest.TestCase):
    ENTRY = GrammarMnemonicInlineTest.ENTRY

    def build_with(self, entries, all_slugs=("zz-test-kara",)):
        return generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, all_slugs, known_vocab_forms=VOCAB,
            mnemonic_entries=entries,
        )

    def test_empty_mnemonic_text_is_an_error(self):
        with self.assertRaises(ValueError) as raised:
            self.build_with({"zz-test-kara": {**self.ENTRY, "mnemonic_text": ""}})
        self.assertIn("zz-test-kara", str(raised.exception))

    def test_sidecar_slug_that_is_no_grammar_point_is_an_error(self):
        with self.assertRaises(ValueError) as raised:
            self.build_with({"zz-typo": self.ENTRY})
        self.assertIn("zz-typo", str(raised.exception))


class GrammarMnemonicLinkTest(unittest.TestCase):
    """The example sentence of a mnemonic links its taught words like a lesson
    does; the story, the tags and the grammar form itself stay as they are."""

    TEXT = ('Jin grunts "<reading>Car, ah</reading>", which is <grammar>because</grammar>. '
            '寒い<reading>から</reading>、コートを着<reading>ている</reading>。')

    def link(self, text=None):
        return generate._link_mnemonic_example(text or self.TEXT, VOCAB, "zz-test-kara")

    def test_words_in_the_example_get_markers(self):
        linked = self.link()
        self.assertIn("{{samui||寒い}}", linked)
        self.assertIn("{{kooto||コート}}", linked)

    def test_story_tags_and_form_are_untouched(self):
        linked = self.link()
        self.assertTrue(linked.startswith(self.TEXT.split("寒")[0]))
        self.assertIn("<reading>から</reading>", linked)
        self.assertIn("<reading>ている</reading>", linked)

    def test_a_word_inside_the_grammar_tag_is_not_linked(self):
        # いる is a taught word, and it is also the end of ている.
        self.assertNotIn("{{iru", self.link())

    def test_a_verb_stem_before_the_tag_links_as_a_stem(self):
        self.assertIn("{{kiru-wear|stem|着}}<reading>ている</reading>", self.link())

    def test_removing_the_markers_gives_the_original_text(self):
        import re
        linked = self.link()
        self.assertEqual(re.sub(r"\{\{[^|{}]+\|[^|{}]*\|([^{}]+)\}\}", r"\1", linked), self.TEXT)

    def test_an_authored_marker_is_rejected(self):
        with self.assertRaises(ValueError):
            self.link(self.TEXT.replace("寒い", "{{samui||寒い}}"))

    def test_text_without_a_japanese_example_is_an_error(self):
        with self.assertRaises(ValueError):
            self.link("Only English here, no example.")

    def test_inlined_mnemonic_carries_the_markers(self):
        item = generate._build_grammar_level(
            "N5", [entry()], VOCAB, None, (), known_vocab_forms=VOCAB,
            mnemonic_entries={"zz-test-kara": {**GrammarMnemonicInlineTest.ENTRY,
                                               "mnemonic_text": self.TEXT}},
        )["items"][0]
        self.assertIn("{{samui||寒い}}", item["mnemonic_text"])


class GrammarSeedsRemovedTest(unittest.TestCase):
    def test_no_skeleton_entry_has_a_mnemonic_seed(self):
        from n4_grammar import N4_GRAMMAR
        from n5_grammar import N5_GRAMMAR
        self.assertEqual([g["slug"] for g in N5_GRAMMAR + N4_GRAMMAR if "mnemonic" in g], [])


if __name__ == "__main__":
    unittest.main()
