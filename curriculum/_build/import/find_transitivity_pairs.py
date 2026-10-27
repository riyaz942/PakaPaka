# -*- coding: utf-8 -*-
"""List transitive / intransitive verb pairs not yet in `vocab_transitivity_pairs.json`.

The Build-answer explainer names the partner when a learner writes 開く for
開ける. The pair is a hand-checked fact, not a guess, so this script only
*proposes*: two taught verbs whose dictionary forms start with the same kanji run
(開ける / 開く), one tagged "transitive verb" and the other "intransitive verb" in
`vocab_word_types.json`. Shared kanji is a heuristic and misfires on unrelated
meanings, so a person reads the list and writes the real pairs into
`vocab_transitivity_pairs.json` (both directions, {slug: partner_slug}).

Run: `cd curriculum/_build && .venv/bin/python import/find_transitivity_pairs.py`
"""

import json
import os
import re
import sys

IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(IMPORT_DIR)
for path in (IMPORT_DIR, BUILD_DIR):
    if path not in sys.path:
        sys.path.insert(0, path)

_KANJI_RUN_RE = re.compile(r"^[㐀-䶿一-鿿々]+")


def _kanji_run(form):
    match = _KANJI_RUN_RE.match(form)
    return match.group(0) if match else None


def candidates(word_types, forms, known):
    """[(transitive_slug, intransitive_slug)] sharing a kanji run, not yet in `known`."""
    by_run = {}
    for slug, labels in word_types.items():
        run = _kanji_run(forms.get(slug, ""))
        if run and "transitive verb" in labels and "intransitive verb" not in labels:
            by_run.setdefault(run, ([], []))[0].append(slug)
        elif run and "intransitive verb" in labels and "transitive verb" not in labels:
            by_run.setdefault(run, ([], []))[1].append(slug)
    pairs = []
    for transitive, intransitive in by_run.values():
        for t in transitive:
            for i in intransitive:
                if known.get(t) != i:
                    pairs.append((t, i))
    return sorted(pairs)


def main():
    from build_vocab_word_types import _curriculum_words

    with open(os.path.join(BUILD_DIR, "vocab_word_types.json"), encoding="utf-8") as f:
        word_types = json.load(f)
    forms = {slug: form for slug, form, _reading, _seq in _curriculum_words()}
    pairs_path = os.path.join(BUILD_DIR, "vocab_transitivity_pairs.json")
    known = {}
    if os.path.exists(pairs_path):
        with open(pairs_path, encoding="utf-8") as f:
            known = json.load(f)
    for t, i in candidates(word_types, forms, known):
        print(f"{forms[t]} ({t}) ↔ {forms[i]} ({i})")


if __name__ == "__main__":
    main()
