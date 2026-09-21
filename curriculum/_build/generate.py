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
Run kanji_bands.py first whenever the datasets change.

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
from generate_content import spans as spans_lib  # noqa: E402
from generate_content.mnemonic_context import reading_composition  # noqa: E402
from visually_similar import build_similar_map  # noqa: E402

#: Rev 1 look-alike pairs (R1.3), emitted as `visually_similar_slugs` on
#: radical/kanji items. compile-curriculum resolves and hard-fails on any
#: slug that is not a taught radical/kanji.
_SIMILAR_SLUGS = build_similar_map()

LESSONS_DIR = os.path.join(CURRICULUM_DIR, "grammar", "lessons")

#: Phase 2b/2d mnemonic sidecars (generate_content/generate_mnemonics.py),
#: inlined into the radical/kanji/vocab items below keyed by slug. Absent when
#: the generator has not run for that type.
KANJI_MNEMONICS_DIR = os.path.join(CURRICULUM_DIR, "kanji", "mnemonics")
RADICAL_MNEMONICS_DIR = os.path.join(CURRICULUM_DIR, "radicals", "mnemonics")
VOCAB_MNEMONICS_DIR = os.path.join(CURRICULUM_DIR, "vocabulary", "mnemonics")

#: Phase 2c example-sentence sidecars (generate_content/generate_examples.py),
#: inlined into the kanji/vocab items below keyed by slug. Absent when 2c has
#: not run.
KANJI_EXAMPLES_DIR = os.path.join(CURRICULUM_DIR, "kanji", "examples")
VOCAB_EXAMPLES_DIR = os.path.join(CURRICULUM_DIR, "vocabulary", "examples")

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


CLOZE_BLANK = "＿＿＿"
_FURIGANA_TOKEN_RE = re.compile(r"(.)\[[^\]]*\]|(.)")


def _cloze_furigana(jp_cloze, answer, known_readings):
    """Furigana for a cloze prompt, derived the same way example sentences get
    theirs. The blank is filled with the answer first — the tokenizer needs a
    whole sentence to read 帰った correctly — then the answer's annotated span
    is cut back out. Returns None (no `jp_cloze_furigana`, app falls back to
    the plain prompt) whenever the round trip is not exact."""
    if CLOZE_BLANK not in jp_cloze:
        return None
    prefix, _, suffix = jp_cloze.partition(CLOZE_BLANK)
    annotated = furigana_lib.annotate_sentence(prefix + answer + suffix, known_readings)
    if not annotated:
        return None
    # One entry per plain character, so the answer's character range can be
    # mapped onto the annotated string without splitting a […] reading.
    spans = [m.span() for m in _FURIGANA_TOKEN_RE.finditer(annotated)]
    plain = "".join(m.group(1) or m.group(2) for m in _FURIGANA_TOKEN_RE.finditer(annotated))
    if plain != prefix + answer + suffix or not answer:
        return None
    start, end = len(prefix), len(prefix) + len(answer)
    return annotated[: spans[start][0]] + CLOZE_BLANK + annotated[spans[end - 1][1] :]


