# -*- coding: utf-8 -*-
"""Build the KANJIDIC reading map `curriculum/_build/kanjidic_readings.json`.

Reading regularity — "can this word's reading be assembled from its kanji's
readings, or does it need a story?" — is judged against the **dictionary**, not
against which readings our curriculum happens to teach (plan v2, "Interaction
with the mnemonic pipeline"). `generate_content/mnemonic_context.py` asks that
question on every vocabulary prompt, so it needs KANJIDIC at prompt time.

KANJIDIC2 itself is not committed (`curriculum/_build/data/` is gitignored), so
this script distills it to the one thing the generator needs and checks that in.

**Every kanji in KANJIDIC2 is included, not just the ones the curriculum uses
today.** Filtering to current usage would save ~500 KB and buy a stale-artifact
bug: adding a word with a new kanji would silently fall through to "irregular"
and get a reading story it does not need. The whole dictionary never goes stale.

Kunyomi are stored stripped of KANJIDIC2's okurigana markers (`た.べる` -> `た`,
`-がわ` -> `がわ`), because that stem is the part a kanji actually contributes to
a word's reading. Onyomi are hiragana, as `load_kanjidic2` returns them.

Source: KANJIDIC2 (EDRDG, CC BY-SA 4.0; see repo-root NOTICE).
Run: `curriculum/_build/.venv/bin/python curriculum/_build/import/build_kanjidic_readings.py`
"""

import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
if os.path.dirname(os.path.abspath(__file__)) not in sys.path:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import sources  # noqa: E402


def _kun_stem(reading):
    """`た.べる` -> `た`, `-がわ` -> `がわ`, `おお.きい` -> `おお`."""
    return reading.split(".")[0].strip("-")


def main():
    kanjidic = sources.load_kanjidic2()
    out = {}
    for char, entry in kanjidic.items():
        onyomi = list(dict.fromkeys(entry["onyomi"]))
        kunyomi = list(dict.fromkeys(
            stem for stem in (_kun_stem(r) for r in entry["kunyomi"]) if stem
        ))
        if onyomi or kunyomi:
            out[char] = {"on": onyomi, "kun": kunyomi}

    path = os.path.join(BUILD_DIR, "kanjidic_readings.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        f.write("\n")

    print(f"Wrote {os.path.relpath(path, CURRICULUM_DIR)}: {len(out)} kanji "
          f"({len(kanjidic) - len(out)} in KANJIDIC2 carry no reading), "
          f"{os.path.getsize(path) // 1024} KB.")


if __name__ == "__main__":
    main()
