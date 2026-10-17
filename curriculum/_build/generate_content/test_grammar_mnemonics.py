# curriculum/_build/generate_content/test_grammar_mnemonics.py
# -*- coding: utf-8 -*-
"""Grammar mnemonics (docs/superpowers/specs/2026-10-17-grammar-mnemonics-design.md)."""
import os
import sys
import unittest

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import mnemonic_context as mc  # noqa: E402


class OriginTableTest(unittest.TestCase):
    def test_checker_reports_missing_unknown_and_malformed_entries(self):
        table = {
            "review_status": "draft",
            "origins": {
                "teoku": {"word": "置く", "gloss": "to put down", "keywords": ["put"]},
                "wo": None,
                "zz-unknown": None,
                "ga": {"word": "", "gloss": "x", "keywords": []},
            },
        }
        errors = mc.origin_table_errors(table, ["teoku", "wo", "ga", "desu"])
        self.assertIn("grammar_origins.json has no entry for 'desu' (write an origin or null)", errors)
        self.assertIn("grammar_origins.json lists unknown slug 'zz-unknown'", errors)
        self.assertIn(
            "grammar_origins.json entry 'ga' needs a non-empty word, gloss and keywords list, or null",
            errors,
        )
        self.assertEqual(len(errors), 3)

    def test_checker_rejects_an_unknown_review_status(self):
        errors = mc.origin_table_errors({"review_status": "done", "origins": {}}, [])
        self.assertEqual(errors, ["grammar_origins.json review_status must be 'draft' or 'reviewed'"])

    def test_scope_is_the_161_n5_and_n4_points(self):
        slugs = mc.grammar_mnemonic_slugs()
        self.assertEqual(len(slugs), 161)
        self.assertEqual(len(set(slugs)), 161)

    def test_shipped_table_covers_exactly_the_scope(self):
        table = mc.load_grammar_origins()
        self.assertEqual(mc.origin_table_errors(table, mc.grammar_mnemonic_slugs()), [])


class GrammarContextTest(unittest.TestCase):
    TABLE = {
        "review_status": "reviewed",
        "origins": {"teoku": {"word": "置く", "gloss": "to put down", "keywords": ["put", "set"]},
                    "wa-topic": None},
    }

    def test_context_carries_the_point_and_its_origin(self):
        ctx = mc.grammar_context("n4", "teoku", self.TABLE)
        self.assertEqual(ctx["form"], "ておく")
        self.assertIn("ておく", ctx["accepted_forms"])
        self.assertEqual(ctx["origin"]["word"], "置く")
        self.assertTrue(ctx["lesson_opening"])
        self.assertNotIn("## ", ctx["lesson_opening"])
        self.assertIn("買う", ctx["allowed_index"])
        self.assertIn("買", ctx["allowed_kanji"])

    def test_null_origin_is_kept_as_none(self):
        self.assertIsNone(mc.grammar_context("n5", "wa-topic", self.TABLE)["origin"])

    def test_slug_without_a_table_entry_raises(self):
        with self.assertRaises(KeyError):
            mc.grammar_context("n5", "ga", self.TABLE)

    def test_missing_lesson_raises(self):
        with self.assertRaises(FileNotFoundError):
            mc.grammar_lesson_opening("zz-no-such-lesson")

    def test_origin_formatter_states_both_cases(self):
        self.assertIn("置く", mc.format_grammar_origin(self.TABLE["origins"]["teoku"]))
        self.assertIn("put, set", mc.format_grammar_origin(self.TABLE["origins"]["teoku"]))
        self.assertIn("no origin", mc.format_grammar_origin(None))

    def test_cast_formatter_lists_characters_once(self):
        # Jin has two readings in the cast bible; the block names him once.
        block = mc.format_grammar_cast()
        self.assertEqual(block.count("**Jin, the friendly giant**"), 1)


from generate_content import level_check  # noqa: E402
from generate_content.validate_mnemonics import validate_grammar  # noqa: E402

ALLOWED = [
    {"primary_form": w, "accepted_answers": []}
    for w in ("買う", "本", "読む", "私", "学生", "飲む", "水", "魚", "食べる")
]

TEOKU_GOOD = (
    "The night before the picnic, Koichi buys the drinks, puts them down by the door "
    "and nods \"<reading>OK</reading>\": all set <grammar>for later</grammar>. "
    "買っ<reading>ておく</reading>。"
)
WO_GOOD = (
    "At the market, Grandma Kane jabs a finger at one fish and cries \"<reading>Oh!</reading> "
    "That one!\", so the seller knows <grammar>exactly what</grammar> she will buy. "
    "魚<reading>を</reading>買う。"
)
TESHIMAU_GOOD = (
    "Little Shima eats the whole birthday cake, every last crumb, then whispers "
    "\"<reading>shh, Ma!</reading>\", because it is <grammar>all gone, and oops</grammar>. "
    "食べ<reading>てしまう</reading>。"
)
WA_GOOD = (
    "Sei stands up in class and asks \"<reading>Wha</reading>t about me?\", and now "
    "everyone knows <grammar>the topic</grammar> of her next sentence. "
    "私<reading>は</reading>学生です。"
)