def _inline_examples(item, entry, known_readings, vocab_forms, label, errors):
    """Inlines a 2c example-sentence sidecar entry into a kanji/vocab item.
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


def _build_radical_items(slug_prefix, radical_entries):
    """Items for one *source* dataset — n5, n4 or the derived corpus (`k`).

    No `sort_order` and no level: `_write_banded` assigns both from bands.json.
    `slug_prefix` names the dataset that wrote the entry, which is what the
    sidecar files and the bundled art are keyed by, and it does not move when
    the band does."""
    mnemonics = _load_sidecar(RADICAL_MNEMONICS_DIR, slug_prefix)
    items = []
    for r in radical_entries:
        item = {
            "slug": r["slug"],
            "primary_form": r["form"],
            "meaning": r["meaning"],
        }
        if r.get("mnemonic"):
            item["mnemonic_text"] = r["mnemonic"]
        if r["slug"] in _SIMILAR_SLUGS:
            item["visually_similar_slugs"] = _SIMILAR_SLUGS[r["slug"]]
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
            # The directory is `slug_prefix` — the dataset that wrote the entry,
            # including the derived `k` corpus, which has its own directory. It
            # is deliberately not the band: a slug does not follow its band, so
            # keying the ref to the band would point it at a path the file never
            # moves to the moment a radical rebands.
            item["visual_mnemonic_url"] = f"radicals/{slug_prefix}/{r['slug']}.webp"
        if r.get("accepted_meanings"):
            item["accepted_answers"] = [
                {"answer_type": "meaning", "answer_text": m} if j else
                {"answer_type": "meaning", "answer_text": m, "is_primary": True}
                for j, m in enumerate(r["accepted_meanings"])
            ]
        items.append(item)
    return items


def _build_kanji_items(slug_prefix, kanji_entries, known_readings=None,
                       vocab_forms=None):
    """Items for one source dataset. See `_build_radical_items` on prefixes."""
    mnemonics = _load_sidecar(KANJI_MNEMONICS_DIR, slug_prefix)
    examples = _load_sidecar(KANJI_EXAMPLES_DIR, slug_prefix)
    errors = []
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
        slug = k.get("slug") or f"{slug_prefix}-{k['suffix']}"
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
            _inline_examples(item, example_entry, known_readings, vocab_forms or {},
                             f"kanji {slug}", errors)
        items.append(item)
    if errors:
        raise ValueError(f"{slug_prefix} kanji reference errors:\n" + "\n".join(errors))
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
    mnemonics = _load_sidecar(VOCAB_MNEMONICS_DIR, jlpt_level.lower())
    examples = _load_sidecar(VOCAB_EXAMPLES_DIR, jlpt_level.lower())
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

    return _build_radical_items("n5", N5_RADICALS)


def build_n5_kanji(known_readings=None, vocab_forms=None):
    from n5_kanji import N5_KANJI

    return _build_kanji_items("n5", N5_KANJI, known_readings, vocab_forms)


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


def _build_grammar_level(jlpt_level, grammar_entries, vocab_forms, known_readings=None):
    errors = []
    items = []
    for i, g in enumerate(grammar_entries, start=1):
        example_sentences = []
        for j, (jp, en, vslugs) in enumerate(g["examples"]):
            for vs in vslugs:
                if vs not in vocab_forms:
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
            word_spans = _example_word_spans(jp, vslugs, vocab_forms)
            if word_spans:
                sentence["word_spans"] = word_spans
            example_sentences.append(sentence)
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
        if g.get("cloze_variants"):
            variants = []
            for j, cv in enumerate(g["cloze_variants"]):
                variant = {**cv, "sort_order": j}
                cloze_furigana = _cloze_furigana(
                    cv["jp_cloze"], cv["answer"], known_readings
                )
                if cloze_furigana:
                    variant["jp_cloze_furigana"] = cloze_furigana
                variants.append(variant)
            item["cloze_variants"] = variants
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


def build_n5_grammar(vocab_forms, known_readings=None):
    from n5_grammar import N5_GRAMMAR

    return _build_grammar_level("N5", N5_GRAMMAR, vocab_forms, known_readings)


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


def build_n5_readings(known_readings=None, vocab_forms=None):
    from n5_readings import N5_READINGS

    return _build_readings_level("N5", N5_READINGS, known_readings, vocab_forms)


# ---------------------------------------------------------------------------
# N4 builders (mirror the N5 shape; datasets defined in n4_*.py)
# ---------------------------------------------------------------------------

def build_n4_radicals():
    from n4_radicals import N4_RADICALS

    return _build_radical_items("n4", N4_RADICALS)


def build_n4_kanji(known_readings=None, vocab_forms=None):
    from n4_kanji import N4_KANJI

    return _build_kanji_items("n4", N4_KANJI, known_readings, vocab_forms)


def build_n4_vocab(known_readings=None, extra_vocab_forms=None):
    from n4_vocab import N4_VOCAB

    return _build_vocab_level("N4", N4_VOCAB, known_readings, extra_vocab_forms)


def build_n4_grammar(vocab_forms, known_readings=None):
    from n4_grammar import N4_GRAMMAR

    return _build_grammar_level("N4", N4_GRAMMAR, vocab_forms, known_readings)


def build_n4_readings(known_readings=None, vocab_forms=None):
    from n4_readings import N4_READINGS

    return _build_readings_level("N4", N4_READINGS, known_readings, vocab_forms)


# ---------------------------------------------------------------------------
# Bands
#
# Radicals and kanji are not written per level. Their level is a *band* — a
# teaching budget of 150 / 150 / 400 / 300 / 1,000 assigned by corpus reuse in
# reports/kanji_bands.py — and a band mixes all three source datasets: a kanji
# hand-authored in n4_kanji.py can sit in the N5 band, and one derived from
# KANJIDIC in the N3 band.
#
# Slugs do not follow. `n5-en` keeps its prefix wherever it lands, because the
# mnemonic sidecars, the bundled radical art and `user.db` are all keyed by it,
# and because a slug that named a level would be a second, stale copy of the
# label the band already carries.
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
    from n4_vocab import N4_VOCAB
    from n5_vocab import N5_VOCAB

    skeleton = load_skeleton()
    decomposition = load_decomposition()
    bands = load_bands()

    # Per source, with that source's own reference scope: an N5 kanji example
    # may only name N5 words, an N4 one may also reinforce N5. The "k" source
    # is itself banded across every level (bands.json), so its examples are
    # generated under whichever band the kanji lands in — currently always N5
    # or N4 (N3+ has no example-sentence pipeline yet) — and n4_forms, being
    # the N5+N4 union already, is a safe superset reference scope for it.
    n5_readings = _vocab_reading_map(N5_VOCAB)
    n5_forms = {v["slug"]: v["form"] for v in N5_VOCAB}
    n4_readings = _vocab_reading_map(N5_VOCAB, N4_VOCAB)
    n4_forms = {**n5_forms, **{v["slug"]: v["form"] for v in N4_VOCAB}}

    radicals = (
        build_n5_radicals()
        + build_n4_radicals()
        + _build_radical_items("k", decomposition["radicals"])
    )
    kanji = (
        build_n5_kanji(n5_readings, n5_forms)
        + build_n4_kanji(n4_readings, n4_forms)
        + _build_kanji_items("k", skeleton["kanji"], n4_readings, n4_forms)
    )
    rad_counts = _write_banded("radicals", radicals, bands["radicals"])
    kanji_counts = _write_banded("kanji", kanji, bands["kanji"])
    for level in BAND_LEVELS:
        print(f"  {level.upper()}: {kanji_counts[level]} kanji, "
              f"{rad_counts[level]} radicals")


# ---------------------------------------------------------------------------
# Level orchestration
# ---------------------------------------------------------------------------

def build_skeleton_vocab(level):
    """One skeleton level's vocabulary, from the derived corpus.

    The level is already assigned — a word's level is its frequency rank, which
    `import/build_vocab_skeleton.py` owns — so this only filters and orders. The
    corpus is written most-frequent-first, and that is the teaching order."""
    with open(VOCAB_SKELETON_PATH, encoding="utf-8") as f:
        words = json.load(f)["words"]
    entries = [w for w in words if w["level"] == level]
    if not entries:
        raise ValueError(
            f"no {level.upper()} words in vocab_skeleton.json; run "
            "import/build_vocab_skeleton.py"
        )
    return _build_vocab_level(level.upper(), entries)


def generate_level(level):
    """Vocabulary, grammar and readings for one level.

    Radicals and kanji are not here: their level is a band spanning every source
    dataset, so they are written together by `generate_bands`."""
    level = level.lower()
    if level in SKELETON_VOCAB_LEVELS:
        # Vocabulary only: N3+ grammar and reading passages are out of scope for
        # this plan (docs/content/kanji-coverage-and-dependency-order-plan.md).
        vocab = build_skeleton_vocab(level)
        write_json(os.path.join(CURRICULUM_DIR, "vocabulary", f"{level}.json"), vocab)
        print(f"Generated {level.upper()} vocabulary: {len(vocab['items'])} words.")
        return
    if level == "n5":
        from n5_vocab import N5_VOCAB

        known_readings = _vocab_reading_map(N5_VOCAB)
        vocab = build_n5_vocab(known_readings)
        # {slug: primary_form}: the cross-reference check *and* the span
        # derivation, which needs the dictionary form to recognise inflections.
        vocab_forms = {v["slug"]: v["primary_form"] for v in vocab["items"]}
        write_json(os.path.join(CURRICULUM_DIR, "vocabulary", "n5.json"), vocab)
        write_json(
            os.path.join(CURRICULUM_DIR, "grammar", "n5.json"),
            build_n5_grammar(vocab_forms, known_readings),
        )
        write_json(
            os.path.join(CURRICULUM_DIR, "readings", "n5.json"),
            build_n5_readings(known_readings, vocab_forms),
        )
    elif level == "n4":
        from n4_vocab import N4_VOCAB
        from n5_vocab import N5_VOCAB

        known_readings = _vocab_reading_map(N5_VOCAB, N4_VOCAB)
        n5_vocab_forms = {v["slug"]: v["form"] for v in N5_VOCAB}
        # N4 is additive on N5: examples may reinforce previously learned N5
        # vocabulary, so validate against the combined slug set.
        vocab = build_n4_vocab(known_readings, n5_vocab_forms)
        vocab_forms = {
            **n5_vocab_forms,
            **{v["slug"]: v["primary_form"] for v in vocab["items"]},
        }
        write_json(os.path.join(CURRICULUM_DIR, "vocabulary", "n4.json"), vocab)
        write_json(
            os.path.join(CURRICULUM_DIR, "grammar", "n4.json"),
            build_n4_grammar(vocab_forms, known_readings),
        )
        write_json(
            os.path.join(CURRICULUM_DIR, "readings", "n4.json"),
            build_n4_readings(known_readings, vocab_forms),
        )
    else:
        raise ValueError(f"unknown level {level}")
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
