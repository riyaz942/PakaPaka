# -*- coding: utf-8 -*-
"""Assembly: gate-passing drafts → curriculum/grammar/lessons/<level>/<slug>.md.

The lesson file is the reviewable artifact: frontmatter carries the sidecar
metadata (generator_model, prompt_version, review_status — drafts ship as
`draft`, which compile-curriculum warns on / CI can fail on) plus the
caution_notes and related_grammar_slugs that generate.py merges into the
grammar JSON. The body is the plain-Japanese lesson markdown; furigana is
added by generate.py's build-time pass, never stored here, so reviewers edit
plain Japanese.

Candidate cloze_variants are NOT written into the lesson file or shipped —
they stay in the draft JSON (drafts/<level>/<slug>-cloze-candidates.json) as
input for the separate cloze authoring effort (docs/feedback/07–09); existing
curated cloze variants in the *_grammar.py datasets remain the shipped source.
"""

import json
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)
sys.path.insert(0, BUILD_DIR)

from generate_content import frontmatter  # noqa: E402

LESSONS_DIR = os.path.join(CURRICULUM_DIR, "grammar", "lessons")
DRAFTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drafts")


def lesson_path(level, slug):
    return os.path.join(LESSONS_DIR, level, f"{slug}.md")


def write_lesson_file(level, slug, tool_input, generator_model, prompt_version):
    meta = {
        "generator_model": generator_model,
        "prompt_version": prompt_version,
        "review_status": "draft",
        "caution_notes": tool_input.get("caution_notes", []),
        "related_grammar_slugs": tool_input.get("related_grammar_slugs", []),
    }
    path = lesson_path(level, slug)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(frontmatter.serialize(meta, tool_input["lesson_markdown"]))
    return path


def write_cloze_candidates(level, slug, tool_input):
    if not tool_input.get("cloze_variants"):
        return None
    path = os.path.join(DRAFTS_DIR, level, f"{slug}-cloze-candidates.json")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(tool_input["cloze_variants"], f, ensure_ascii=False, indent=2)
        f.write("\n")
    return path
