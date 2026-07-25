# -*- coding: utf-8 -*-
"""Generate curriculum JSON files from the authored datasets.

Emits (for the level given by --level):
  curriculum/radicals/<level>.json
  curriculum/kanji/<level>.json
  curriculum/vocabulary/<level>.json
  curriculum/grammar/<level>.json
  curriculum/readings/<level>.json

Also (for --deps) rebuilds curriculum/dependencies/graph.json for the combined
set of levels that have generated data, and updates curriculum/metadata.json.

Cross-references (grammar vocabulary_slugs, example vocabulary_slugs,
dependency edges) are validated against the known item slug sets; unresolved
references abort generation with a clear error.
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import frontmatter as frontmatter_lib  # noqa: E402
from visually_similar import build_similar_map  # noqa: E402

#: Rev 1 look-alike pairs (R1.3), emitted as `visually_similar_slugs` on
#: radical/kanji items. compile-curriculum resolves and hard-fails on any
#: slug that is not a taught radical/kanji.
_SIMILAR_SLUGS = build_similar_map()

LESSONS_DIR = os.path.join(CURRICULUM_DIR, "grammar", "lessons")

#: Phase 2b mnemonic sidecars (generate_content/generate_mnemonics.py), inlined
#: into the kanji/radical items below keyed by slug. Absent when 2b has not run.
KANJI_MNEMONICS_DIR = os.path.join(CURRICULUM_DIR, "kanji", "mnemonics")
RADICAL_MNEMONICS_DIR = os.path.join(CURRICULUM_DIR, "radicals", "mnemonics")

#: Phase 2c example-sentence sidecars (generate_content/generate_examples.py),
#: inlined into the kanji/vocab items below keyed by slug. Absent when 2c has
#: not run.
KANJI_EXAMPLES_DIR = os.path.join(CURRICULUM_DIR, "kanji", "examples")
VOCAB_EXAMPLES_DIR = os.path.join(CURRICULUM_DIR, "vocabulary", "examples")

#: Sidecar _meta keys carried through to the shipped item (matches grammar).
_SIDECAR_META_KEYS = ("generator_model", "prompt_version", "review_status", "reviewed_by")

# Kanji/kana runs (incl. 々〆 and the long-vowel mark) for the lesson-markdown
# furigana pass below.
_JP_RUN_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿々〆ー]+")
_FENCE_RE = re.compile(r"^```([A-Za-z]*)\s*$")
_CODE_SPAN_RE = re.compile(r"`[^`]*`")


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _load_sidecar(sidecar_dir, level):
    """{slug: entry} from <sidecar_dir>/<level>.json, or {} when the relevant
    Phase 2 generator hasn't run.

    Each entry carries the generated mnemonic field(s) plus a `_meta` block
    (generator_model, prompt_version, review_status). Reviewer-authored entries
    may add `reviewed_by` / flip `review_status`."""
    path = os.path.join(sidecar_dir, f"{level}.json")
    if not os.path.exists(path):
        return {}
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def _sidecar_meta(entry):
    """The `_meta` dict to attach to a shipped item, filtered to known keys."""
    meta = entry.get("_meta", {})
    return {k: meta[k] for k in _SIDECAR_META_KEYS if meta.get(k) not in (None, "")}


def _merge_sidecar_meta(item, meta):
    """Attach sidecar `_meta` to an item that may already carry one (a kanji
    can have both a 2b mnemonic sidecar and a 2c examples sidecar). The least
    reviewed status wins, so a draft sidecar always keeps the item behind
    compile-curriculum's draft gate."""
    if not meta:
        return
    existing = item.get("_meta")
    if not existing:
        item["_meta"] = meta
        return
    order = {"flagged_for_rewrite": 0, "draft": 1, "reviewed": 2}
    statuses = [m.get("review_status") for m in (existing, meta) if m.get("review_status")]
    if statuses:
        existing["review_status"] = min(statuses, key=lambda s: order.get(s, 0))


def _inline_examples(item, entry, known_readings, vocab_slugs, label, errors):
    """Inlines a 2c example-sentence sidecar entry into a kanji/vocab item.
    Furigana comes from the tokenizer at build time (never the LLM); the 2c
    gate already rejected drafts the tokenizer can't annotate, so a failure
    here means a hand edit needs fixing and is only warned about."""
    sentences = []
    for j, s in enumerate(entry.get("example_sentences", [])):
        for vs in s.get("vocabulary_slugs", []):
            if vs not in vocab_slugs:
                errors.append(f"{label} example {j} references unknown vocab '{vs}'")
        sentence = {
            "japanese": s["japanese"],
            "english": s["english"],
            "sort_order": j,
        }
        if s.get("vocabulary_slugs"):
            sentence["vocabulary_slugs"] = s["vocabulary_slugs"]
        furigana = furigana_lib.annotate_sentence(s["japanese"], known_readings)
        if furigana:
            sentence["furigana"] = furigana
        elif any(furigana_lib.is_kanji(ch) for ch in s["japanese"]):
            print(f"warning: {label}: furigana failed for example: {s['japanese']}",
                  file=sys.stderr)
        sentences.append(sentence)
    if sentences:
        item["example_sentences"] = sentences
        _merge_sidecar_meta(item, _sidecar_meta(entry))


