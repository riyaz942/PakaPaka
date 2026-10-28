# curriculum/_build/generate_content/test_answer_units.py
# -*- coding: utf-8 -*-
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from generate_content import answer_units  # noqa: E402


class AnswerUnitsTest(unittest.TestCase):
    def test_particles_words_and_masu_tail(self):
        units = answer_units.answer_units(
            "今年は学校で日本語を勉強します。",
            "今年[ことし]は学校[がっこう]で日本語[にほんご]を勉強[べんきょう]します。",
            {"kotoshi": "今年", "gakkou": "学校", "nihongo": "日本語", "benkyou-suru": "勉強する"},
            {"start": 13, "end": 15})
        self.assertEqual([(u["surface"], u["role"]) for u in units], [
            ("今年", "word"), ("は", "particle"), ("学校", "word"), ("で", "particle"),
            ("日本語", "word"), ("を", "particle"), ("勉強します", "word")])
        self.assertEqual(units[1]["reading"], "は")
        self.assertEqual(units[2]["reading"], "がっこう")
        self.assertEqual([u["in_grammar"] for u in units], [False] * 6 + [True])

    def test_grammar_particles_form_one_other_unit(self):
        units = answer_units.answer_units(
            "昼ご飯を作ったのに、友達はもう食べました。",
            "昼[ひる]ご飯[はん]を作[つく]ったのに、友[とも]達[だち]はもう食[た]べました。",
            {"hirugohan": "昼ご飯", "tsukuru": "作る", "tomodachi": "友達", "mou": "もう", "taberu": "食べる"},
            {"start": 7, "end": 9})
        self.assertEqual([(u["surface"], u["role"], u["in_grammar"]) for u in units], [
            ("昼ご飯", "word", False), ("を", "particle", False), ("作った", "word", False),
            ("のに", "other", True), ("友達", "word", False), ("は", "particle", False),
            ("もう", "word", False), ("食べました", "word", False)])

    def test_units_rebuild_the_text_without_punctuation(self):
        text = "家へ帰ったのに、友達はもう食べました。"
        units = answer_units.answer_units(
            text, "家[いえ]へ帰[かえ]ったのに、友達[ともだち]はもう食[た]べました。",
            {"ie": "家", "kaeru": "帰る"}, None)
        self.assertEqual("".join(u["surface"] for u in units), "家へ帰ったのに友達はもう食べました")

    def test_te_form_joins_its_verb(self):
        units = answer_units.answer_units("手を洗って食べます。", "手[て]を洗[あら]って食[た]べます。",
                                          {"te": "手", "arau": "洗う", "taberu": "食べる"}, None)
        self.assertIn(("洗って", "word"), [(u["surface"], u["role"]) for u in units])

    def test_readings_follow_the_furigana_not_the_tokenizer(self):
        # The tokenizer reads 私 as わたくし; the furigana (what the grader accepts) says わたし.
        text = "私は明日学校へ行きます。"
        units = answer_units.answer_units(
            text, "私[わたし]は明日[あした]学校[がっこう]へ行[い]きます。",
            {"watashi": "私", "ashita": "明日", "gakkou": "学校", "iku": "行く"}, None)
        self.assertEqual([(u["surface"], u["reading"]) for u in units], [
            ("私", "わたし"), ("は", "は"), ("明日", "あした"), ("学校", "がっこう"),
            ("へ", "へ"), ("行きます", "いきます")])

    def test_unit_cutting_a_furigana_group_is_an_error(self):
        # 日本語[にほんご] is one group; the 日本 word span cuts 語 off it.
        with self.assertRaises(ValueError):
            answer_units.answer_units("日本語を話します", "日本語[にほんご]を話[はな]します",
                                      {"nihon": "日本"}, None)

    def test_furigana_that_does_not_spell_the_text_is_an_error(self):
        with self.assertRaises(ValueError):
            answer_units.answer_units("私です", "僕[ぼく]です", {}, None)


if __name__ == "__main__":
    unittest.main()
