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
            {"hirugohan": "昼ご飯", "tsukuru": "作る", "tomodachi": "友達", "mou": "もう", "taberu": "食べる"},
            {"start": 7, "end": 9})
        self.assertEqual([(u["surface"], u["role"], u["in_grammar"]) for u in units], [
            ("昼ご飯", "word", False), ("を", "particle", False), ("作った", "word", False),
            ("のに", "other", True), ("友達", "word", False), ("は", "particle", False),
            ("もう", "word", False), ("食べました", "word", False)])

    def test_units_rebuild_the_text_without_punctuation(self):
        text = "家へ帰ったのに、友達はもう食べました。"
        units = answer_units.answer_units(text, {"ie": "家", "kaeru": "帰る"}, None)
        self.assertEqual("".join(u["surface"] for u in units), "家へ帰ったのに友達はもう食べました")

    def test_te_form_joins_its_verb(self):
        units = answer_units.answer_units("手を洗って食べます。", {"te": "手", "arau": "洗う", "taberu": "食べる"}, None)
        self.assertIn(("洗って", "word"), [(u["surface"], u["role"]) for u in units])


if __name__ == "__main__":
    unittest.main()
