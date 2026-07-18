import sys
import os

BUILD_DIR = "/Users/riyazahmed/Projects/japanese-learning/curriculum/_build"
sys.path.insert(0, BUILD_DIR)
import furigana as furigana_lib
from generate_content import level_check

tagger = furigana_lib.get_tagger()
text = "多分ここは人が多いです。"
for token in tagger(text):
    pos1 = level_check._feature(token, "pos1")
    surface = token.surface
    lemma = level_check._feature(token, "lemma")
    kana_bases = [
        furigana_lib.katakana_to_hiragana(k)
        for k in (level_check._feature(token, "pronBase"), level_check._feature(token, "lForm"))
        if k
    ]
    print(f"{surface}: pos1={pos1}, lemma={lemma}, kana_bases={kana_bases}")