def _vocab_reading_map(*vocab_entry_lists):
    """Builds a {primary_form: reading} map from raw vocab entries, for
    annotate_sentence's known_readings override (see furigana.py)."""
    mapping = {}
    for vocab_entries in vocab_entry_lists:
        for v in vocab_entries:
            if v["reading"] and v["form"] not in mapping:
                mapping[v["form"]] = v["reading"]
    return mapping


def _build_radicals_level(jlpt_level, slug_prefix, radical_entries):
    mnemonics = _load_sidecar(RADICAL_MNEMONICS_DIR, slug_prefix)
    items = []
    for i, r in enumerate(radical_entries, start=1):
        item = {
            "slug": r["slug"],
            "primary_form": r["form"],
            "meaning": r["meaning"],
            "mnemonic_text": r["mnemonic"],
            "visual_mnemonic_url": f"https://assets.japanese-learning.app/radicals/{slug_prefix}/{r['slug']}.png",
            "sort_order": i,
        }
        if r["slug"] in _SIMILAR_SLUGS:
            item["visually_similar_slugs"] = _SIMILAR_SLUGS[r["slug"]]
        mnemonic = mnemonics.get(r["slug"])
        if mnemonic:
            # Phase 2b generated image replaces the seed dataset mnemonic.
            if mnemonic.get("mnemonic_text"):
                item["mnemonic_text"] = mnemonic["mnemonic_text"]
            meta = _sidecar_meta(mnemonic)
            if meta:
                item["_meta"] = meta
        if r.get("accepted_meanings"):
            item["accepted_answers"] = [
                {"answer_type": "meaning", "answer_text": m} if j else
                {"answer_type": "meaning", "answer_text": m, "is_primary": True}
                for j, m in enumerate(r["accepted_meanings"])
            ]
        items.append(item)
    return {"jlpt_level": jlpt_level, "items": items}


def _build_kanji_level(jlpt_level, slug_prefix, kanji_entries, known_readings=None,
                       vocab_slugs=None):
    mnemonics = _load_sidecar(KANJI_MNEMONICS_DIR, slug_prefix)
    examples = _load_sidecar(KANJI_EXAMPLES_DIR, slug_prefix)
    errors = []
    items = []
    for i, k in enumerate(kanji_entries, start=1):
        readings = []
        ro = 0
        primary_reading = None
        if k["onyomi"]:
            readings.append({"reading_type": "onyomi", "reading": k["onyomi"], "sort_order": ro})
            primary_reading = primary_reading or k["onyomi"]
            ro += 1
        if k["kunyomi"]:
            readings.append({"reading_type": "kunyomi", "reading": k["kunyomi"], "sort_order": ro})
            primary_reading = primary_reading or k["kunyomi"]
            ro += 1
        accepted = [{"answer_type": "meaning", "answer_text": k["meaning"], "is_primary": True}]
        if primary_reading:
            accepted.append({"answer_type": "reading", "answer_text": primary_reading})
        for extra in k.get("extra_meanings", []):
            accepted.append({"answer_type": "meaning", "answer_text": extra})
        slug = f"{slug_prefix}-{k['suffix']}"
        item = {
            "slug": slug,
            "primary_form": k["char"],
            "meaning": k["meaning"],
            "mnemonic_text": k["mnemonic"],
            "sort_order": i,
            "readings": readings,
            "accepted_answers": accepted,
        }
        if slug in _SIMILAR_SLUGS:
            item["visually_similar_slugs"] = _SIMILAR_SLUGS[slug]
        mnemonic = mnemonics.get(slug)
        if mnemonic:
            # Phase 2b split mnemonics (docs/content/content-pipeline-plan.md 2b): the
            # meaning mnemonic references the taught decomposition, the reading
            # mnemonic carries the target reading. The legacy one-line
            # mnemonic_text is kept as a fallback for pre-2b consumers.
            for field in ("meaning_mnemonic", "reading_mnemonic", "description"):
                if mnemonic.get(field):
                    item[field] = mnemonic[field]
            meta = _sidecar_meta(mnemonic)
            if meta:
                item["_meta"] = meta
        example_entry = examples.get(slug)
        if example_entry:
            _inline_examples(item, example_entry, known_readings, vocab_slugs or set(),
                             f"kanji {slug}", errors)
        items.append(item)
    if errors:
        raise ValueError(f"{jlpt_level} kanji reference errors:\n" + "\n".join(errors))
    return {"jlpt_level": jlpt_level, "items": items}


