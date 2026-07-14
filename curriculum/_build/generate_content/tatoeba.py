# -*- coding: utf-8 -*-
"""Tatoeba style anchors for grammar lesson prompts (Phase 2a).

Per the Tatoeba lane decision (docs/content-pipeline-plan.md ground rule 2):
these sentences are *style anchors only* — they go into the generation prompt
as examples of real native usage and are never shipped, copied, or paraphrased
into curriculum content. Data files come from
`curriculum/_build/import/fetch_sources.sh --tatoeba`; when they are absent we
degrade to no anchors with a warning rather than failing generation.
"""

import bz2
import functools
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")
JPN_PATH = os.path.join(DATA_DIR, "jpn_sentences.tsv.bz2")
ENG_PATH = os.path.join(DATA_DIR, "eng_sentences.tsv.bz2")
LINKS_PATH = os.path.join(DATA_DIR, "jpn-eng_links.tsv.bz2")

from generate_content import level_check  # noqa: E402


def available():
    return all(os.path.exists(p) for p in (JPN_PATH, ENG_PATH, LINKS_PATH))


def _read_tsv(path):
    with bz2.open(path, "rt", encoding="utf-8") as f:
        for line in f:
            parts = line.rstrip("\n").split("\t")
            if len(parts) >= 2:
                yield parts


@functools.lru_cache(maxsize=1)
def _load():
    jpn = {}
    for parts in _read_tsv(JPN_PATH):
        if len(parts) >= 3:
            jpn[parts[0]] = parts[2]
    eng = {}
    for parts in _read_tsv(ENG_PATH):
        if len(parts) >= 3:
            eng[parts[0]] = parts[2]
    links = {}
    for parts in _read_tsv(LINKS_PATH):
        # first translation link wins; anchors don't need every alternative
        links.setdefault(parts[0], parts[1])
    return jpn, eng, links


def style_anchors(accepted_forms, allowed_index, extra_allowed=(), limit=5,
                  max_candidates=400, max_tokenized=80):
    """Up to `limit` real JP/EN pairs containing one of `accepted_forms`,
    preferring sentences with no out-of-level content words. Deterministic
    (sorted by Tatoeba sentence id)."""
    if not available():
        return []
    jpn, eng, links = _load()

    candidates = []
    for sid in sorted(jpn, key=int):
        text = jpn[sid]
        if len(text) > 40:
            continue
        if any(form in text for form in accepted_forms):
            candidates.append((sid, text))
            if len(candidates) >= max_candidates:
                break

    clean, loose = [], []
    for sid, text in candidates[:max_tokenized]:
        violations = level_check.find_violations(text, allowed_index, extra_allowed)
        english = eng.get(links.get(sid, ""), "")
        entry = {"japanese": text, "english": english}
        if not violations:
            clean.append(entry)
        elif len(violations) <= 2:
            loose.append(entry)
        if len(clean) >= limit:
            break
    return (clean + loose)[:limit]


def format_anchors(anchors):
    if not anchors:
        return "(no style anchors available for this pattern)"
    lines = []
    for a in anchors:
        english = f" — {a['english']}" if a["english"] else ""
        lines.append(f"- {a['japanese']}{english}")
    return "\n".join(lines)
