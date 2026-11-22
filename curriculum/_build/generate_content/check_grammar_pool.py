# curriculum/_build/generate_content/check_grammar_pool.py
# -*- coding: utf-8 -*-
"""Grammar sentence-pool gate (grammar Read + Build cards).

Spec: docs/superpowers/specs/2026-10-13-grammar-read-build-srs-design.md §4.4.
Report-only until Plan 2 finishes the content; then generate/compile run it as
a hard gate. Run after generate.py:

    .venv/bin/python -m generate_content.check_grammar_pool
    .venv/bin/python -m generate_content.check_grammar_pool --level 4 --report reports/grammar-pool-baseline.md
"""

import argparse
import os
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from levels import MAX_LEVEL  # noqa: E402
from generate_content import context, grammar_detect, level_check  # noqa: E402
from generate_content import grammar_sentences as gs  # noqa: E402
from generate_content import spans as spans_lib  # noqa: E402

MIN_SENTENCES = 8
MIN_MEANINGS = 3

#: Points whose grammar cannot take ≥ 2 sentence shapes (e.g. a form that is
#: never negative or past). One slug per line, each with a one-line reason.
VARIETY_EXEMPT = set()


def _parse_alternate(furigana):
    """Plain text of a furigana alternate, or None when the brackets don't
    balance (an unclosed 寒[さむ)."""
    if furigana.count("[") != furigana.count("]"):
        return None
    plain = furigana_lib.strip_furigana(furigana)
    return None if "[" in plain or "]" in plain else plain


def split_suru_slugs(plain, linked):
    """Slugs of する-verbs in `linked` that `plain` writes with を between the
    noun and する (電話をします for 電話する). derive_spans finds only the
    unsplit form, and both are correct answers."""
    return {
        slug for slug, form in linked.items()
        if form.endswith("する") and len(form) > 2
        and any(form[:-2] + "を" + s in plain for s in "しすさせ")
    }


def _alternate_errors(sentence, item, other_family_forms, vocab_forms, pronoun_slugs):
    errors = []
    span = sentence.get("grammar_span")
    chunk = sentence["japanese"][span["start"]:span["end"]] if span else None
    linked = {s: vocab_forms[s] for s in sentence.get("vocabulary_slugs", []) if s in vocab_forms}
    required = set(linked) - set(pronoun_slugs)
    alternates = sentence.get("build_alternates", [])
    plains = [_parse_alternate(alt["furigana"]) for alt in alternates]
    # (text, grammar start) of every answer an other_grammar alternate may be
    # a swap of: the main sentence at its span, a valid alternate wherever its
    # chunk sits.
    bases = [(sentence["japanese"], span["start"])] if span else []
    if chunk:
        for plain, alt in zip(plains, alternates):
            if plain and alt["kind"] == "valid":
                bases.extend((plain, k) for k in range(len(plain))
                             if plain.startswith(chunk, k))
    for index, (alt, plain) in enumerate(zip(alternates, plains)):
        label = f"rule 6 alternate[{index}]"
        if plain is None:
            errors.append(f"{label}: furigana does not parse: {alt['furigana']!r}")
            continue
        # Same span sources as the build: a stem-only verb (帰りましょう) has
        # no derive_spans span.
        found = ({s["vocabulary_slug"] for s in spans_lib.derive_spans(plain, linked)}
                 | {s["vocabulary_slug"] for s in spans_lib.build_stem_spans(plain, linked)}
                 | split_suru_slugs(plain, linked))
        missing = sorted(required - found)
        if missing:
            errors.append(f"{label}: missing words {missing} in {plain!r}")
            continue
        # A valid alternate keeps this point: its own chunk, or another of the
        # point's accepted forms (じゃありません for ではありません).
        if alt["kind"] == "valid" and chunk and not any(
                f in plain for f in [chunk, *item.get("accepted_forms", [])]):
            errors.append(f"{label}: valid alternate lacks the grammar {chunk!r}: {plain!r}")
        if alt["kind"] == "other_grammar" and not (chunk and any(
            plain == base[:k] + f + base[k + len(chunk):]
            for base, k in bases for f in other_family_forms
        )):
            errors.append(
                f"{label}: other_grammar alternate is not an accepted answer with a "
                f"same-family form in place of {chunk!r}: {plain!r}"
            )
    return errors


#: Grammar any pool sentence may use before its lesson: without these
#: particles and the です/ます forms the first lessons cannot make a sentence.
CORE_GRAMMAR = frozenset({
    "wa-topic", "desu", "dewa-arimasen", "masu", "masen", "mashita", "wo", "ga",
    "no-possessive", "ni-direction", "ni-indirect", "he-direction", "de-location",
    "to-and", "mo-also", "ka-question",
})


def allowed_grammar_for(item):
    """Slugs a sentence for `item` may use: every point up to and including
    `item` in ladder order, and CORE_GRAMMAR."""
    return CORE_GRAMMAR | frozenset(
        g["slug"] for g in context.load_grammar() if g["sort_order"] <= item["sort_order"]
    )


def _later_grammar(sentence, allowed_grammar):
    """Detected grammar the learner has not met: the detector looks for every
    grammar point, of any level. A hit inside this point's own
    span, or inside a word shown in dictionary form (暑い, 一緒に, もう), is not
    later grammar; a conjugated word (寒かった) is. Same-span matches are one
    hit (ました is masu and mashita); it passes when any of them is allowed."""
    jp = sentence["japanese"]
    covered = [(w["start"], w["end"]) for w in sentence.get("word_spans", [])
               if not w.get("inflection")]
    if sentence.get("grammar_span"):
        covered.append((sentence["grammar_span"]["start"], sentence["grammar_span"]["end"]))
    hits = {}
    for m in grammar_detect.detect(jp, MAX_LEVEL)["matches"]:
        if any(start <= m["start"] and m["end"] <= end for start, end in covered):
            continue
        hits.setdefault((m["start"], m["form"]), set()).add(m["slug"])
    return sorted(f"{form} ({'/'.join(sorted(slugs))})"
                  for (_, form), slugs in hits.items() if not slugs & allowed_grammar)