def _build_vocab_level(jlpt_level, vocab_entries, known_readings=None,
                       extra_vocab_slugs=None):
    examples = _load_sidecar(VOCAB_EXAMPLES_DIR, jlpt_level.lower())
    vocab_slugs = {v["slug"] for v in vocab_entries} | set(extra_vocab_slugs or ())
    errors = []
    items = []
    for i, v in enumerate(vocab_entries, start=1):
        accepted = [{"answer_type": "meaning", "answer_text": v["meaning"], "is_primary": True}]
        if v["reading"]:
            accepted.append({"answer_type": "reading", "answer_text": v["reading"]})
        item = {
            "slug": v["slug"],
            "primary_form": v["form"],
            "meaning": v["meaning"],
            "mnemonic_text": v["mnemonic"],
            "sort_order": i,
            "accepted_answers": accepted,
        }
        furigana = furigana_lib.annotate_word(v["form"], v["reading"])
        if furigana:
            item["furigana"] = furigana
        example_entry = examples.get(v["slug"])
        if example_entry:
            _inline_examples(item, example_entry, known_readings, vocab_slugs,
                             f"vocabulary {v['slug']}", errors)
        items.append(item)
    if errors:
        raise ValueError(f"{jlpt_level} vocabulary reference errors:\n" + "\n".join(errors))
    return {"jlpt_level": jlpt_level, "items": items}


# ---------------------------------------------------------------------------
# N5 builders
# ---------------------------------------------------------------------------

def build_n5_radicals():
    from n5_radicals import N5_RADICALS

    return _build_radicals_level("N5", "n5", N5_RADICALS)


def build_n5_kanji(known_readings=None, vocab_slugs=None):
    from n5_kanji import N5_KANJI

    return _build_kanji_level("N5", "n5", N5_KANJI, known_readings, vocab_slugs)


def build_n5_vocab(known_readings=None):
    from n5_vocab import N5_VOCAB

    return _build_vocab_level("N5", N5_VOCAB, known_readings)


def _annotate_prose_line(line, known_readings):
    """Annotates kanji-bearing Japanese runs embedded in prose. Runs already
    followed by a bracket annotation are left alone, so reviewer hand-edits
    that carry notation survive a rebuild. Inline `code` spans are skipped —
    lessons use them for deliberately-incorrect forms, which the renderer
    shows without furigana."""
    code_spans = [m.span() for m in _CODE_SPAN_RE.finditer(line)]
    out = []
    pos = 0
    for match in _JP_RUN_RE.finditer(line):
        if any(start <= match.start() < end for start, end in code_spans):
            continue
        run = match.group(0)
        if not any(furigana_lib.is_kanji(ch) for ch in run):
            continue
        if match.end() < len(line) and line[match.end()] == "[":
            continue
        annotated = furigana_lib.annotate_sentence(run, known_readings)
        if annotated is None or annotated == run:
            continue
        out.append(line[pos:match.start()])
        out.append(annotated)
        pos = match.end()
    out.append(line[pos:])
    return "".join(out)


def _annotate_lesson_markdown(body, known_readings, label):
    """Build-time furigana pass over a lesson body: ```jp fence lines are
    annotated as whole sentences, prose lines per Japanese run. Authors and
    generators write plain Japanese; the tokenizer — never the LLM — supplies
    readings (docs/content/content-pipeline-plan.md Phase 0). Annotation failures
    leave the text plain and warn: for *generated* drafts the Phase 2 gate has
    already rejected them, so a warning here means a human edit needs fixing."""
    lines = body.replace("\r\n", "\n").split("\n")
    out = []
    in_fence = False
    fence_is_jp = False
    for line in lines:
        fence = _FENCE_RE.match(line.strip())
        if fence:
            if in_fence:
                in_fence = False
            else:
                in_fence = True
                fence_is_jp = fence.group(1).lower() in ("jp", "japanese")
            out.append(line)
            continue
        if in_fence:
            if fence_is_jp and line.strip():
                stripped = line.strip()
                annotated = furigana_lib.annotate_sentence(stripped, known_readings)
                if annotated is None:
                    # Pedagogical non-sentences (conjugation arrows 食べる → 食べて)
                    # fail the whole-line round-trip; annotate per Japanese run.
                    annotated = _annotate_prose_line(stripped, known_readings)
                    if annotated == stripped and any(
                        furigana_lib.is_kanji(ch) for ch in stripped
                    ):
                        print(f"warning: {label}: furigana failed for jp line: {stripped}",
                              file=sys.stderr)
                out.append(annotated)
            else:
                out.append(line)
        else:
            out.append(_annotate_prose_line(line, known_readings))
    return "\n".join(out)


