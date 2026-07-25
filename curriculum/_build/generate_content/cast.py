# -*- coding: utf-8 -*-
"""Mnemonic cast bible loader (Phase 2b).

Parses prompts/cast-bible.md — the human-authored, versioned source of truth
for recurring mnemonic characters and settings — into a reading -> character
lookup, so the kanji generator can inject the relevant cast lore into each
item's prompt. Batch calls are independent (docs/content/content-pipeline-plan.md 2b:
"a static style sheet alone won't keep the cast coherent"), so the character
that personifies a reading must travel *inside* the prompt for that item.

The cast bible's "Core cast" table maps a reading (or several, joined by 「・」)
to one character. A kanji's reading target (its primary reading) is matched
against those keys; radicals have no readings and so get only the settings
block plus the general style rules.

Parsing is deliberately tiny (the same spirit as frontmatter.py): we read the
two markdown tables under the `## Core cast` and `## Settings` headings. No YAML
or markdown dependency — we control the file.
"""

import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
CAST_BIBLE_PATH = os.path.join(HERE, "prompts", "cast-bible.md")

_ROW_RE = re.compile(r"^\|(.+)\|$")


def _split_row(line):
    inner = _ROW_RE.match(line.strip())
    if not inner:
        return None
    cells = [c.strip() for c in inner.group(1).split("|")]
    return cells


def _is_separator(cells):
    return all(set(c) <= {"-", ":", " "} and c for c in cells)


def _parse_table(lines, start_idx):
    """Parse a pipe table beginning at/after start_idx; return (rows, next_idx).

    rows are lists of cell strings (header + separator dropped)."""
    rows = []
    i = start_idx
    seen_header = False
    while i < len(lines):
        cells = _split_row(lines[i])
        if cells is None:
            if seen_header:
                break
            i += 1
            continue
        if _is_separator(cells):
            i += 1
            continue
        if not seen_header:
            seen_header = True  # first real row is the header
            i += 1
            continue
        rows.append(cells)
        i += 1
    return rows, i


def _strip_markdown(text):
    """Drop bold/italic markers so a name like **Koichi** reads as Koichi."""
    return text.replace("**", "").replace("*", "").strip()


def load_cast():
    """Parse the cast bible once into a dict:

        {
          "readings": {reading: {"character": str, "trait": str}, ...},
          "settings": [{"setting": str, "details": str}, ...],
          "version": "v1",
        }

    A reading key group like "じん・にん" is expanded into one entry per reading.
    """
    with open(CAST_BIBLE_PATH, encoding="utf-8") as f:
        lines = f.read().split("\n")

    readings = {}
    settings = []
    version = ""
    for i, line in enumerate(lines):
        m = re.match(r"^#\s+.*—\s*(v\d+)\s*$", line.strip())
        if m:
            version = m.group(1)
        heading = line.strip().lower()
        if heading.startswith("## core cast"):
            rows, _ = _parse_table(lines, i + 1)
            for cells in rows:
                if len(cells) < 3:
                    continue
                reading_group, character, trait = cells[0], cells[1], cells[2]
                character = _strip_markdown(character)
                trait = _strip_markdown(trait)
                for reading in _strip_markdown(reading_group).split("・"):
                    reading = reading.strip()
                    if reading:
                        readings[reading] = {"character": character, "trait": trait}
        elif heading.startswith("## settings"):
            rows, _ = _parse_table(lines, i + 1)
            for cells in rows:
                if len(cells) < 2:
                    continue
                settings.append({
                    "setting": _strip_markdown(cells[0]),
                    "details": _strip_markdown(cells[1]),
                })

    return {"readings": readings, "settings": settings, "version": version}


def lore_for_readings(readings, cast=None):
    """Cast entries matching any of `readings` (a kanji's onyomi/kunyomi), in
    the order given, de-duplicated. Empty when no reading has a fixed cast
    member yet — the caller tells the model it may improvise (and asks a
    reviewer to add a row)."""
    cast = cast or load_cast()
    out = []
    seen = set()
    for reading in readings:
        entry = cast["readings"].get(reading)
        if entry and entry["character"] not in seen:
            seen.add(entry["character"])
            out.append({"reading": reading, **entry})
    return out


def format_cast_block(reading_lore, cast=None, subject="this kanji"):
    """The prompt fragment: the matched character(s) for this item's readings,
    plus the shared settings list. Deterministic across runs. `subject` names
    the item in the prose ("this kanji" / "this word")."""
    cast = cast or load_cast()
    parts = []
    if reading_lore:
        parts.append(f"Cast members fixed to {subject}'s reading(s) — use them, "
                     "do not invent a substitute:")
        for entry in reading_lore:
            parts.append(
                f"- Reading 「{entry['reading']}」 → **{entry['character']}**: {entry['trait']}"
            )
    else:
        parts.append(
            f"No cast member is fixed to {subject}'s reading yet. Write a vivid, "
            "reading-appropriate character, but keep it simple and reusable — a "
            "reviewer may promote it into the cast bible."
        )
    if cast["settings"]:
        parts.append("\nShared settings (reuse the fixed details when a scene calls for one):")
        for s in cast["settings"]:
            parts.append(f"- **{s['setting']}**: {s['details']}")
    return "\n".join(parts)