def gctx(slug="teoku", form="ておく", accepted=("ておく", "とく"), origin="default"):
    if origin == "default":
        origin = {"word": "置く", "gloss": "to put down", "keywords": ["put", "set"]}
    return {
        "type": "grammar", "level": "n4", "slug": slug, "form": form,
        "accepted_forms": list(accepted), "meaning": "m", "structure": "s", "family": "patterns",
        "lesson_opening": "", "origin": origin, "allowed_vocab": ALLOWED,
        "allowed_index": level_check.build_allowed_index(ALLOWED),
        "allowed_kanji": {ch for v in ALLOWED for ch in v["primary_form"]
                          if "一" <= ch <= "鿿"},
    }


def wa_ctx():
    return gctx(slug="wa-topic", form="は", accepted=("は",), origin=None)


def wo_ctx():
    return gctx(slug="wo", form="を", accepted=("を",), origin=None)


def teshimau_ctx():
    return gctx(slug="teshimau", form="てしまう", accepted=("てしまう", "ちゃう"), origin={
        "word": "仕舞う", "gloss": "to finish, put away",
        "keywords": ["finish", "all gone", "every last", "put away"]})


def check(text, ctx=None):
    return validate_grammar("n4", (ctx or gctx())["slug"], {"mnemonic_text": text}, ctx or gctx())


class GrammarGateTest(unittest.TestCase):
    def test_reference_examples_pass(self):
        self.assertEqual(check(TEOKU_GOOD), [])
        self.assertEqual(check(WA_GOOD, wa_ctx()), [])
        self.assertEqual(check(WO_GOOD, wo_ctx()), [])
        self.assertEqual(check(TESHIMAU_GOOD, teshimau_ctx()), [])

    def test_quoted_speech_does_not_end_a_sentence(self):
        # "Oh! That one!" would be three sentences to a plain splitter.
        self.assertEqual(check(WO_GOOD, wo_ctx()), [])

    def test_missing_text(self):
        self.assertEqual(check(""), ["mnemonic_text is missing or empty"])

    def test_unknown_keys_are_rejected(self):
        errors = validate_grammar("n4", "teoku", {"mnemonic_text": TEOKU_GOOD, "description": "x"}, gctx())
        self.assertEqual(errors, ["unexpected key(s) description; submit only mnemonic_text"])

    def test_length_band(self):
        short = "\"<reading>OK</reading>\", <grammar>for later</grammar>. 買っ<reading>ておく</reading>。"
        self.assertTrue(any("too short" in e for e in check(short)))

    def test_three_story_sentences_fail(self):
        text = TEOKU_GOOD.replace("Koichi buys", "Koichi wakes. He yawns. He buys")
        self.assertTrue(any("sentences; write at most 2" in e for e in check(text)))

    def test_other_tags_fail(self):
        text = TEOKU_GOOD.replace("<grammar>for later</grammar>", "<kanji>for later</kanji>")
        self.assertTrue(any("<kanji>" in e for e in check(text)))

    def test_reading_needs_english_and_kana(self):
        no_english = TEOKU_GOOD.replace("<reading>OK</reading>", "OK")
        self.assertTrue(any("no English sound-alike" in e for e in check(no_english)))
        no_kana = TEOKU_GOOD.replace("<reading>ておく</reading>", "ておく")
        self.assertTrue(any("kana of the form" in e for e in check(no_kana)))

    def test_grammar_tag_required_and_english(self):
        self.assertTrue(any("no <grammar> tag" in e for e in check(
            TEOKU_GOOD.replace("<grammar>for later</grammar>", "for later"))))
        self.assertTrue(any("<grammar> must wrap English" in e for e in check(
            TEOKU_GOOD.replace("<grammar>for later</grammar>", "<grammar>あとで</grammar>"))))

    def test_example_must_end_the_text(self):
        text = TEOKU_GOOD.replace(" 買っ<reading>ておく</reading>。", " Done.")
        self.assertTrue(any("must end on a short Japanese example" in e for e in check(text)))

    def test_example_must_attach_the_form(self):
        text = TEOKU_GOOD.replace("買っ<reading>ておく</reading>。", "<reading>ておく</reading>。")
        self.assertTrue(any("form attached to a word" in e for e in check(text)))

    def test_example_words_above_level_fail(self):
        text = TEOKU_GOOD.replace("買っ", "冷蔵庫に入れ")
        self.assertTrue(any("uses words above N4" in e for e in check(text)))

    def test_example_kanji_must_come_from_allowed_words(self):
        # 飲 is allowed (飲む); 酒 appears in no allowed word, so it has no furigana source.
        text = TEOKU_GOOD.replace("買っ", "酒を飲んで")
        self.assertTrue(any("kanji 酒" in e for e in check(text)))

    def test_origin_keyword_required(self):
        # Both keywords must go: "all set" would still satisfy "set".
        text = TEOKU_GOOD.replace("puts them down", "leaves them").replace("all set", "all ready")
        self.assertTrue(any("act out the origin 置く" in e for e in check(text)))

    def test_no_origin_rejects_origin_phrases(self):
        text = WA_GOOD.replace("and now everyone", "は really is a topic word, and everyone")
        self.assertTrue(any("states an origin" in e for e in check(text, wa_ctx())))

    def test_tag_inside_a_word_is_read_as_one_word(self):
        # "<reading>Wha</reading>t" must strip to "What", one word.
        self.assertEqual(check(WA_GOOD, wa_ctx()), [])

    def test_any_accepted_form_satisfies_the_form_rules(self):
        text = TEOKU_GOOD.replace("買っ<reading>ておく</reading>。", "買っ<reading>とく</reading>。")
        self.assertEqual(check(text), [])