def _load_lesson(level_slug, slug, known_readings):
    """(sidecar_meta, annotated_body) for grammar/lessons/<level>/<slug>.md,
    or None when the grammar point has no long-form lesson yet."""
    path = os.path.join(LESSONS_DIR, level_slug, f"{slug}.md")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        meta, body = frontmatter_lib.parse(f.read())
    label = f"grammar lesson {level_slug}/{slug}"
    return meta, _annotate_lesson_markdown(body, known_readings, label)


def _build_grammar_level(jlpt_level, grammar_entries, vocab_slugs, known_readings=None):
    errors = []
    items = []
    for i, g in enumerate(grammar_entries, start=1):
        example_sentences = []
        for j, (jp, en, vslugs) in enumerate(g["examples"]):
            for vs in vslugs:
                if vs not in vocab_slugs:
                    errors.append(f"grammar {g['slug']} example {j} references unknown vocab '{vs}'")
            sentence = {
                "japanese": jp,
                "english": en,
                "sort_order": j,
                "vocabulary_slugs": vslugs,
            }
            sentence_furigana = furigana_lib.annotate_sentence(jp, known_readings)
            if sentence_furigana:
                sentence["furigana"] = sentence_furigana
            example_sentences.append(sentence)
        for vs in g["vocabulary_slugs"]:
            if vs not in vocab_slugs:
                errors.append(f"grammar {g['slug']} vocabulary_slugs references unknown vocab '{vs}'")
        item = {
            "slug": g["slug"],
            "primary_form": g["primary_form"],
            "meaning": g["meaning"],
            "structure": g["structure"],
            "sort_order": i,
            "conjugation_rules": g["conjugation_rules"],
            "accepted_forms": g["accepted_forms"],
            "example_sentences": example_sentences,
            "vocabulary_slugs": g["vocabulary_slugs"],
        }
        if "family" in g:
            item["family"] = g["family"]
        if g.get("cloze_variants"):
            item["cloze_variants"] = [
                {**cv, "sort_order": j} for j, cv in enumerate(g["cloze_variants"])
            ]
        lesson = _load_lesson(jlpt_level.lower(), g["slug"], known_readings)
        if lesson:
            meta, body = lesson
            item["explanation_markdown"] = body
            if meta.get("caution_notes"):
                item["caution_notes"] = meta["caution_notes"]
            related = meta.get("related_grammar_slugs") or []
            if related:
                grammar_slugs = {entry["slug"] for entry in grammar_entries}
                for rs in related:
                    if rs == g["slug"] or rs not in grammar_slugs:
                        errors.append(
                            f"grammar {g['slug']} lesson frontmatter references "
                            f"unknown/self related grammar '{rs}'"
                        )
                item["related_grammar_slugs"] = related
            sidecar = {
                key: meta[key]
                for key in ("generator_model", "prompt_version", "review_status", "reviewed_by")
                if meta.get(key)
            }
            if sidecar:
                item["_meta"] = sidecar
        items.append(item)
    if errors:
        raise ValueError(f"{jlpt_level} grammar reference errors:\n" + "\n".join(errors))
    return {"jlpt_level": jlpt_level, "items": items}


def build_n5_grammar(vocab_slugs, known_readings=None):
    from n5_grammar import N5_GRAMMAR

    return _build_grammar_level("N5", N5_GRAMMAR, vocab_slugs, known_readings)


#: Passage fields authored in the n5/n4 readings datasets and copied through
#: verbatim. The reader UI and passage unlock depend on them, and they are
#: optional in the schema, so a generator that dropped them would compile green
#: and silently lock every passage.
_PASSAGE_AUTHORED_KEYS = (
    "english_translation",
    "summary_ja",
    "summary_en",
    "grammar_slugs",
    "vocabulary_slugs",
    "word_spans",
)


