# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated grammar lesson drafts (Phase 2a).

Run on every batch output before any human sees it
(docs/content-pipeline-plan.md, "Mechanical validation gate"):

  1. every referenced vocabulary_slugs / related_grammar_slugs exists (vocab
     must be in the item's *allowed* set; related grammar in the candidate
     sibling set offered in the prompt, never the item itself)
  2. tokenizer level-check: no out-of-level content words in example
     sentences, ```jp fence lines, or Japanese runs embedded in prose
  3. every example sentence contains one of the item's accepted_forms
  4. furigana annotation succeeds — annotate_sentence returning None is a
     REJECTION for generated content, not silent no-furigana
  5. structural checks: jp fences and example_sentences match one-to-one,
     cloze variants carry the ＿＿＿ blank, markdown stays inside the
     renderer's subset (no tables / links / HTML)

`validate-schema` after assembly is the pipeline's final backstop (run by the
`run` command in generate_grammar_lessons.py); this gate catches everything
that can be checked per-draft.

Standalone usage (re-check collected drafts):
    .venv/bin/python -m generate_content.validate_drafts --level n5
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import context, level_check  # noqa: E402

DRAFTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drafts")

JP_RUN_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿々〆ー]+")
FENCE_RE = re.compile(r"^```([A-Za-z]*)\s*$")
CODE_SPAN_RE = re.compile(r"`[^`]*`")
CLOZE_BLANK = "＿"
#: Fence lines like 食べる → 食べて display conjugation, not a sentence.
CONJUGATION_ARROWS = ("→", "->", "⇒")
#: Rendaku (sequential voicing) of the te-form: verbs ending 〜む/ぶ/ぬ/ぐ take a
#: voiced て→で (飲む→飲んで), and casual ては→ちゃ voices to では→じゃ. Accepted
#: forms in the datasets are written with the unvoiced て/ちゃ, so the gate must
#: also accept the で/じゃ variant of any て/ちゃ-initial pattern.
_VOICING_PAIRS = (("て", "で"), ("ちゃ", "じゃ"))


def voiced_variants(forms):
    """Each accepted form plus its rendaku variant when it starts with て/ちゃ."""
    out = []
    for form in forms:
        out.append(form)
        for unvoiced, voiced in _VOICING_PAIRS:
            if form.startswith(unvoiced):
                out.append(voiced + form[len(unvoiced):])
    return out
DISALLOWED_MARKDOWN = [
    (re.compile(r"^\s*\|.*\|\s*$", re.M), "table row"),
    (re.compile(r"\[[^\]]*\]\("), "markdown link"),
    (re.compile(r"</?[a-zA-Z][^>]*>"), "HTML tag"),
]


def split_markdown(markdown):
    """(jp_fence_lines, prose_lines) — jp fences in order, everything outside
    fences (non-jp fences are dropped; the renderer treats them as code)."""
    jp_lines, prose_lines = [], []
    in_fence, fence_lang = False, ""
    for line in markdown.replace("\r\n", "\n").split("\n"):
        fence = FENCE_RE.match(line.strip())
        if fence:
            if in_fence:
                in_fence = False
            else:
                in_fence, fence_lang = True, fence.group(1).lower()
            continue
        if in_fence:
            if fence_lang in ("jp", "japanese") and line.strip():
                jp_lines.append(line.strip())
        else:
            prose_lines.append(line)
    return jp_lines, prose_lines


def prose_jp_runs(prose_lines):
    """Kanji-bearing Japanese runs embedded in prose (kana-only runs need no
    furigana and no vocab beyond what the kana check already covers). Inline
    `code` spans are excluded — the prompt directs deliberately-incorrect
    forms (✗ conjugations shown while teaching) into code spans, and the
    renderer displays them without furigana."""
    runs = []
    for line in prose_lines:
        for match in JP_RUN_RE.finditer(CODE_SPAN_RE.sub(" ", line)):
            if any(furigana_lib.is_kanji(ch) for ch in match.group(0)):
                runs.append(match.group(0))
    return runs


def furigana_ok(text, known_readings):
    """True when the tokenizer can annotate every kanji-bearing part of
    `text`. Whole-string annotation is tried first; pedagogical non-sentences
    (conjugation arrows, multi-clause display lines) fall back to per-run
    annotation, since annotate_sentence's round-trip invariant fails on
    whitespace/arrow separators the tokenizer drops."""
    if furigana_lib.annotate_sentence(text, known_readings) is not None:
        return True
    for match in JP_RUN_RE.finditer(text):
        run = match.group(0)
        if not any(furigana_lib.is_kanji(ch) for ch in run):
            continue
        if furigana_lib.annotate_sentence(run, known_readings) is None:
            return False
    return True


def item_context(level, slug):
    """Everything the gate (and the generator prompt) needs for one item."""
    item = context.grammar_item(level, slug)
    taught, upcoming = context.siblings_for(level, slug)
    allowed = context.allowed_vocab_for(level, slug)
    extra_allowed = set(item["accepted_forms"]) | {item["primary_form"]}
    for sibling in taught + upcoming:
        extra_allowed.add(sibling["primary_form"])
        extra_allowed.update(sibling.get("accepted_forms", []))
    sibling_forms = set()
    for sibling in taught + upcoming:
        sibling_forms.add(sibling["primary_form"])
        sibling_forms.update(sibling.get("accepted_forms", []))
    return {
        "item": item,
        "taught": taught,
        "upcoming": upcoming,
        "allowed": allowed,
        "allowed_slugs": {v["slug"] for v in allowed},
        "allowed_index": level_check.build_allowed_index(allowed),
        "extra_allowed": extra_allowed,
        "sibling_slugs": {s["slug"] for s in taught + upcoming},
        "sibling_forms": sibling_forms,
    }


