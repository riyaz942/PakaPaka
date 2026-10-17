# -*- coding: utf-8 -*-
"""Generate curriculum JSON files from the authored datasets.

--level n5|n4 emits that level's own content:
  curriculum/vocabulary/<level>.json
  curriculum/grammar/<level>.json
  curriculum/readings/<level>.json

--level n3|n2|n1 emits that level's derived vocabulary alone:
  curriculum/vocabulary/<level>.json

--bands emits radicals and kanji for all five levels at once:
  curriculum/radicals/{n5,n4,n3,n2,n1}.json
  curriculum/kanji/{n5,n4,n3,n2,n1}.json

Radicals and kanji cannot be written per level, because their level is a *band*
assigned by reports/kanji_bands.py and a band draws from every source dataset.
Whenever the datasets or levels.json change, run --level for every level, then
kanji_bands.py (it ranks on the generated words), then --bands.

An item's level is its source dataset's level (or its band) unless
`levels.json` names it (see levels.py). So --level n5 reads every dataset, not
only the n5 ones.

Cross-references (grammar vocabulary_slugs, example vocabulary_slugs,
dependency edges) are validated against the known item slug sets of every
level; unresolved references abort generation with a clear error. A reference
to an item at a later level is not an error here: reports/level_report.py
lists it.
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
from generate_content import check_grammar_pool as pool_check  # noqa: E402
from generate_content import frontmatter as frontmatter_lib  # noqa: E402
from generate_content import grammar_sentences as grammar_sentences_lib  # noqa: E402
from generate_content import spans as spans_lib  # noqa: E402
from generate_content.mnemonic_context import reading_composition  # noqa: E402
from levels import place  # noqa: E402
from visually_similar import build_similar_map  # noqa: E402

#: Rev 1 look-alike pairs (R1.3), emitted as `visually_similar_slugs` on
#: radical/kanji items, keyed and valued by "<kind>:<slug>". compile-curriculum
#: resolves and hard-fails on any ref that is not a taught radical/kanji.
_SIMILAR_REFS = build_similar_map()

LESSONS_DIR = os.path.join(CURRICULUM_DIR, "grammar", "lessons")

#: Grammar sentence pool sidecar (docs/superpowers/plans/2026-10-14-grammar-pool-content.md):
#: a point with an entry takes all its pool sentences and meanings from here.
POOL_SIDECAR = os.path.join(CURRICULUM_DIR, "grammar", "pool.json")


def load_pool_sidecar():
    if not os.path.exists(POOL_SIDECAR):
        return {}
    with open(POOL_SIDECAR, encoding="utf-8") as f:
        return json.load(f)


def _pool_examples(pool_entry):
    return [
        {"jp": s["japanese"], "en": s["english"], "vocab": s["vocabulary_slugs"],
         "form": s.get("form"),
         "alts": [(a["japanese"], a["kind"]) for a in s.get("alternates", [])]}
        for s in pool_entry["sentences"]
    ]

#: Phase 2b/2d mnemonic sidecars (generate_content/generate_mnemonics.py),
#: one file per kind for every level, inlined into the radical/kanji/vocab
#: items below keyed by slug. Absent when the generator has not run for that
#: type.
KANJI_MNEMONICS_PATH = os.path.join(CURRICULUM_DIR, "kanji", "mnemonics.json")
RADICAL_MNEMONICS_PATH = os.path.join(CURRICULUM_DIR, "radicals", "mnemonics.json")
VOCAB_MNEMONICS_PATH = os.path.join(CURRICULUM_DIR, "vocabulary", "mnemonics.json")

#: Phase 2c example-sentence sidecar (generate_content/generate_examples.py),
#: inlined into the vocab items below keyed by slug. Absent when 2c has not
#: run. Kanji carry no example sentences: a kanji is taught through the
#: vocabulary that uses it, which the app lists instead.
VOCAB_EXAMPLES_PATH = os.path.join(CURRICULUM_DIR, "vocabulary", "examples.json")

#: Sidecar _meta keys carried through to the shipped item (matches grammar).
_SIDECAR_META_KEYS = ("generator_model", "prompt_version", "review_status", "reviewed_by")

#: Part of speech per vocabulary slug, distilled from JMdict by
#: `import/build_vocab_word_types.py`. Not every word has one — the compound
#: and derived forms taught as grammar (教えてもらう, 書ける) carry none, and the
#: file is absent entirely until that script has been run — so a missing entry
#: means the item ships with no `word_type`, never an empty or guessed one.
VOCAB_WORD_TYPES_PATH = os.path.join(BUILD_DIR, "vocab_word_types.json")

# Kanji/kana runs (incl. 々〆 and the long-vowel mark) for the lesson-markdown
# furigana pass below.
_JP_RUN_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿々〆ー]+")
_FENCE_RE = re.compile(r"^```([A-Za-z]*)\s*$")
_CODE_SPAN_RE = re.compile(r"`[^`]*`")


def write_json(path, data):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _load_sidecar(path):
    """{slug: entry} from a sidecar file, or {} when the relevant Phase 2
    generator hasn't run.

    Each entry carries the generated mnemonic field(s) plus a `_meta` block
    (generator_model, prompt_version, review_status). Reviewer-authored entries
    may add `reviewed_by` / flip `review_status`."""
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


def _example_word_spans(japanese, vocabulary_slugs, vocab_forms):
    """Tappable occurrences of the sentence's linked vocabulary (feedback 14.1a).

    Derived, never authored: dictionary forms plus the taught inflections of the
    same linked words (来ます for 来る). Nothing positional was stored for
    examples before — the app located a link by the first literal `primary_form`
    match, which conjugated surfaces never hit."""
    forms_by_slug = {
        slug: vocab_forms[slug] for slug in vocabulary_slugs if slug in vocab_forms
    }
    return spans_lib.derive_spans(japanese, forms_by_slug)


def _inline_examples(item, entry, known_readings, vocab_forms, label, errors):
    """Inlines a 2c example-sentence sidecar entry into a vocab item.
    Furigana comes from the tokenizer at build time (never the LLM); the 2c
    gate already rejected drafts the tokenizer can't annotate, so a failure
    here means a hand edit needs fixing and is only warned about."""
    sentences = []
    for j, s in enumerate(entry.get("example_sentences", [])):
        for vs in s.get("vocabulary_slugs", []):
            if vs not in vocab_forms:
                errors.append(f"{label} example {j} references unknown vocab '{vs}'")
        sentence = {
            "japanese": s["japanese"],
            "english": s["english"],
            "sort_order": j,
        }
        if s.get("vocabulary_slugs"):
            sentence["vocabulary_slugs"] = s["vocabulary_slugs"]
            word_spans = _example_word_spans(
                s["japanese"], s["vocabulary_slugs"], vocab_forms
            )
            if word_spans:
                sentence["word_spans"] = word_spans
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


def _build_radical_items(radical_entries):
    """Items for one *source* dataset — n5, n4 or the derived corpus (`k`).

    No `sort_order` and no level: `_write_banded` assigns both from bands.json.
    The sidecar and the bundled art are keyed by slug alone, so neither moves
    when the band does."""
    mnemonics = _load_sidecar(RADICAL_MNEMONICS_PATH)
    items = []
    for r in radical_entries:
        item = {
            "slug": r["slug"],
            "primary_form": r["form"],
            "meaning": r["meaning"],
        }
        if r.get("mnemonic"):
            item["mnemonic_text"] = r["mnemonic"]
        if f"radical:{r['slug']}" in _SIMILAR_REFS:
            item["visually_similar_slugs"] = _SIMILAR_REFS[f"radical:{r['slug']}"]
        mnemonic = mnemonics.get(r["slug"])
        if mnemonic:
            # A radical carries two texts for one scene: `image_prompt` is the
            # stroke-walked story the Tier 2 art is drawn from, `mnemonic_text`
            # the shorter learner-facing summary of it; `description` is
            # optional and carries look-alike contrast or usage nuance. All
            # three paths are explicit. (`image_prompt` ships in the JSON for
            # the art pipeline; compile-curriculum's explicit column mapping
            # keeps it out of the bundled db.)
            if mnemonic.get("description"):
                item["description"] = mnemonic["description"]
            if mnemonic.get("mnemonic_text"):
                item["mnemonic_text"] = mnemonic["mnemonic_text"]
            if mnemonic.get("image_prompt"):
                item["image_prompt"] = mnemonic["image_prompt"]
            meta = _sidecar_meta(mnemonic)
            if meta:
                item["_meta"] = meta
        if item.get("mnemonic_text"):
            # Bundled asset ref, not a URL: art ships inside the app binary under
            # mobile/assets/radicals/. Missing files fall back to mnemonic text.
            # Radicals with no mnemonic text at all (raw or sidecar) carry
            # neither field rather than pointing at a file nobody has drawn.
            # The ref holds no level: a radical that rebands keeps its art.
            item["visual_mnemonic_url"] = f"radicals/{r['slug']}.webp"
        if r.get("accepted_meanings"):
            item["accepted_answers"] = [
                {"answer_type": "meaning", "answer_text": m} if j else
                {"answer_type": "meaning", "answer_text": m, "is_primary": True}
                for j, m in enumerate(r["accepted_meanings"])
            ]
        items.append(item)
    return items


def _build_kanji_items(kanji_entries):
    """Items for one source dataset. See `_build_radical_items`."""
    mnemonics = _load_sidecar(KANJI_MNEMONICS_PATH)
    items = []
    for k in kanji_entries:
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
        slug = k["slug"]
        item = {
            "slug": slug,
            "primary_form": k["char"],
            "meaning": k["meaning"],
        }
        # Skeleton kanji (plan Phase 2) carry no mnemonic of any kind; the app
        # renders around the absence (hasCurriculumMnemonic).
        if k.get("mnemonic"):
            item["mnemonic_text"] = k["mnemonic"]
        item["readings"] = readings
        item["accepted_answers"] = accepted
        if f"kanji:{slug}" in _SIMILAR_REFS:
            item["visually_similar_slugs"] = _SIMILAR_REFS[f"kanji:{slug}"]
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
        items.append(item)
    return items


def _load_vocab_word_types():
    """{slug: "adverb, noun"} from the checked-in JMdict distillation, or {}.

    The artifact stores the labels as a list so the ordering rule lives in one
    place; the shipped field is the display string, because that is the whole
    of what the app does with it."""
    if not os.path.exists(VOCAB_WORD_TYPES_PATH):
        return {}
    with open(VOCAB_WORD_TYPES_PATH, encoding="utf-8") as f:
        return {slug: ", ".join(labels) for slug, labels in json.load(f).items()}


def _build_vocab_level(jlpt_level, vocab_entries, known_readings=None,
                       extra_vocab_forms=None):
    mnemonics = _load_sidecar(VOCAB_MNEMONICS_PATH)
    examples = _load_sidecar(VOCAB_EXAMPLES_PATH)
    word_types = _load_vocab_word_types()
    vocab_forms = {**(extra_vocab_forms or {}),
                   **{v["slug"]: v["form"] for v in vocab_entries}}
    errors = []
    items = []
    for i, v in enumerate(vocab_entries, start=1):
        accepted = [{"answer_type": "meaning", "answer_text": v["meaning"], "is_primary": True}]
        if v["reading"]:
            accepted.append({"answer_type": "reading", "answer_text": v["reading"]})
        for extra in v.get("extra_meanings", []):
            accepted.append({"answer_type": "meaning", "answer_text": extra})
        item = {
            "slug": v["slug"],
            "primary_form": v["form"],
            "meaning": v["meaning"],
        }
        word_type = word_types.get(v["slug"])
        if word_type:
            item["word_type"] = word_type
        # Rev 6: how the reading is built, computed from the word's kanji and
        # their KANJIDIC readings rather than written. It replaces the derivation
        # note the reading mnemonic used to carry, which is why 745 of N5+N4's
        # words now ship no `reading_mnemonic` at all.
        if v["reading"]:
            item["reading_composition"] = reading_composition(v["form"], v["reading"])
        # Skeleton vocabulary (plan v2 Phase D) carries no mnemonic of any kind,
        # as skeleton kanji do; the app renders around the absence.
        if v.get("mnemonic"):
            item["mnemonic_text"] = v["mnemonic"]
        item["sort_order"] = i
        item["accepted_answers"] = accepted
        furigana = furigana_lib.annotate_word(v["form"], v["reading"])
        if furigana:
            item["furigana"] = furigana
        mnemonic = mnemonics.get(v["slug"])
        if mnemonic:
            # Phase 2d split mnemonics: the meaning mnemonic chains from the
            # component kanji's stories; the reading mnemonic is a full story, a
            # one-sentence pointer at the word that already taught the reading,
            # or (Rev 6, for the derivable majority) absent — see
            # `reading_composition` above, which states the derivation instead.
            # The legacy one-line mnemonic_text stays as the pre-2d fallback.
            for field in ("meaning_mnemonic", "reading_mnemonic", "description"):
                if mnemonic.get(field):
                    item[field] = mnemonic[field]
            _merge_sidecar_meta(item, _sidecar_meta(mnemonic))
        example_entry = examples.get(v["slug"])
        if example_entry:
            _inline_examples(item, example_entry, known_readings, vocab_forms,
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

    return _build_radical_items(N5_RADICALS)


def build_n5_kanji():
    from n5_kanji import N5_KANJI

    return _build_kanji_items(N5_KANJI)


_FURIGANA_BRACKET_RE = re.compile(r"\[([^\[\]]*)]")


def _is_group_kanji(ch):
    """Kanji for furigana grouping: parseFurigana also takes 々 into the run."""
    return ch == "々" or furigana_lib.is_kanji(ch)


def _wrap_spans(plain, annotated, spans, label):
    """`annotated` with each span wrapped as `{{slug|inflection|text}}`.

    `spans` are offsets into `plain` (`annotated` minus its `[readings]`). A
    reading belongs to the maximal kanji run before it, as in the app's
    parseFurigana; a span edge inside such a group would split a reading, so
    that span is dropped with a warning instead."""
    # Per plain char: where it starts in `annotated`, where it ends (a group's
    # last kanji ends after its bracket), and which offsets fall inside a group.
    starts, ends = [], []
    inside = set()
    cursor = 0
    for match in _FURIGANA_BRACKET_RE.finditer(annotated):
        group_start = match.start()
        while group_start > cursor and _is_group_kanji(annotated[group_start - 1]):
            group_start -= 1
        for i in range(cursor, group_start):
            starts.append(i)
            ends.append(i + 1)
        if group_start < match.start():
            inside.update(range(len(starts) + 1, len(starts) + match.start() - group_start))
            for i in range(group_start, match.start()):
                starts.append(i)
                ends.append(i + 1)
            ends[-1] = match.end()
        cursor = match.end()
    for i in range(cursor, len(annotated)):
        starts.append(i)
        ends.append(i + 1)

    out = []
    pos = 0  # annotated index already emitted
    for span in spans:
        if span["start"] in inside or span["end"] in inside:
            print(f"warning: {label}: span {span['vocabulary_slug']} cuts furigana "
                  f"group in {plain}", file=sys.stderr)
            continue
        begin, end = starts[span["start"]], ends[span["end"] - 1]
        out.append(annotated[pos:begin])
        out.append("{{%s|%s|%s}}" % (span["vocabulary_slug"], span.get("inflection") or "",
                                     annotated[begin:end]))
        pos = end
    out.append(annotated[pos:])
    return "".join(out)


def _link_words(plain, annotated, forms_by_slug, label):
    """`annotated` with every taught word in `plain` wrapped in a lesson word
    marker. Candidates are the whole level's vocabulary; the spans are the
    same ones a grammar pool sentence carries."""
    if furigana_lib.strip_furigana(annotated) != plain:
        print(f"warning: {label}: annotation does not match text, words not linked: "
              f"{plain}", file=sys.stderr)
        return annotated
    spans = spans_lib.merge_spans(
        spans_lib.derive_spans(plain, forms_by_slug),
        spans_lib.build_stem_spans(plain, forms_by_slug),
    )
    return _wrap_spans(plain, annotated, spans, label)


def _annotate_prose_line(line, known_readings, forms_by_slug, label):
    """Annotates kanji-bearing Japanese runs embedded in prose and links the
    taught words in every run, kana-only ones included. Runs already followed
    by a bracket annotation are left alone, so reviewer hand-edits that carry
    notation survive a rebuild. Inline `code` spans are skipped — lessons use
    them for deliberately-incorrect forms, which the renderer shows without
    furigana."""
    code_spans = [m.span() for m in _CODE_SPAN_RE.finditer(line)]
    out = []
    pos = 0
    for match in _JP_RUN_RE.finditer(line):
        if any(start <= match.start() < end for start, end in code_spans):
            continue
        run = match.group(0)
        if match.end() < len(line) and line[match.end()] == "[":
            continue
        annotated = run
        if any(furigana_lib.is_kanji(ch) for ch in run):
            annotated = furigana_lib.annotate_sentence(run, known_readings) or run
        if forms_by_slug:
            annotated = _link_words(run, annotated, forms_by_slug, label)
        if annotated == run:
            continue
        out.append(line[pos:match.start()])
        out.append(annotated)
        pos = match.end()
    out.append(line[pos:])
    return "".join(out)


def _annotate_lesson_markdown(body, known_readings, label, forms_by_slug):
    """Build-time furigana pass over a lesson body: ```jp fence lines are
    annotated as whole sentences, prose lines per Japanese run. Authors and
    generators write plain Japanese; the tokenizer — never the LLM — supplies
    readings (docs/content/content-pipeline-plan.md Phase 0). Annotation failures
    leave the text plain and warn: for *generated* drafts the Phase 2 gate has
    already rejected them, so a warning here means a human edit needs fixing.
    Taught words are then wrapped in `{{slug|inflection|text}}` markers, which
    is why a lesson may not contain `{{` or `}}` itself."""
    if "{{" in body or "}}" in body:
        raise ValueError(f"{label}: lesson text contains '{{{{' or '}}}}'")
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
                    annotated = _annotate_prose_line(stripped, known_readings, forms_by_slug,
                                                     label)
                    if annotated == stripped and any(
                        furigana_lib.is_kanji(ch) for ch in stripped
                    ):
                        print(f"warning: {label}: furigana failed for jp line: {stripped}",
                              file=sys.stderr)
                else:
                    annotated = _link_words(stripped, annotated, forms_by_slug, label)
                out.append(annotated)
            else:
                out.append(line)
        else:
            out.append(_annotate_prose_line(line, known_readings, forms_by_slug, label))
    return "\n".join(out)


def _load_lesson(slug, known_readings, forms_by_slug):
    """(sidecar_meta, annotated_body) for grammar/lessons/<slug>.md, or None
    when the grammar point has no long-form lesson yet."""
    path = os.path.join(LESSONS_DIR, f"{slug}.md")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        meta, body = frontmatter_lib.parse(f.read())
    label = f"grammar lesson {slug}"
    return meta, _annotate_lesson_markdown(body, known_readings, label, forms_by_slug)


def _grammar_example(example, sort_order, g, vocab_forms, known_readings, errors):
    """One grammar example sentence with the Read/Build card fields
    (docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md §4.2)."""
    jp, vslugs = example["jp"], example["vocab"]
    for vs in vslugs:
        if vs not in vocab_forms:
            errors.append(f"grammar {g['slug']} example {sort_order} references unknown vocab '{vs}'")
    sentence = {
        "japanese": jp,
        "english": example["en"],
        "sort_order": sort_order,
        "vocabulary_slugs": vslugs,
    }
    sentence_furigana = furigana_lib.annotate_sentence(jp, known_readings)
    if sentence_furigana:
        sentence["furigana"] = sentence_furigana
    word_spans = _example_word_spans(jp, vslugs, vocab_forms)
    # Pool sentences also link the stem in front of the grammar (行き of
    # 行きましょう), which the taught-inflection spans deliberately skip.
    forms_by_slug = {s: vocab_forms[s] for s in vslugs if s in vocab_forms}
    word_spans = spans_lib.merge_spans(word_spans, spans_lib.build_stem_spans(jp, forms_by_slug))
    if word_spans:
        sentence["word_spans"] = word_spans
    if example.get("start") is not None:
        # Cloze-derived: the blank is the grammar; do not search for it.
        span = {"start": example["start"], "end": example["start"] + len(example["form"])}
    else:
        try:
            span = grammar_sentences_lib.grammar_span(jp, g["accepted_forms"], example.get("form"))
        except ValueError as error:
            errors.append(f"grammar {g['slug']} example {sort_order}: {error}")
            span = None
    if span:
        sentence["grammar_span"] = span
    sentence["register"] = grammar_sentences_lib.register_of(jp)
    alternates = []
    for plain, kind in example.get("alts") or []:
        furigana = furigana_lib.annotate_sentence(plain, known_readings)
        if furigana is None or "[" in plain:
            errors.append(f"grammar {g['slug']} example {sort_order}: alternate "
                          f"{plain!r} cannot be annotated (write plain Japanese)")
            continue
        alternates.append({"furigana": furigana, "kind": kind})
    if alternates:
        sentence["build_alternates"] = alternates
    return sentence


def _cloze_derived_examples(g, known_vocab_forms):
    """Filled cloze variants as extra pool sentences (spec §4.1 source 2).
    Their vocabulary links are derived from the level's taught words, the
    same way a passage links every word it contains."""
    derived = []
    existing = {e["jp"] for e in g["examples"]}
    for example in grammar_sentences_lib.cloze_examples(g.get("cloze_variants", []), existing):
        grammar = {"start": example["start"], "end": example["start"] + len(example["form"])}
        slugs = []
        for span in spans_lib.derive_spans(example["jp"], known_vocab_forms):
            # A word inside the grammar is the grammar (います -> いる), not a
            # word the Build card should list.
            if grammar["start"] <= span["start"] and span["end"] <= grammar["end"]:
                continue
            if span["vocabulary_slug"] not in slugs:
                slugs.append(span["vocabulary_slug"])
        derived.append({**example, "vocab": slugs, "alts": []})
    return derived


def _build_grammar_level(jlpt_level, grammar_entries, vocab_forms, known_readings=None,
                         all_grammar_slugs=(), known_vocab_forms=None, pool_entries=None):
    errors = []
    items = []
    forms = known_vocab_forms or {}
    for i, g in enumerate(grammar_entries, start=1):
        pool_entry = (pool_entries or {}).get(g["slug"])
        if pool_entry:
            examples = _pool_examples(pool_entry)
        else:
            examples = list(g["examples"]) + _cloze_derived_examples(g, known_vocab_forms or {})
        example_sentences = [
            _grammar_example(example, j, g, vocab_forms, known_readings, errors)
            for j, example in enumerate(examples)
        ]
        for vs in g["vocabulary_slugs"]:
            if vs not in vocab_forms:
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
        meanings = pool_entry["accepted_meanings"] if pool_entry else g.get("accepted_meanings")
        if meanings:
            item["accepted_answers"] = [
                {"answer_type": "meaning", "answer_text": meaning, "is_primary": index == 0}
                for index, meaning in enumerate(meanings)
            ]
        if g.get("uses"):
            uses = []
            for use in g["uses"]:
                entry = dict(use)
                use_furigana = furigana_lib.annotate_sentence(use["japanese"], known_readings)
                if use_furigana:
                    entry["furigana"] = use_furigana
                word_spans = spans_lib.merge_spans(
                    spans_lib.derive_spans(use["japanese"], forms),
                    spans_lib.build_stem_spans(use["japanese"], forms),
                )
                if word_spans:
                    entry["word_spans"] = word_spans
                uses.append(entry)
            item["uses"] = uses
        lesson = _load_lesson(g["slug"], known_readings, forms)
        if lesson:
            meta, body = lesson
            item["explanation_markdown"] = body
            if meta.get("caution_notes"):
                item["caution_notes"] = meta["caution_notes"]
            related = meta.get("related_grammar_slugs") or []
            if related:
                # A lesson may point at another level's point: N4 lessons
                # relate to the N5 points their N4 duplicates were merged into.
                # One at a later level is a ladder problem for
                # reports/level_report.py, not a build error.
                grammar_slugs = {entry["slug"] for entry in grammar_entries} | set(
                    all_grammar_slugs
                )
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
    # Phase 4 derives word_count in _build alongside the spans; the shipped
    # hand-authored passages carry none, so this is a no-op until a generated
    # set is wired in (generate_content/generate_readings.py).
    "word_count",
)


def _passage_word_spans(body, authored_spans, vocab_forms):
    """The authored dictionary spans plus the taught inflections of every word
    the level teaches (feedback 14.1a, widened 2026-08-10).

    The dictionary layer is the shipped, reviewed data and wins every overlap.
    The candidate set is the whole level's vocabulary, not just the words the
    authored spans already link, so a word that appears *only* conjugated
    (食べます in a passage that never writes 食べる) gets a span too — and with it
    a place in `vocabulary_slugs`, which raises that passage's ≥90% Guru+ unlock
    bar on purpose. Re-running over a set that already carries inflected spans
    is a no-op."""
    merged = spans_lib.merge_spans(
        authored_spans, spans_lib.build_inflected_spans(body, vocab_forms)
    )
    # A word the passage newly links is tappable wherever it occurs, dictionary
    # form included (「増えている」 next to 「なっています」) — the authored span
    # layer never listed those, since the word was not linked when it was
    # written. Only the new slugs are re-scanned: the reviewed dictionary layer
    # of the words already linked stays exactly as authored.
    new_slugs = {s["vocabulary_slug"] for s in merged} - {
        s["vocabulary_slug"] for s in authored_spans
    }
    if not new_slugs:
        return merged
    new_forms = {}
    for slug, form in vocab_forms.items():
        if slug in new_slugs:
            new_forms.setdefault(form, slug)
    return spans_lib.merge_spans(merged, spans_lib.build_word_spans(body, new_forms))


def _build_readings_level(jlpt_level, reading_entries, known_readings=None,
                          vocab_forms=None):
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
            # The passage's key in curriculum/id-registry.json: it must never
            # change once shipped, or the passage gets a new id.
            "slug": p["slug"],
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
        if passage.get("word_spans"):
            passage["word_spans"] = _passage_word_spans(
                p["body"], passage["word_spans"], vocab_forms or {}
            )
            # A conjugation-only word arrives with its span, so the link list is
            # re-derived from the merged spans (the convention validate_readings'
            # enrich() already follows) rather than copied from the authored JSON.
            passage["vocabulary_slugs"] = sorted(
                set(passage.get("vocabulary_slugs") or [])
                | {s["vocabulary_slug"] for s in passage["word_spans"]}
            )
        passages.append(passage)
    return {"jlpt_level": jlpt_level, "passages": passages}


# ---------------------------------------------------------------------------
# N4 builders (mirror the N5 shape; datasets defined in n4_*.py)
# ---------------------------------------------------------------------------

def build_n4_radicals():
    from n4_radicals import N4_RADICALS

    return _build_radical_items(N4_RADICALS)


def build_n4_kanji():
    from n4_kanji import N4_KANJI

    return _build_kanji_items(N4_KANJI)


# ---------------------------------------------------------------------------
# Bands
#
# Radicals and kanji are not written per level. Their level is a *band* — a
# teaching budget of 150 / 150 / 400 / 300 / 1,000 assigned by corpus reuse in
# reports/kanji_bands.py — and a band mixes all three source datasets: a kanji
# hand-authored in n4_kanji.py can sit in the N5 band, and one derived from
# KANJIDIC in the N3 band.
#
# Slugs do not follow and name no level: `yen` is `yen` in whichever band it
# lands, because `user.db` and the id registry are keyed by it, and a slug that
# named a level would be a second, stale copy of the label the band carries.
# ---------------------------------------------------------------------------

SKELETON_PATH = os.path.join(BUILD_DIR, "skeleton.json")
VOCAB_SKELETON_PATH = os.path.join(BUILD_DIR, "vocab_skeleton.json")
BANDS_PATH = os.path.join(BUILD_DIR, "bands.json")
DECOMPOSITION_PATH = os.path.join(BUILD_DIR, "decomposition.json")

BAND_LEVELS = ["n5", "n4", "n3", "n2", "n1"]

#: Levels whose vocabulary is derived rather than hand-authored (plan v2 Phase
#: D). They ship words, readings and meanings — no mnemonics, no examples.
SKELETON_VOCAB_LEVELS = ["n3", "n2", "n1"]


def load_skeleton():
    with open(SKELETON_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_decomposition():
    """The KanjiVG-derived decomposition and the radicals it needs.

    Owns the derived radical inventory since the KanjiVG switch: a radical
    exists because some kanji is built from it, and that list is now this file's
    to state. `skeleton["radicals"]` was the KRADFILE-era answer to the same
    question and no longer feeds the build."""
    with open(DECOMPOSITION_PATH, encoding="utf-8") as f:
        return json.load(f)


def load_bands():
    with open(BANDS_PATH, encoding="utf-8") as f:
        return json.load(f)


def _write_banded(kind, items, bands):
    """Split one flat item list across the five level files by band.

    A slug bands.json does not name is a build error, not a silent drop: it
    means the datasets and the band assignment have diverged, and the item would
    disappear from the curriculum without anybody noticing."""
    by_level = {level: [] for level in BAND_LEVELS}
    for item in items:
        band = bands.get(item["slug"])
        if band is None:
            raise ValueError(
                f"{kind} {item['slug']!r} has no band; re-run "
                "reports/kanji_bands.py after changing the datasets"
            )
        by_level[band["level"]].append((band["sort_order"], item))
    for level, entries in by_level.items():
        entries.sort(key=lambda pair: pair[0])
        items_out = []
        for i, (_key, item) in enumerate(entries, start=1):
            items_out.append({**item, "sort_order": i})
        write_json(
            os.path.join(CURRICULUM_DIR, kind, f"{level}.json"),
            {"jlpt_level": level.upper(), "items": items_out},
        )
    return {level: len(v) for level, v in by_level.items()}


def generate_bands():
    """Rebuild all five radical and kanji level files from every source."""
    skeleton = load_skeleton()
    decomposition = load_decomposition()
    bands = load_bands()

    radicals = (
        build_n5_radicals()
        + build_n4_radicals()
        + _build_radical_items(decomposition["radicals"])
    )
    kanji = (
        build_n5_kanji()
        + build_n4_kanji()
        + _build_kanji_items(skeleton["kanji"])
    )
    rad_counts = _write_banded("radicals", radicals, bands["radicals"])
    kanji_counts = _write_banded("kanji", kanji, bands["kanji"])
    for level in BAND_LEVELS:
        print(f"  {level.upper()}: {kanji_counts[level]} kanji, "
              f"{rad_counts[level]} radicals")


# ---------------------------------------------------------------------------
# Level orchestration
# ---------------------------------------------------------------------------

def _vocab_sources():
    """[(default level, entries)] for every word: the hand-authored N5/N4
    datasets, then the derived corpus. A derived word's default level is its
    frequency rank, which `import/build_vocab_skeleton.py` owns; the corpus is
    written most-frequent-first, and that is the teaching order."""
    from n4_vocab import N4_VOCAB
    from n5_vocab import N5_VOCAB

    with open(VOCAB_SKELETON_PATH, encoding="utf-8") as f:
        words = json.load(f)["words"]
    sources = [("n5", N5_VOCAB), ("n4", N4_VOCAB)]
    for level in SKELETON_VOCAB_LEVELS:
        entries = [w for w in words if w["level"] == level]
        if not entries:
            raise ValueError(
                f"no {level.upper()} words in vocab_skeleton.json; run "
                "import/build_vocab_skeleton.py"
            )
        sources.append((level, entries))
    return sources


def _grammar_inputs(level):
    from n4_grammar import N4_GRAMMAR
    from n5_grammar import N5_GRAMMAR
    vocab_by_level = place("vocabulary", _vocab_sources())
    all_vocab_forms = {
        v["slug"]: v["form"] for entries in vocab_by_level.values() for v in entries
    }
    known = [v for lower in BAND_LEVELS[: BAND_LEVELS.index(level) + 1]
             for v in vocab_by_level[lower]]
    grammar_by_level = place("grammar", [("n5", N5_GRAMMAR), ("n4", N4_GRAMMAR)])
    return {
        "vocab_by_level": vocab_by_level,
        "all_vocab_forms": all_vocab_forms,
        "known": known,
        "known_readings": _vocab_reading_map(known),
        "grammar_by_level": grammar_by_level,
        "all_grammar_slugs": {g["slug"] for entries in grammar_by_level.values() for g in entries},
    }


def build_grammar_point(level, slug, pool_entry):
    """One grammar item as generate_level would write it with `pool_entry` in
    the sidecar. The content lane validates this before writing anything."""
    level = level.lower()
    inputs = _grammar_inputs(level)
    entries = [g for g in inputs["grammar_by_level"][level] if g["slug"] == slug]
    if not entries:
        raise KeyError(f"unknown grammar slug {slug!r} in {level}")
    item = _build_grammar_level(
        level.upper(), entries, inputs["all_vocab_forms"], inputs["known_readings"],
        inputs["all_grammar_slugs"],
        known_vocab_forms={v["slug"]: v["form"] for v in inputs["known"]},
        pool_entries={slug: pool_entry},
    )["items"][0]
    item["sort_order"] = next(
        i for i, g in enumerate(inputs["grammar_by_level"][level], start=1) if g["slug"] == slug
    )
    return item


def generate_level(level):
    """Vocabulary, grammar and readings for one level.

    Radicals and kanji are not here: their level is a band spanning every source
    dataset, so they are written together by `generate_bands`."""
    from n4_readings import N4_READINGS
    from n5_readings import N5_READINGS

    level = level.lower()
    inputs = _grammar_inputs(level)
    vocab_by_level = inputs["vocab_by_level"]
    # {slug: dictionary form} of every word at every level: the cross-reference
    # check, and the spans of the words a sentence links.
    all_vocab_forms = inputs["all_vocab_forms"]
    # The words a learner knows by the end of this level: their readings
    # override the tokenizer, and a passage links every one it contains.
    known = inputs["known"]
    known_readings = inputs["known_readings"]
    vocab = _build_vocab_level(level.upper(), vocab_by_level[level], known_readings,
                               all_vocab_forms)
    write_json(os.path.join(CURRICULUM_DIR, "vocabulary", f"{level}.json"), vocab)
    if level in SKELETON_VOCAB_LEVELS:
        # Vocabulary only: N3+ grammar and reading passages are out of scope for
        # this plan (docs/content/kanji-coverage-and-dependency-order-plan.md).
        print(f"Generated {level.upper()} vocabulary: {len(vocab['items'])} words.")
        return

    grammar_by_level = inputs["grammar_by_level"]
    write_json(
        os.path.join(CURRICULUM_DIR, "grammar", f"{level}.json"),
        _build_grammar_level(level.upper(), grammar_by_level[level], all_vocab_forms,
                             known_readings, inputs["all_grammar_slugs"],
                             known_vocab_forms={v["slug"]: v["form"] for v in known},
                             pool_entries=load_pool_sidecar()),
    )
    # Grammar Read + Build cards need every point's pool to pass (spec §4.4).
    failing = {slug: errs for slug, errs in pool_check.check_level(level).items() if errs}
    if failing:
        lines = [f"{slug}: {errs[0]}" for slug, errs in failing.items()]
        raise SystemExit(
            f"{level.upper()} grammar pool fails for {len(failing)} point(s) — run "
            "generate_content.check_grammar_pool for the full report:\n" + "\n".join(lines)
        )
    passages_by_level = place("passage", [("n5", N5_READINGS), ("n4", N4_READINGS)])
    write_json(
        os.path.join(CURRICULUM_DIR, "readings", f"{level}.json"),
        _build_readings_level(level.upper(), passages_by_level[level], known_readings,
                              {v["slug"]: v["form"] for v in known}),
    )
    print(f"Generated {level.upper()} JSON files.")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", choices=["n5", "n4", "n3", "n2", "n1"],
                        help="vocabulary, grammar and readings for one level "
                             "(N3+ is vocabulary only, and derived)")
    parser.add_argument("--bands", action="store_true",
                        help="all five radical and kanji level files, from every source")
    args = parser.parse_args()
    if not args.level and not args.bands:
        parser.error("give --level and/or --bands")
    if args.level:
        generate_level(args.level)
    if args.bands:
        generate_bands()
        print("Generated banded radical and kanji JSON files.")


if __name__ == "__main__":
    main()