def _build_readings_level(jlpt_level, reading_entries, known_readings=None):
    passages = []
    for i, p in enumerate(reading_entries, start=1):
        questions = []
        for j, q in enumerate(p.get("questions", [])):
            question = {
                "prompt": q["prompt"],
                "accepted_answers": q["accepted_answers"],
                "sort_order": j,
            }
            prompt_furigana = furigana_lib.annotate_sentence(q["prompt"], known_readings)
            if prompt_furigana:
                question["prompt_furigana"] = prompt_furigana
            questions.append(question)
        passage = {
            "title": p["title"],
            "body": p["body"],
            "sort_order": i,
            "questions": questions,
        }
        body_furigana = furigana_lib.annotate_sentence(p["body"], known_readings)
        if body_furigana:
            passage["body_furigana"] = body_furigana
        for key in _PASSAGE_AUTHORED_KEYS:
            if key in p:
                passage[key] = p[key]
        passages.append(passage)
    return {"jlpt_level": jlpt_level, "passages": passages}


def build_n5_readings(known_readings=None):
    from n5_readings import N5_READINGS

    return _build_readings_level("N5", N5_READINGS, known_readings)


# ---------------------------------------------------------------------------
# N4 builders (mirror the N5 shape; datasets defined in n4_*.py)
# ---------------------------------------------------------------------------

def build_n4_radicals():
    from n4_radicals import N4_RADICALS

    return _build_radicals_level("N4", "n4", N4_RADICALS)


def build_n4_kanji(known_readings=None, vocab_slugs=None):
    from n4_kanji import N4_KANJI

    return _build_kanji_level("N4", "n4", N4_KANJI, known_readings, vocab_slugs)


def build_n4_vocab(known_readings=None, extra_vocab_slugs=None):
    from n4_vocab import N4_VOCAB

    return _build_vocab_level("N4", N4_VOCAB, known_readings, extra_vocab_slugs)


def build_n4_grammar(vocab_slugs, known_readings=None):
    from n4_grammar import N4_GRAMMAR

    return _build_grammar_level("N4", N4_GRAMMAR, vocab_slugs, known_readings)


def build_n4_readings(known_readings=None):
    from n4_readings import N4_READINGS

    return _build_readings_level("N4", N4_READINGS, known_readings)


# ---------------------------------------------------------------------------
# Level orchestration
# ---------------------------------------------------------------------------

def generate_level(level):
    level = level.lower()
    if level == "n5":
        from n5_vocab import N5_VOCAB

        known_readings = _vocab_reading_map(N5_VOCAB)
        vocab = build_n5_vocab(known_readings)
        vocab_slugs = {v["slug"] for v in vocab["items"]}
        write_json(os.path.join(CURRICULUM_DIR, "radicals", "n5.json"), build_n5_radicals())
        write_json(os.path.join(CURRICULUM_DIR, "kanji", "n5.json"),
                   build_n5_kanji(known_readings, vocab_slugs))
        write_json(os.path.join(CURRICULUM_DIR, "vocabulary", "n5.json"), vocab)
        write_json(
            os.path.join(CURRICULUM_DIR, "grammar", "n5.json"),
            build_n5_grammar(vocab_slugs, known_readings),
        )
        write_json(
            os.path.join(CURRICULUM_DIR, "readings", "n5.json"),
            build_n5_readings(known_readings),
        )
    elif level == "n4":
        from n4_vocab import N4_VOCAB
        from n5_vocab import N5_VOCAB

        known_readings = _vocab_reading_map(N5_VOCAB, N4_VOCAB)
        n5_vocab_slugs = {v["slug"] for v in N5_VOCAB}
        # N4 is additive on N5: examples may reinforce previously learned N5
        # vocabulary, so validate against the combined slug set.
        vocab = build_n4_vocab(known_readings, n5_vocab_slugs)
        vocab_slugs = {v["slug"] for v in vocab["items"]} | n5_vocab_slugs
        write_json(os.path.join(CURRICULUM_DIR, "radicals", "n4.json"), build_n4_radicals())
        write_json(os.path.join(CURRICULUM_DIR, "kanji", "n4.json"),
                   build_n4_kanji(known_readings, vocab_slugs))
        write_json(os.path.join(CURRICULUM_DIR, "vocabulary", "n4.json"), vocab)
        write_json(
            os.path.join(CURRICULUM_DIR, "grammar", "n4.json"),
            build_n4_grammar(vocab_slugs, known_readings),
        )
        write_json(
            os.path.join(CURRICULUM_DIR, "readings", "n4.json"),
            build_n4_readings(known_readings),
        )
    else:
        raise ValueError(f"unknown level {level}")
    print(f"Generated {level.upper()} JSON files.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=["n5", "n4"], required=True)
    args = parser.parse_args()
    generate_level(args.level)


if __name__ == "__main__":
    main()
