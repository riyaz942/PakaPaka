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
import sys

BUILD_DIR = os.path.dirname(os.path.abspath(__file__))
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


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
        if r.get("accepted_meanings"):
            item["accepted_answers"] = [
                {"answer_type": "meaning", "answer_text": m} if j else
                {"answer_type": "meaning", "answer_text": m, "is_primary": True}
                for j, m in enumerate(r["accepted_meanings"])
            ]
        items.append(item)
    return {"jlpt_level": jlpt_level, "items": items}


def _build_kanji_level(jlpt_level, slug_prefix, kanji_entries):
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
        items.append({
            "slug": f"{slug_prefix}-{k['suffix']}",
            "primary_form": k["char"],
            "meaning": k["meaning"],
            "mnemonic_text": k["mnemonic"],
            "sort_order": i,
            "readings": readings,
            "accepted_answers": accepted,
        })
    return {"jlpt_level": jlpt_level, "items": items}


def _build_vocab_level(jlpt_level, vocab_entries):
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
        items.append(item)
    return {"jlpt_level": jlpt_level, "items": items}


# ---------------------------------------------------------------------------
# N5 builders
# ---------------------------------------------------------------------------

def build_n5_radicals():
    from n5_radicals import N5_RADICALS

    return _build_radicals_level("N5", "n5", N5_RADICALS)


def build_n5_kanji():
    from n5_kanji import N5_KANJI

    return _build_kanji_level("N5", "n5", N5_KANJI)


def build_n5_vocab():
    from n5_vocab import N5_VOCAB

    return _build_vocab_level("N5", N5_VOCAB)


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
            "mnemonic_text": g["mnemonic"],
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
        items.append(item)
    if errors:
        raise ValueError(f"{jlpt_level} grammar reference errors:\n" + "\n".join(errors))
    return {"jlpt_level": jlpt_level, "items": items}


def build_n5_grammar(vocab_slugs, known_readings=None):
    from n5_grammar import N5_GRAMMAR

    return _build_grammar_level("N5", N5_GRAMMAR, vocab_slugs, known_readings)


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


def build_n4_kanji():
    from n4_kanji import N4_KANJI

    return _build_kanji_level("N4", "n4", N4_KANJI)


def build_n4_vocab():
    from n4_vocab import N4_VOCAB

    return _build_vocab_level("N4", N4_VOCAB)


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
        vocab = build_n5_vocab()
        vocab_slugs = {v["slug"] for v in vocab["items"]}
        write_json(os.path.join(CURRICULUM_DIR, "radicals", "n5.json"), build_n5_radicals())
        write_json(os.path.join(CURRICULUM_DIR, "kanji", "n5.json"), build_n5_kanji())
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
        n5_vocab = build_n5_vocab()
        vocab = build_n4_vocab()
        # N4 is additive on N5: grammar examples may reinforce previously
        # learned N5 vocabulary, so validate against the combined slug set.
        vocab_slugs = {v["slug"] for v in vocab["items"]} | {v["slug"] for v in n5_vocab["items"]}
        write_json(os.path.join(CURRICULUM_DIR, "radicals", "n4.json"), build_n4_radicals())
        write_json(os.path.join(CURRICULUM_DIR, "kanji", "n4.json"), build_n4_kanji())
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