from generate_content import generate_mnemonics as gm  # noqa: E402


class GeneratorWiringTest(unittest.TestCase):
    TABLE = GrammarContextTest.TABLE

    def test_prompt_has_every_token_filled(self):
        ctx = mc.grammar_context("n4", "teoku", self.TABLE)
        prompt = gm.build_user_prompt("grammar", ctx)
        self.assertNotIn("{{", prompt)
        self.assertIn("ておく", prompt)
        self.assertIn("置く", prompt)
        self.assertIn(gm.WEB_TOOL_LINE["grammar"], prompt)

    def test_web_prompt_swaps_the_tool_line(self):
        ctx = mc.grammar_context("n4", "teoku", self.TABLE)
        text = gm._web_prompt_text("n4", "grammar", ctx)
        self.assertNotIn(gm.WEB_TOOL_LINE["grammar"], text)
        self.assertIn('"mnemonic_text": "..."', text)

    def test_unreviewed_table_is_refused(self):
        # Complete, so the only thing wrong is the status.
        draft = {"review_status": "draft",
                 "origins": {slug: None for slug in mc.grammar_mnemonic_slugs()}}
        with self.assertRaises(SystemExit) as raised:
            gm.require_reviewed_origins(draft)
        self.assertIn("not reviewed", str(raised.exception))

    def test_incomplete_table_is_refused(self):
        with self.assertRaises(SystemExit) as raised:
            gm.require_reviewed_origins({"review_status": "reviewed", "origins": {}})
        self.assertIn("has no entry for", str(raised.exception))

    def test_sidecar_lives_with_grammar(self):
        self.assertTrue(gm.sidecar_path("grammar").endswith("curriculum/grammar/mnemonics.json"))
        self.assertEqual(gm.PROMPT_VERSION["grammar"], 1)


class GateReviewFixesTest(unittest.TestCase):
    """Final-review findings: points whose own form is kanji, and Japanese or
    form= attributes outside the checked example."""

    @staticmethod
    def real(slug):
        return mc.grammar_context("n4", slug, mc.load_grammar_origins())

    def test_point_whose_form_is_kanji_can_pass(self):
        # 代 is in no allowed word, but it is the point's own form.
        text = (
            "Koichi has to stay at the shop, so little Sho goes to the market and shouts "
            "\"<reading>Cow, wah, really!</reading>\": he will go <grammar>instead of him</grammar> today. "
            "私が行く<reading>代わりに</reading>、弟が買う。"
        )
        ctx = self.real("kawarini")
        self.assertEqual(validate_grammar("n4", "kawarini", {"mnemonic_text": text}, ctx), [])

    def test_form_without_kana_takes_the_form_as_its_reading(self):
        text = (
            "Ken the dog barks \"<reading>Hang, men!</reading>\" at the cat, but the cat "
            "only shows the <grammar>flip side</grammar> of a fluffy tail. 便利だが高い<reading>反面</reading>、"
            "安い。"
        )
        ctx = self.real("kke2")
        errors = validate_grammar("n4", "kke2", {"mnemonic_text": text}, ctx)
        self.assertFalse(any("kana of the form" in e for e in errors), errors)

    def test_japanese_in_the_story_is_rejected(self):
        text = TEOKU_GOOD.replace("buys the drinks", "buys the 水 drinks")
        self.assertTrue(any("story must be English" in e for e in check(text)))

    def test_second_japanese_sentence_before_the_example_is_rejected(self):
        text = WO_GOOD.replace("she will buy. ", "she will buy. 魚を食べる。 ")
        self.assertTrue(any("story must be English" in e for e in check(text, wo_ctx())))

    def test_form_attribute_on_a_tag_is_rejected(self):
        text = TEOKU_GOOD.replace("<grammar>for later</grammar>", '<grammar form="過">for later</grammar>')
        self.assertTrue(any("form=" in e for e in check(text)))


if __name__ == "__main__":
    unittest.main()