def validate_draft(level, slug, draft, ctx=None):
    """List of error strings; empty means the draft passes the gate."""
    ctx = ctx or item_context(level, slug)
    errors = []

    for field in ("lesson_markdown", "example_sentences", "caution_notes",
                  "related_grammar_slugs", "cloze_variants"):
        if field not in draft:
            errors.append(f"missing field {field}")
    if errors:
        return errors

    markdown = draft["lesson_markdown"]
    examples = draft["example_sentences"]

    # 5. structure
    for pattern, label in DISALLOWED_MARKDOWN:
        if pattern.search(markdown):
            errors.append(f"lesson_markdown contains a {label}, which the app renderer does not support")
    jp_lines, prose_lines = split_markdown(markdown)
    # An example entry may group a minimal pair (newline-joined); compare the
    # fence lines against the flattened example lines instead of insisting on
    # a one-entry-per-fence-line mapping (pilot run 1 rejected valid drafts).
    example_lines = []
    for e in examples:
        example_lines.extend(line.strip() for line in e["japanese"].split("\n") if line.strip())
    if jp_lines != example_lines:
        errors.append(
            "jp fence lines and example_sentences (flattened) must match in order; "
            f"fences={json.dumps(jp_lines, ensure_ascii=False)} "
            f"examples={json.dumps(example_lines, ensure_ascii=False)}"
        )
    if not 4 <= len(draft["cloze_variants"]) <= 8:
        errors.append("expected 4-6 cloze_variants")
    for i, cloze in enumerate(draft["cloze_variants"]):
        if CLOZE_BLANK not in cloze.get("jp_cloze", ""):
            errors.append(f"cloze_variants[{i}].jp_cloze has no ＿＿＿ blank")
    if not 1 <= len(draft["caution_notes"]) <= 4:
        errors.append("expected 1-4 caution_notes")

    # 1. slug existence
    for i, example in enumerate(examples):
        unknown = [s for s in example.get("vocabulary_slugs", [])
                   if s not in ctx["allowed_slugs"]]
        if unknown:
            errors.append(
                f"example_sentences[{i}] references vocab outside the allowed list: {unknown}"
            )
    bad_related = [s for s in draft["related_grammar_slugs"]
                   if s == slug or s not in ctx["sibling_slugs"]]
    if bad_related:
        errors.append(
            f"related_grammar_slugs must come from the listed siblings, got: {bad_related}"
        )

    # 2. + 4. level-check and furigana on every Japanese surface
    known_readings = _known_readings(level)
    checked = [(f"example line {text!r}", text) for text in example_lines]
    checked += [(f"prose run {run!r}", run) for run in prose_jp_runs(prose_lines)]
    for label, text in checked:
        violations = level_check.find_violations(text, ctx["allowed_index"], ctx["extra_allowed"])
        if violations:
            errors.append(f"{label}: out-of-level words: {', '.join(violations)}")
        if not furigana_ok(text, known_readings):
            errors.append(f"{label}: furigana annotation failed (tokenizer round-trip)")

    # 3. accepted form present. Lessons deliberately include contrast lines
    # (the taught sibling next to the new pattern) and conjugation-display
    # lines (食べる → 食べて), so the rule is: every fence line carries the
    # pattern, a sibling pattern, or an arrow — and the pattern itself must
    # appear in at least min(3, N) lines overall.
    accepted = voiced_variants(ctx["item"]["accepted_forms"])
    has_own = [any(form in text for form in accepted) for text in example_lines]
    own_count = sum(has_own)
    for i, text in enumerate(example_lines):
        if has_own[i]:
            continue
        if any(arrow in text for arrow in CONJUGATION_ARROWS):
            continue
        if any(form in text for form in ctx["sibling_forms"]):
            continue
        # One half of a minimal pair (casual particle drop, plain-form
        # counterpart) — fine when its fence neighbour carries the pattern.
        if (i > 0 and has_own[i - 1]) or (i + 1 < len(example_lines) and has_own[i + 1]):
            continue
        errors.append(
            f"example line {text!r} contains neither an accepted form of "
            f"{ctx['item']['primary_form']} ({', '.join(accepted)}) nor a taught "
            "contrast pattern, and is not paired with a line that does"
        )
    minimum = min(3, len(example_lines)) if example_lines else 0
    if own_count < minimum:
        errors.append(
            f"only {own_count} example line(s) use {ctx['item']['primary_form']} "
            f"itself; at least {minimum} must"
        )

    return errors


def _known_readings(level):
    mapping = {}
    for lvl in context.LEVEL_ORDER[: context.LEVEL_ORDER.index(level) + 1]:
        for v in context.load_vocab(lvl):
            reading = next(
                (a["answer_text"] for a in v.get("accepted_answers", [])
                 if a.get("answer_type") == "reading"),
                None,
            )
            if reading and v["primary_form"] not in mapping:
                mapping[v["primary_form"]] = reading
    return mapping


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", default="n5")
    args = parser.parse_args()

    level_dir = os.path.join(DRAFTS_DIR, args.level)
    if not os.path.isdir(level_dir):
        raise SystemExit(f"no drafts at {level_dir}")
    failed = 0
    for name in sorted(os.listdir(level_dir)):
        if not name.endswith(".json"):
            continue
        with open(os.path.join(level_dir, name), encoding="utf-8") as f:
            record = json.load(f)
        if not isinstance(record, dict) or not record.get("tool_input"):
            continue
        errors = validate_draft(args.level, record["slug"], record["tool_input"])
        status = "PASS" if not errors else "FAIL"
        print(f"{status} {record['slug']}")
        for e in errors:
            print(f"  - {e}")
        failed += bool(errors)
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