def sentence_errors(sentence, item, allowed_index, other_family_forms, vocab_forms,
                    pronoun_slugs=frozenset(), allowed_grammar=None):
    jp = sentence["japanese"]
    errors = []
    span = sentence.get("grammar_span")
    if not span:
        errors.append("rule 1: no grammar span")
    uncovered = gs.uncovered_content_words(jp, sentence.get("word_spans", []), span)
    if uncovered:
        errors.append(f"rule 2: words with no word span {uncovered}")
    violations = level_check.find_violations(jp, allowed_index, item.get("accepted_forms", []))
    if violations:
        errors.append(f"rule 3: out of range {violations}")
    if allowed_grammar is not None:
        later = _later_grammar(sentence, allowed_grammar)
        if later:
            errors.append(f"rule 8: grammar from a later lesson {later}")
    errors.extend(_alternate_errors(sentence, item, other_family_forms, vocab_forms, pronoun_slugs))
    return [f"{jp} — {e}" for e in errors]


def point_errors(item, allowed_index, other_family_forms, vocab_forms,
                 pronoun_slugs=frozenset(), allowed_grammar=None):
    errors = []
    passing = []
    for sentence in item.get("example_sentences", []):
        found = sentence_errors(sentence, item, allowed_index, other_family_forms, vocab_forms,
                                pronoun_slugs, allowed_grammar)
        errors.extend(found)
        if not found:
            passing.append(sentence)
    if len(passing) < MIN_SENTENCES:
        errors.append(f"rule 4: {len(passing)} passing sentences, need {MIN_SENTENCES}")
    seen = {}
    for sentence in passing:
        key = frozenset(sentence.get("vocabulary_slugs", []))
        if key in seen:
            errors.append(f"rule 5: same words as {seen[key]!r}: {sentence['japanese']!r}")
        else:
            seen[key] = sentence["japanese"]
    shapes = {gs.sentence_shape(s["japanese"]) for s in passing}
    if item["slug"] not in VARIETY_EXEMPT and len(shapes) < 2:
        errors.append(f"rule 5: {len(shapes)} sentence shape(s), need 2 (question/negative/past)")
    meanings = [a for a in item.get("accepted_answers", []) if a["answer_type"] == "meaning"]
    if len(meanings) < MIN_MEANINGS:
        errors.append(f"rule 7: {len(meanings)} accepted meanings, need {MIN_MEANINGS}")
    return errors


def _other_family_forms(item, grammar):
    family = item.get("family")
    return [
        form for other in grammar
        if other["slug"] != item["slug"] and family and other.get("family") == family
        for form in other["accepted_forms"] if "〜" not in form
    ]


#: Personal pronouns natural Japanese drops; a Build alternate may omit them.
#: Question words and demonstratives (何, どこ, これ) are tagged pronoun in the
#: vocabulary too, but dropping them changes the sentence.
DROPPABLE_PRONOUNS = frozenset({
    "watashi", "watashitachi", "boku", "anata", "kimi", "kare", "kanojo",
})


def _pronoun_slugs(vocab):
    return frozenset(
        v["slug"] for v in vocab
        if v["slug"] in DROPPABLE_PRONOUNS and "pronoun" in (v.get("word_type") or "")
    )


def pronoun_slugs_through(level):
    return _pronoun_slugs(context.vocab_through(level))


def check_point(item):
    """Every rule for one built grammar item at its ladder level, with the same
    context as check_level — used by the content lane's ingest before anything
    is written. The words are `context.allowed_vocab_for`: every word at or
    below the point's level; an alternate may use a same-family point at or
    below it."""
    level = item["level"]
    vocab = context.vocab_through(level)
    vocab_forms = {v["slug"]: v["primary_form"] for v in vocab}
    allowed = level_check.build_allowed_index(vocab)
    return point_errors(
        item, allowed, _other_family_forms(item, context.grammar_through(level)), vocab_forms,
        _pronoun_slugs(vocab), allowed_grammar_for(item),
    )


def check_level(level=None):
    """{slug: [errors]} for every grammar point at `level` (every level when
    None). A read-once card is never reviewed, so it has no pool to check."""
    return {
        item["slug"]: check_point(item)
        for item in context.load_grammar()
        if not item.get("read_once") and level in (None, item["level"])
    }


def _report(results_by_level):
    lines = ["# Grammar pool report", ""]
    for level, results in results_by_level.items():
        failing = {slug: errs for slug, errs in results.items() if errs}
        lines += [f"## Level {level} — {len(results) - len(failing)}/{len(results)} points pass", ""]
        for slug, errs in failing.items():
            lines.append(f"### {slug}")
            lines += [f"- {e}" for e in errs]
            lines.append("")
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--level", type=int, help="one ladder level (default: every level)")
    parser.add_argument("--report", help="write the markdown report to this path")
    args = parser.parse_args()
    levels = [args.level] if args.level else sorted({g["level"] for g in context.load_grammar()})
    results = {level: check_level(level) for level in levels}
    report = _report(results)
    if args.report:
        with open(args.report, "w", encoding="utf-8") as f:
            f.write(report)
    print(report)
    failing = sum(1 for r in results.values() for errs in r.values() if errs)
    sys.exit(1 if failing else 0)


if __name__ == "__main__":
    main()
