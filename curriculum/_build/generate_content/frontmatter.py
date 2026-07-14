# -*- coding: utf-8 -*-
"""Frontmatter for lesson markdown files (curriculum/grammar/lessons/).

Deliberately tiny format — scalars and string lists only — written by
assemble.py and read back by generate.py, so we control both ends and don't
need a YAML dependency:

    ---
    generator_model: claude-opus-4-8
    prompt_version: 1
    review_status: draft
    caution_notes:
      - "..."
    related_grammar_slugs:
      - ga
    ---

Scalar values are unquoted; list items are JSON strings (handles quotes and
unicode round-trip).
"""

import json

DELIMITER = "---"


def parse(text):
    """(meta_dict, body). Files without frontmatter yield ({}, text)."""
    lines = text.split("\n")
    if not lines or lines[0].strip() != DELIMITER:
        return {}, text
    meta = {}
    current_list = None
    for i, line in enumerate(lines[1:], start=1):
        if line.strip() == DELIMITER:
            body = "\n".join(lines[i + 1:]).lstrip("\n")
            return meta, body
        stripped = line.strip()
        if not stripped:
            continue
        if stripped.startswith("- ") and current_list is not None:
            item = stripped[2:].strip()
            if item.startswith('"'):
                item = json.loads(item)
            current_list.append(item)
            continue
        key, _, value = stripped.partition(":")
        key, value = key.strip(), value.strip()
        if value:
            meta[key] = value
            current_list = None
        else:
            meta[key] = []
            current_list = meta[key]
    raise ValueError("unterminated frontmatter block")


def serialize(meta, body):
    lines = [DELIMITER]
    for key, value in meta.items():
        if isinstance(value, list):
            if not value:
                continue
            lines.append(f"{key}:")
            for item in value:
                lines.append(f"  - {json.dumps(item, ensure_ascii=False)}")
        elif value is not None and value != "":
            lines.append(f"{key}: {value}")
    lines.append(DELIMITER)
    return "\n".join(lines) + "\n\n" + body.strip() + "\n"
