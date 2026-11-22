# -*- coding: utf-8 -*-
"""Mechanical validation gate for generated radical/kanji/vocab prose (2b + 2d).

Run on every batch output before any human sees it
(docs/content/content-pipeline-plan.md, "Mechanical validation gate", adapted
for 2b/2d):

  radical (two texts for one scene: the learner-facing `mnemonic_text`, and
  `image_prompt`, the stroke-walked version the Tier 2 art is drawn from):
    1. mnemonic_text present, non-empty, within length bounds, plain prose
    2. the radical's meaning is recognisable in the image *and wrapped in a
       <radical> tag*, so the word a kanji story will later borrow is the same
       word the learner saw highlighted here
    3. `description` is optional (Rev 3, matching kanji/vocab) and is required
       only when the item has reviewed look-alikes to contrast; when present it
       names every one of them and invents none
    4. image_prompt (Rev 5) is required on freshly generated drafts only —
       stored drafts predate the field, and the backfill copies their
       mnemonic_text in verbatim. It gets the markup/length/tag checks but
       never the readability gate: clause-stacked specification is what an
       illustrator's prompt wants.
  kanji:
    1. both mnemonics present and non-empty, within length bounds (measured on
       the tag-stripped prose); `description` is optional and is required only
       when the item has reviewed look-alikes to contrast
    2. reading_mnemonic literally contains the target reading kana
       (kana-normalised, so コウ satisfies こう) inside a <reading> tag, and
       (Rev 9, fresh drafts only) names this kanji's own meaning inside a
       <kanji> tag, so the sound is tied to the character it belongs to
    3. meaning_mnemonic references the taught decomposition — every taught
       component's meaning is recognisable in the story *and wrapped in a
       <radical> tag* (or, when the kanji has no taught decomposition, the check
       is skipped: it is a whole-character pictograph)
    4. plain prose only — no markdown/HTML beyond the one highlight tag each
       field allows, and none at all in a description
    5. the same look-alike checks as radicals, on the description
  vocabulary (2d):
    1. both mnemonics present, plain prose, within length bounds; `description`
       optional as above
    2. meaning_mnemonic references every taught component kanji's meaning inside
       a <kanji> tag, so the radical -> kanji -> vocabulary chain is literal and
       visible. The *untaught* kanji the word is also written with
       (`ctx["untaught_components"]`) are allowed in the story and never
       required: the prompt asks for them, but a word has only two sentences and
       which half of a four-kanji compound they buy is a judgement, not a rule.
    3. both mnemonics name this word's own meaning inside a <vocabulary> tag
       (Rev 5, fresh drafts only) — the same self-tag the kanji layer carries as
       <kanji>, so the learner can tell a piece borrowed from below from the
       word this card is teaching
    4. reading_mnemonic contains the word's reading in a <reading> tag, and its
       *shape* matches the mechanically computed reading regularity: a regular
       or kana-only reading gets no reading mnemonic at all (Rev 6), an
       irregular one gets a full story (bounded long)
    5. the description names no kanji beyond the word and its components
  every layer:
    every highlight tag also names the character it stands for, in a `form`
    attribute — `<kanji form="少">few</kanji>` — so the app can print that
    character beside the English word: "a few (少) years (年)". See _FORM_ATTR.

Rev 4 adds a sentence-shape (readability) gate, enforced only when the caller
passes enforce_readability=True — i.e. on freshly generated drafts. Stored
drafts are re-validated without it, so no kept item is ever requeued for a
readability rewrite. Rev 5's radical image_prompt requirement, Rev 8's
one-sentence meaning mnemonic and Rev 9's reading-mnemonic contract (at most
two sentences, the tighter READING_FRESH_BOUNDS band, and the required <kanji>
meaning tag) all ride the same flag for the same reason. So does the vocabulary
layer's Rev 5 contract: at most two sentences, the tighter
VOCAB_MEANING_FRESH_BOUNDS / VOCAB_READING_STORY_FRESH_BOUNDS bands, the short
form for a word that simply is its kanji, and the required <vocabulary> tag.

This gate is a floor: the cast-coherence pass and "does it actually help you
remember" judgement are human review (Phase 5). `validate-schema` after assembly
is the pipeline's final backstop.

Standalone usage (re-check collected drafts):
    .venv/bin/python -m generate_content.validate_mnemonics --level 6 --type kanji
"""

import argparse
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
from generate_content import context  # noqa: E402
from generate_content import level_check  # noqa: E402
from generate_content import mnemonic_context  # noqa: E402

DRAFTS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "drafts", "mnemonics")

#: Length guards, per content type, measured on the **tag-stripped** text so the
#: highlight markup never counts toward the budget.
#:
#: Rev 3 calibrates these against the prose the maintainer actually kept, rather
#: than against a target picked in the abstract. The reviewed N5 set lands at:
#:
#:   radical mnemonic_text    144–299 chars (median 214)
#:   kanji   meaning_mnemonic 144–366        (median 256)
#:   kanji   reading_mnemonic 133–272        (median 204)
#:   kanji   description       59–165        (median 104)
#:
#: The prompts aim at the middle of each range; these bounds sit just outside it
#: so an item that genuinely needs more room still passes. Rev 2's floors (300 /
#: 250) were set from the since-discarded long radical descriptions and would
#: have rejected most of the kept content — a band is only worth anything if the
#: prose you like fits inside it.
#: Rev 5 splits the radical contract: mnemonic_text is now the short
#: learner-facing summary (prompt target ~100–180 chars, so its floor drops to
#: 80 — a lower floor can only pass more stored drafts, never fail one), and
#: image_prompt keeps the old stroke-walked size band.
LEN_BOUNDS = {
    # Grammar mnemonics spec §3: a one- or two-sentence story plus a short
    # Japanese example. The four reference examples land at 112–133
    # characters tag-stripped, so the floor sits at 100. There is no stored
    # grammar prose older than this contract, so one band serves every draft.
    "grammar": {
        "mnemonic_text": (100, 240),
    },
    "radical": {
        # The straightforward rewrite ("This radical is a combination of heavy
        # and power. ...") lands at 60–170, so the floor drops to 50. A lower
        # floor can only pass more stored drafts, never fail one.
        "mnemonic_text": (50, 400),
        "image_prompt": (120, 500),
        "description": (60, 400),
    },
    "kanji": {
        # Rev 8, meaning only: the mnemonic is now ONE sentence that reads as a
        # reason — the components combine into the meaning rather than acting it
        # out (see MEANING_MAX_SENTENCES). One sentence lands at 70–170, so the
        # floor drops to 60; "an employee is one more mouth to feed with money"
        # is 74 characters and is the target, not a shortfall. The 260 ceiling
        # stays where Rev 6 put it so re-validating stored Rev 6 prose does not
        # fail on length; on freshly generated drafts the real cap is the
        # one-sentence rule plus READABILITY_MAX_SENTENCE_WORDS, which together
        # cannot exceed ~200 characters.
        "meaning_mnemonic": (60, 260),
        # Rev 9 drops the floor from 120 the way Rev 8 dropped the meaning
        # floor: the new reading contract lands at 90–200, and a stored Rev 9
        # draft is re-validated on this band. A lower floor can only pass more
        # drafts, never fail one. The 380 ceiling stays so re-validating the
        # old three-sentence readings does not requeue them.
        "reading_mnemonic": (90, 380),
        "description": (50, 400),
    },
    # vocab reading_mnemonic is bounded by the regularity branch below, not here.
    "vocab": {
        # Rev 5 makes the same cut to the word layer that Rev 8 made to the
        # kanji layer: one or two sentences that *explain* the word out of its
        # kanji, not a scene they take turns in. The floor drops 140 -> 60 to
        # match ("A mouth that you enter is an entrance" is 38 characters of
        # WaniKani and is the target, not a shortfall); the 450 ceiling stays
        # where it was so re-validating stored Rev 4 prose does not fail on
        # length. On freshly generated drafts the real cap is
        # VOCAB_MEANING_FRESH_BOUNDS plus the two-sentence rule.
        "meaning_mnemonic": (60, 450),
        "description": (50, 350),
    },
}

#: Rev 7: a kanji that *is* a taught radical (山 the radical, 山 the kanji —
#: `mnemonic_context.identical_radical`) has no scene to build, so its meaning
#: mnemonic is one or two sentences saying exactly that. The normal 100-char
#: floor would reject the honest answer and push the model back into inventing
#: a story, which is the whole thing this class exists to avoid; the 200 ceiling
#: is what makes the short form mandatory rather than merely allowed. Applies to
#: `meaning_mnemonic` only — the reading is not derivable from the radical and
#: keeps the full band.
IDENTITY_MEANING_BOUNDS = (40, 200)

#: A vocab reading the learner can already derive from its kanji gets a one-line
#: note, not a story (docs 2d: "don't pad regular readings into stories"). The
#: regularity is computed mechanically in mnemonic_context, so which bound
#: applies is not the model's choice. The note's ceiling stays well under the
#: story's floor, so "one line" and "a story" cannot blur into each other.
#:
#: Rev 5 raises the note's ceiling 220 -> 260 because the note now has more to
#: say: it names the derivation pattern (jukugo, kun'yomi, a mix of the two) and
#: any rendaku or gemination the reading went through, which is what turns a
#: recital of two kana chunks into a rule the learner can reuse. Raising a
#: ceiling can only pass more stored drafts, never fail one.
#:
#: Rev 6 stops asking for the note at all: the derivation is now the computed
#: `reading_composition` field, so a fresh draft for one of these words must omit
#: `reading_mnemonic` entirely. The band survives for the stored lane only —
#: every Rev 5 draft on disk is a note, and re-validating one must not requeue
#: kept prose for a key it was correctly told to write.
DERIVATION_NOTE_BOUNDS = (30, 260)
READING_STORY_BOUNDS = (120, 380)

#: Both kinds still omit `reading_mnemonic`. Rev 7 changes only where the kana
#: word's sound hook lives: not in a second field, but inside the one field a
#: word with no kanji has (see VOCAB_KANA_MEANING_FRESH_BOUNDS and the kana
#: branch in validate_vocab).
_DERIVATION_KINDS = ("regular", "kana_only")

#: Rev 6, vocab `reading_mnemonic` when an earlier word already taught this
#: reading (`mnemonic_context._reading_teachers` — 答え after 答える, 書ける after
#: 書く). One sentence pointing back at that word, never a rival story: two
#: images for one sound leave the learner unsure which word either belongs to.
#: The ceiling is what makes the short form mandatory rather than merely
#: allowed, the same job the identity bands do for meanings, and it sits under
#: the story floor so "a pointer" and "a story" cannot blur together.
VOCAB_READING_REUSE_BOUNDS = (50, 200)
VOCAB_READING_REUSE_MAX_SENTENCES = 1

#: The same words on the stored lane, where the band has to admit both shapes:
#: a Rev 4 story written before the reuse rule existed (43 of the 858 stored
#: drafts), and a Rev 6 pointer, which is far shorter than any story floor.
#: Re-validation is not the place a contract change gets enforced — the fresh
#: lane is — so this spans them rather than picking a side.
VOCAB_READING_REUSE_STORED_BOUNDS = (VOCAB_READING_REUSE_BOUNDS[0],
                                     READING_STORY_BOUNDS[1])

#: Rev 5, vocab `meaning_mnemonic`, fresh drafts only — the twin of the kanji
#: layer's MEANING_MAX_SENTENCES / READING_FRESH_BOUNDS pair. Two sentences
#: rather than the kanji layer's one, because a word is joining whole kanji
#: stories rather than radicals, but the discipline is the same: with room for
#: a scene the model writes a scene, and the kanji end up taking turns in it
#: instead of combining. Both ride the enforce_readability lane, so no stored
#: Rev 4 draft is ever requeued by them.
VOCAB_MEANING_MAX_SENTENCES = 2
VOCAB_MEANING_FRESH_BOUNDS = (60, 230)

#: Rev 7, vocab `meaning_mnemonic` for a kana-only word, fresh drafts only. This
#: field now does two jobs — the meaning *and* the sound hook that a kanji word
#: gets from its characters — so it buys a little more room than the kanji-word
#: band. Not much: two jobs in one sentence is the point, and a wider ceiling is
#: how the scene creeps back in.
VOCAB_KANA_MEANING_FRESH_BOUNDS = (70, 260)

#: A word that simply *is* its kanji (`mnemonic_context.identical_kanji`) — 年
#: the kanji and 年 the word — has no story to write, exactly as a kanji that is
#: its own radical has none. The band is the same one Rev 7 gave that case, and
#: it is what makes the short form mandatory rather than merely allowed: a full
#: invented scene now fails instead of being quietly unwanted. Applies to
#: `meaning_mnemonic` only; the reading is not derivable from the kanji and
#: keeps its usual branch.
VOCAB_IDENTITY_MEANING_BOUNDS = (40, 200)

#: Rev 5, vocab `reading_mnemonic` when it is a full story, fresh drafts only.
#: The same band the kanji layer's Rev 9 reading uses, for the same reason —
#: the sound and the meaning are one joke, not a scene with a payoff.
VOCAB_READING_STORY_FRESH_BOUNDS = (90, 240)

#: Highlight markup (Rev 2). A mnemonic wraps the pieces the learner is meant to
#: connect — the taught components it borrows, and the sound the reading hangs
#: on — so the app can render them in the content accent colours instead of
#: burying them in a wall of prose. Each field allows one or more tags, listed
#: as a tuple when more than one, which is what makes "did it actually tag the
#: components" mechanically checkable.
#:
#:   radical mnemonic_text    <radical>mouth</radical>
#:   radical image_prompt     <radical>mouth</radical>  (same word; the image
#:                             pipeline strips the tag before drawing)
#:   kanji  meaning_mnemonic  <radical>ground</radical>  (a borrowed component)
#:                            <kanji>one</kanji>          (the kanji's own
#:                             meaning — the word the story lands on)
#:   kanji  reading_mnemonic  <reading>いち</reading>
#:                            <kanji>one</kanji>          (Rev 9: the meaning
#:                             the sound belongs to)
#:   vocab  meaning_mnemonic  <kanji>one</kanji>        (a borrowed component)
#:                            <vocabulary>alone</vocabulary>  (Rev 5: the word's
#:                             own meaning — the word the story lands on)
#:   vocab  reading_mnemonic  <reading>ひとつ</reading>
#:                            <vocabulary>alone</vocabulary>  (Rev 5: the
#:                             meaning the sound belongs to)
#:
#: A radical's <radical> tag wraps its own meaning — the word the story lands
#: on, and the exact word a kanji story will later reuse. Tagging it makes the
#: two ends of the chain match visually. A radical that is itself a combination
#: of taught radicals (動 = 重 + 力, `mnemonic_context.radical_parts`) also
#: wraps each part's meaning in <part>, which the app renders in its own colour
#: so "a piece I know" and "the answer" never look the same.
#: A kanji's meaning_mnemonic does both: <radical> highlights each borrowed
#: component (as before), and <kanji> highlights the kanji's own landing word
#: — the two must render in different colours, or the learner cannot tell "a
#: piece I already know" from "the thing this story is building toward".
#:
#: Descriptions carry no markup at all: they are reference prose, not a story
#: the learner has to reassemble.
#: Rev 7: the one exception. A kana word's meaning mnemonic also carries the
#: sound, because it is the only field that word has, so `<reading>` is legal
#: there and nowhere else in a meaning mnemonic. Selected per item in
#: validate_vocab, never by the model.
VOCAB_KANA_MEANING_TAGS = ("kanji", "vocabulary", "reading")

#: The glyph attribute. A `<radical>`/`<kanji>`/`<vocabulary>` tag also names
#: the character it stands for, so the app can print that character beside the
#: English word: `a <kanji form="少">few</kanji> <kanji form="年">years</kanji>`
#: renders as "a few (少) years (年)". The glyph rides in an attribute rather
#: than in the prose because the parenthesis, the Japanese font and the
#: screen-reader label are then the app's to decide, and the character never
#: counts toward a length band.
#:
#: `<reading>` carries none: its own text is already the kana. A radical's
#: `image_prompt` carries none either — it is the illustrator's copy, and a
#: character dropped into an art prompt is a thing the picture might try to
#: draw.
#:
#: Required on freshly generated drafts only (`enforce_readability`), the same
#: lane every other added contract rides: every stored mnemonic predates the
#: attribute, and re-validation must never requeue prose the contract of the
#: day did not ask for.
_FORM_ATTR = r'(?: form="([^"<>]*)")?'

ALLOWED_TAG = {
    ("grammar", "mnemonic_text"): ("reading", "grammar"),
    ("radical", "mnemonic_text"): ("radical", "part"),
    ("radical", "image_prompt"): "radical",
    ("kanji", "meaning_mnemonic"): ("radical", "kanji"),
    ("kanji", "reading_mnemonic"): ("reading", "kanji"),
    ("vocab", "meaning_mnemonic"): ("kanji", "vocabulary"),
    ("vocab", "reading_mnemonic"): ("reading", "vocabulary"),
}

_ANY_TAG_RE = re.compile(r"</?[^<>]*>")

#: Structural markdown/markup we never want stored raw in a mnemonic string.
_MARKUP_CHECKS = [
    (re.compile(r"(^|\n)\s{0,3}#{1,6}\s"), "a markdown heading"),
    (re.compile(r"(^|\n)\s{0,3}[-*]\s"), "a markdown list item"),
    (re.compile(r"\*\*"), "bold (**) markers"),
    (re.compile(r"(^|[^\w])_[^_]+_([^\w]|$)"), "underscore emphasis"),
    (re.compile(r"\]\("), "a markdown link"),
    (re.compile(r"</?[a-zA-Z][^>]*>"), "an HTML tag"),
    (re.compile(r"`"), "a backtick"),
    (re.compile(r"\|"), "a table pipe"),
    (re.compile(r"[ぁ-ヿ㐀-䶿一-鿿々〆ー]\["), "furigana brackets"),
]

_WORD_SPLIT_RE = re.compile(r"[a-z]+")

#: Sentence-shape guards (Rev 4), measured on the tag-stripped prose; Japanese
#: characters never count as words. The reviewed N5 set averages 21–26 words
#: per sentence with a worst single sentence of 56, and the readability problem
#: lives in that clause-stacking, not in the vocabulary (its long-word rate is
#: lower than WaniKani's). The prompts now ask for most sentences under ~18
#: words and none over 25; these bounds sit just outside that, the same way
#: LEN_BOUNDS sits outside the prompts' character targets. The mean check only
#: applies once a field has enough sentences for a mean to mean anything.
READABILITY_MAX_SENTENCE_WORDS = 35
READABILITY_MAX_MEAN_WORDS = 20
READABILITY_MEAN_MIN_SENTENCES = 3

#: Rev 8, kanji `meaning_mnemonic` only: one sentence, no exceptions. Rev 6 asked
#: for "two or three sentences, one causal chain" and got a list of staged
#: events with a meaning bolted onto the end — the components took turns instead
#: of combining. A single sentence removes the room to stage them: the only way
#: to fit four components into one sentence is to make each one do grammatical
#: work in the same claim, which is what "logical" means here. Rides the
#: enforce_readability lane, so stored Rev 6 prose is never requeued by it.
MEANING_MAX_SENTENCES = 1

#: Rev 9, kanji `reading_mnemonic` only: the same cut Rev 8 made to the meaning
#: mnemonic, one beat later. A reading mnemonic used to be a three-sentence
#: scene in which the sound turned up somewhere and the kanji's meaning turned
#: up nowhere — a sprinter, a sack and 「せき」, with nothing saying *red*, so the
#: learner ends up holding a sound they cannot attach to a character. The
#: contract is now one sentence (two short ones allowed, since it carries a
#: sound *and* a meaning where the meaning mnemonic carries only components)
#: in which the phonetic hook and the taught meaning are the same joke.
#: READING_FRESH_BOUNDS is the band that goes with it; both ride the
#: enforce_readability lane, so the re-validation of stored drafts keeps
#: LEN_BOUNDS' wider band and no kept reading mnemonic is ever requeued for
#: being long, for being three sentences, or for missing the <kanji> tag.
READING_MAX_SENTENCES = 2
READING_FRESH_BOUNDS = (90, 240)

_SENTENCE_SPLIT_RE = re.compile(r"[.!?]+")
_LATIN_WORD_RE = re.compile(r"[A-Za-z']+")


#: Why a field is capped, keyed by the field's own contract rather than by the
#: cap's number — the vocab meaning mnemonic and every reading mnemonic both cap
#: at 2, and telling a meaning mnemonic it should be "the sound and the meaning
#: in one joke" sends the repair in the wrong direction.
_SENTENCE_CAP_REASON = {
    "components-combine": ("one sentence in which the components combine into "
                           "the meaning, not a scene that acts them out in turn"),
    "kanji-combine": ("the kanji combining into the word's meaning, not a scene "
                      "they take turns acting in"),
    "sound-and-meaning": ("the sound and the meaning in one joke, not a scene "
                          "with a setup and a payoff"),
    "reading-already-known": ("one sentence naming the word that already taught "
                              "this reading — there is no new hook to build"),
}


def _readability_errors(field, text, max_sentences=None, why=None):
    """Sentence-length checks. An em-dash-joined clause chain reads as one long
    breath, so sentences split on terminal punctuation only — that is what makes
    the gate catch the actual failure mode. Messages are written for the
    generator's retry feedback, not for a human report."""
    counts = [
        len(_LATIN_WORD_RE.findall(s))
        for s in _SENTENCE_SPLIT_RE.split(text)
        if s.strip()
    ]
    errors = []
    if max_sentences and len(counts) > max_sentences:
        why = _SENTENCE_CAP_REASON[
            why or ("components-combine" if max_sentences == 1
                    else "sound-and-meaning")
        ]
        errors.append(
            f"{field} is {len(counts)} sentences; write at most "
            f"{max_sentences} — {why}"
        )
    longest = max(counts, default=0)
    if longest > READABILITY_MAX_SENTENCE_WORDS:
        errors.append(
            f"{field} has a {longest}-word sentence; keep every sentence under "
            f"{READABILITY_MAX_SENTENCE_WORDS} words — split it at the natural "
            "joint into two shorter ones"
        )
    if len(counts) >= READABILITY_MEAN_MIN_SENTENCES:
        mean = sum(counts) / len(counts)
        if mean > READABILITY_MAX_MEAN_WORDS:
            errors.append(
                f"{field} averages {mean:.0f} words per sentence; write shorter "
                "sentences — one idea each, most under 18 words, no clause "
                "stacked on with a dash or an -ing tail"
            )
    return errors


def _hira(text):
    return furigana_lib.katakana_to_hiragana(text)


def _markup_errors(field, text):
    errors = []
    for pattern, label in _MARKUP_CHECKS:
        if pattern.search(text):
            errors.append(f"{field} contains {label}; mnemonics must be plain prose")
    return errors


def _length_errors(field, text, bounds):
    lo, hi = bounds
    n = len(text.strip())
    if n < lo:
        return [f"{field} is too short ({n} chars; need >= {lo})"]
    if n > hi:
        return [f"{field} is too long ({n} chars; keep <= {hi})"]
    return []


def _tag_pattern(tag):
    """Group 1 is the `form` glyph (None when the tag carries none), group 2 the
    tagged prose."""
    return re.compile(rf"<{tag}{_FORM_ATTR}>(.*?)</{tag}>", re.S)


def _open_tag_pattern(tag):
    return re.compile(rf"<{tag}{_FORM_ATTR}>\Z")


def _as_tags(tag):
    """Normalise a single tag name or a tuple of tag names into a tuple."""
    if not tag:
        return ()
    return (tag,) if isinstance(tag, str) else tuple(tag)


def _tag_errors(field, text, tag):
    """Structural check on the highlight markup: the only tags in this field
    are the allowed one(s), every one opens and closes in order, none nest,
    none are empty."""
    tags = _as_tags(tag)
    errors = []
    depth = {t: 0 for t in tags}
    openers = {t: _open_tag_pattern(t) for t in tags}
    for match in _ANY_TAG_RE.finditer(text):
        token = match.group(0)
        for t in tags:
            # An opener may carry the glyph attribute; what its value is, is
            # _glyph_errors' business, not this structural pass's.
            if openers[t].match(token):
                if depth[t]:
                    errors.append(f"{field} nests <{t}> inside another <{t}>; tags may not overlap")
                depth[t] += 1
                break
            if token == f"</{t}>":
                if depth[t]:
                    depth[t] -= 1
                else:
                    errors.append(f"{field} closes </{t}> without opening one")
                break
        else:
            allowed = " or ".join(f"<{t}>...</{t}>" for t in tags)
            errors.append(f"{field} contains {token}; the only markup allowed here is {allowed}")
    for t in tags:
        if depth[t]:
            errors.append(f"{field} leaves a <{t}> tag unclosed")
    if errors:
        return errors
    for t in tags:
        if any(not inner.strip() for _form, inner in _tag_occurrences(text, t)):
            errors.append(f"{field} has an empty <{t}></{t}> pair; tag the words themselves")
    return errors


def _strip_tags(text, tag):
    """The prose with the highlight markup — attribute glyphs included — gone,
    which is what every length and readability band is measured on."""
    for t in _as_tags(tag):
        text = _tag_pattern(t).sub(lambda m: m.group(2), text)
    return text


def _tag_occurrences(text, tag):
    """(form, tagged prose) per occurrence of one tag; form is None when the tag
    carries no glyph attribute."""
    return [(m.group(1), m.group(2)) for m in _tag_pattern(tag).finditer(text)]


def _tagged_spans(text, tag):
    spans = []
    for t in _as_tags(tag):
        spans += [inner for _form, inner in _tag_occurrences(text, t)]
    return spans


def _field_errors(kind, field, text, enforce_readability=False, bounds=None,
                  max_sentences=None, sentence_cap_reason=None, tag=None):
    """Markup + length, both measured on the tag-stripped prose. Malformed tags
    short-circuit: stripping them is meaningless until they parse. The Rev 4
    readability gate runs only on freshly generated drafts (see validate_draft),
    never on the re-validation of stored ones.

    `tag` overrides the ALLOWED_TAG entry for items whose legal markup is
    computed rather than fixed — the Rev 7 kana lane is the only one."""
    tag = tag or ALLOWED_TAG.get((kind, field))
    if tag:
        tag_errors = _tag_errors(field, text, tag)
        if tag_errors:
            return tag_errors
    plain = _strip_tags(text, tag)
    errors = _markup_errors(field, plain) + _length_errors(
        field, plain, bounds or LEN_BOUNDS[kind][field])
    if enforce_readability:
        errors += _readability_errors(field, plain, max_sentences,
                                      sentence_cap_reason)
    return errors


def _look_alike_errors(field, text, ctx, own_form, extra_allowed_forms=()):
    """Rev 1 confusable checks: the reviewed look-alikes (and only those) are
    what a description may present as easily-mixed-up characters.

    Two directions, both mechanical:
      * every look-alike in the reviewed pair dataset is actually named
      * no *other* kanji/radical character appears in the prose — the model must
        not invent a confusable, and descriptions carry no furigana, so stray
        Japanese in them would render unreadable anyway.
    """
    errors = []
    allowed = {own_form} | set(extra_allowed_forms)
    for entry in ctx["look_alikes"]:
        allowed.add(entry["form"])
        if entry["form"] not in text:
            errors.append(
                f"{field} never mentions the look-alike {entry['form']} "
                f"(“{entry['meaning']}”); spell out how to tell them apart"
            )
    for ch in dict.fromkeys(mnemonic_context._CJK_RE.findall(text)):
        if ch not in allowed:
            errors.append(
                f"{field} names the character {ch}, which is not a reviewed "
                "look-alike for this item; never invent confusables, and keep "
                "other Japanese out of the description"
            )
    return errors


def _meaning_words(synonyms):
    """Lowercase content words drawn from a component/kanji's meaning synonyms,
    with parenthetical position qualifiers (e.g. "(left)") dropped. A component
    counts as referenced if ANY of these words appears in the story."""
    words = set()
    for syn in synonyms:
        syn = re.sub(r"\([^)]*\)", " ", syn).lower()
        for w in _WORD_SPLIT_RE.findall(syn):
            if len(w) >= 2:
                words.add(w)
    return words


def _references(text, words):
    lowered = text.lower()
    return any(re.search(rf"\b{re.escape(w)}", lowered) for w in words)


def _component_errors(field, text, tag, components, noun, why):
    """Rev 2: a taught component must be *highlighted* where the story uses it,
    not merely mentioned somewhere in the paragraph. The tag is what lets the
    app colour the borrowed piece, which is the whole point of the chain —
    the learner should see at a glance which words came from below."""
    errors = []
    plain = _strip_tags(text, tag)
    spans = _tagged_spans(text, tag)
    for comp in components:
        words = _meaning_words(comp["meaning_synonyms"])
        if not words:
            continue
        phrase = f"{noun} {comp.get('form') or comp.get('char')} (“{comp['meaning']}”)"
        if not _references(plain, words):
            errors.append(f"{field} never references {phrase}; {why}")
        elif not any(_references(span, words) for span in spans):
            errors.append(
                f"{field} references {phrase} but never wraps it in "
                f"<{tag}>...</{tag}>; highlight the taught meaning where the story uses it"
            )
    return errors


def _own_meaning_tag_errors(field, text, ctx, required=False, tag="kanji",
                            noun="kanji"):
    """The item's own meaning — the word the story lands on, as opposed to a
    component borrowed from below — must be the thing its self-tag wraps.

    `tag` is `<kanji>` on a kanji and `<vocabulary>` on a word (Rev 5): each
    layer marks what it borrows in the layer below's colour and what it teaches
    in its own, so the learner can see which is which. Wherever the tag appears
    it must wrap that meaning; `required` additionally demands that it be there
    at all, which is the reading-mnemonic rule on fresh drafts."""
    own_words = _meaning_words(ctx["meaning_synonyms"])
    if not own_words:
        return []
    spans = _tagged_spans(text, tag)
    if not spans:
        if required:
            return [
                f"{field} never says what this {noun} means; name its meaning "
                f"“{ctx['meaning']}” in the sentence and wrap it in "
                f"<{tag}>...</{tag}> — a story with no meaning attached to it "
                f"sticks to the wrong {noun}"
            ]
        return []
    if not any(_references(span, own_words) for span in spans):
        return [
            f"{field} wraps something other than the {noun}'s own meaning "
            f"“{ctx['meaning']}” in <{tag}>...</{tag}>; that tag is reserved for the "
            "word the story lands on"
        ]
    return []


def _glyph_candidates(items, form_key):
    """[(character, the words that identify it), ...] for the things one tag may
    name in one field — a kanji's components, a word's kanji, or the item
    itself."""
    return [(c[form_key], _meaning_words(c["meaning_synonyms"])) for c in items]


def _glyph_errors(field, text, tag, candidates, required):
    """The glyph attribute: every highlight names the character it stands for,
    so the app can print it beside the English word — "a few (少) years (年)".

    Three things are checkable and all three are checked. The character has to
    be one this tag may name here — a hallucinated glyph is a claim the learner
    has no way to test. When the tagged words identify exactly which of them the
    span is about, the character has to be *that* one, since "few (年)" is the
    mistake this attribute exists to make visible. And on a fresh draft it has
    to be there at all: the whole point is that every future mnemonic carries
    the character, and a tag without one silently renders as it always did."""
    errors = []
    forms = [form for form, _words in candidates]
    if forms:
        legal = ", ".join(forms)
        nothing_legal = (
            f"the characters this tag may name here are {legal}"
            if len(forms) > 1 else f"the only character this tag may name here is {legal}"
        )
    else:
        nothing_legal = "this tag carries no character here"
    for form, inner in _tag_occurrences(text, tag):
        named = [f for f, words in candidates if words and _references(inner, words)]
        if form is None:
            if required and forms:
                want = named[0] if named else forms[0]
                errors.append(
                    f"{field} has <{tag}>{inner}</{tag}> with no character on it; write "
                    f'<{tag} form="{want}">{inner}</{tag}> so the app can print the '
                    "character beside the word"
                )
            continue
        if form not in forms:
            errors.append(
                f'{field} tags <{tag} form="{form}">{inner}</{tag}>, but {nothing_legal}'
            )
            continue
        if named and form not in named:
            errors.append(
                f'{field} tags “{inner}” with {form}, but those words are the meaning of '
                f"{' or '.join(named)}; the character on a tag must be the one the tagged "
                "words mean"
            )
    return errors


def _reading_errors(field, text, reading):
    """The reading must be present verbatim *and* highlighted — the kana is the
    single thing the learner is trying to pull out of this story."""
    if _hira(reading) not in _hira(_strip_tags(text, "reading")):
        return [f"{field} must contain the target reading 「{reading}」 verbatim"]
    if not any(_hira(reading) in _hira(span) for span in _tagged_spans(text, "reading")):
        return [
            f"{field} does not highlight the reading; wrap it as "
            f"<reading>{reading}</reading> so the sound stands out"
        ]
    return []


def validate_kanji(slug, draft, ctx=None, enforce_readability=False):
    ctx = ctx or mnemonic_context.kanji_context(slug)
    errors = []

    for field in ("meaning_mnemonic", "reading_mnemonic"):
        value = draft.get(field)
        if not isinstance(value, str) or not value.strip():
            errors.append(f"missing or empty field {field}")
    if errors:
        return errors

    for field in ("meaning_mnemonic", "reading_mnemonic"):
        if field == "meaning_mnemonic":
            bounds = IDENTITY_MEANING_BOUNDS if ctx["identical_radical"] else None
            max_sentences = MEANING_MAX_SENTENCES
        else:
            # Rev 9's tighter band is a fresh-draft rule; stored readings keep
            # the wider LEN_BOUNDS one so re-validation never requeues them.
            bounds = READING_FRESH_BOUNDS if enforce_readability else None
            max_sentences = READING_MAX_SENTENCES
        errors += _field_errors(
            "kanji", field, draft[field], enforce_readability=enforce_readability,
            bounds=bounds, max_sentences=max_sentences)

    # 2. reading present and highlighted
    primary = ctx["primary_reading"]
    if primary:
        errors += _reading_errors("reading_mnemonic", draft["reading_mnemonic"], primary)

    # 3. decomposition referenced and highlighted
    errors += _component_errors(
        "meaning_mnemonic", draft["meaning_mnemonic"], "radical", ctx["components"],
        "the taught component",
        "the story must be built from the taught decomposition")

    # 3b. the kanji's own meaning is the landing word, distinct from any
    # borrowed component: when a <kanji> tag is present it must actually wrap
    # that meaning. Legacy items with no <kanji> tag yet are not required to
    # add one here — that migration is tracked by the chain-check triage pass,
    # not this gate — but a tag that IS there must be used correctly.
    errors += _own_meaning_tag_errors("meaning_mnemonic", draft["meaning_mnemonic"], ctx)

    # 3c. Rev 9: the reading mnemonic names the meaning the sound belongs to,
    # and highlights it — otherwise the learner is left holding a sound with no
    # character attached to it. Required on freshly generated drafts only, the
    # same lane as the readability gate: stored readings predate the rule.
    errors += _own_meaning_tag_errors(
        "reading_mnemonic", draft["reading_mnemonic"], ctx,
        required=enforce_readability)

    # 3d. every highlight names its character, so the app can print it beside
    # the English word: "the ground (土) splits". A borrowed component names the
    # radical it came from, the landing word names this kanji, and <reading>
    # names nothing — its own text is already the kana.
    own = [(ctx["char"], _meaning_words(ctx["meaning_synonyms"]))]
    components = _glyph_candidates(ctx["components"], "form")
    errors += _glyph_errors("meaning_mnemonic", draft["meaning_mnemonic"],
                            "radical", components, enforce_readability)
    errors += _glyph_errors("meaning_mnemonic", draft["meaning_mnemonic"],
                            "kanji", own, enforce_readability)
    errors += _glyph_errors("reading_mnemonic", draft["reading_mnemonic"],
                            "kanji", own, enforce_readability)
    errors += _glyph_errors("reading_mnemonic", draft["reading_mnemonic"],
                            "reading", (), enforce_readability)

    # 4. description (Rev 2: optional — written only when the item has something
    #    a mnemonic cannot carry). Look-alike contrast prose is exactly that, so
    #    an item with reviewed confusables still owes one.
    description = draft.get("description")
    if isinstance(description, str) and description.strip():
        errors += _field_errors(
            "kanji", "description", description,
            enforce_readability=enforce_readability)
        errors += _look_alike_errors(
            "description", description, ctx, ctx["char"],
            extra_allowed_forms=[c["form"] for c in ctx["components"]])
    elif ctx["look_alikes"]:
        forms = ", ".join(entry["form"] for entry in ctx["look_alikes"])
        errors.append(
            f"description is omitted, but this kanji has reviewed look-alikes ({forms}); "
            "the contrast prose is what saves those reviews, so a description is required here"
        )

    return errors


def validate_radical(slug, draft, ctx=None, enforce_readability=False):
    ctx = ctx or mnemonic_context.radical_context(slug)
    errors = []

    text = draft.get("mnemonic_text")
    if not isinstance(text, str) or not text.strip():
        return ["missing or empty field mnemonic_text"]

    errors += _field_errors(
        "radical", "mnemonic_text", text, enforce_readability=enforce_readability)

    # Rev 5: image_prompt is the stroke-walked scene the Tier 2 art is drawn
    # from. Only fresh drafts are held to it (same lane as the readability
    # gate): stored drafts predate the field, and the backfill copies their
    # mnemonic_text in verbatim. No readability gate on it — clause-stacked
    # specification is what an illustrator's prompt wants.
    image_prompt = draft.get("image_prompt")
    if isinstance(image_prompt, str) and image_prompt.strip():
        errors += _field_errors("radical", "image_prompt", image_prompt)
    elif enforce_readability:
        errors.append("missing or empty field image_prompt")

    # The meaning must be reached *and* highlighted. A radical has no components
    # to borrow, so the one thing worth colouring is the word the story resolves
    # to — the same word every kanji built on this radical will pull upward.
    words = _meaning_words(ctx["meaning_synonyms"])
    if words:
        plain = _strip_tags(text, ("radical", "part"))
        spans = _tagged_spans(text, "radical")
        if not _references(plain, words):
            errors.append(
                f"mnemonic_text never lands on the meaning “{ctx['meaning']}”; the image "
                "must resolve to that meaning"
            )
        elif not any(_references(span, words) for span in spans):
            errors.append(
                f"mnemonic_text reaches the meaning “{ctx['meaning']}” but never wraps it in "
                "<radical>...</radical>; highlight the word the picture resolves to"
            )

    # The highlight names its character, so the app can print it beside the
    # English word: "a shouting mouth (口)". `image_prompt` is the illustrator's
    # copy and takes no character — a glyph in an art prompt is a thing the
    # picture might try to draw.
    errors += _glyph_errors("mnemonic_text", text, "radical",
                            [(ctx["form"], words)], enforce_readability)

    # A combination names the radicals it is built from, each in <part>, so the
    # learner sees which pieces they already know. Fresh drafts only: every
    # stored radical predates the rule, and re-validation must not requeue it.
    parts = ctx.get("components", [])
    if parts and enforce_readability:
        errors += _component_errors(
            "mnemonic_text", text, "part", parts, "part",
            "a combination radical names every part it is built from")
    if parts:
        errors += _glyph_errors("mnemonic_text", text, "part",
                                _glyph_candidates(parts, "form"), enforce_readability)
    elif _tagged_spans(text, "part"):
        errors.append(
            "mnemonic_text has <part> tags, but this radical is one shape, not a "
            "combination of taught radicals; remove them")
    if isinstance(image_prompt, str) and image_prompt.strip():
        errors += _glyph_errors("image_prompt", image_prompt, "radical", (), False)

    # Rev 3: a radical's `description` is optional on the same terms as a
    # kanji's — the mnemonic is what the learner reads, so a description that
    # retells it is noise. Look-alike contrast is the one thing the mnemonic
    # cannot carry (it would have to name a character the story isn't about),
    # so a radical with reviewed confusables still owes one.
    description = draft.get("description")
    if isinstance(description, str) and description.strip():
        errors += _field_errors(
            "radical", "description", description,
            enforce_readability=enforce_readability)
        errors += _look_alike_errors("description", description, ctx, ctx["form"])
    elif ctx["look_alikes"]:
        forms = ", ".join(entry["form"] for entry in ctx["look_alikes"])
        errors.append(
            f"description is omitted, but this radical has reviewed look-alikes ({forms}); "
            "the contrast prose is what saves those reviews, so a description is required here"
        )
    return errors


def validate_vocab(slug, draft, ctx=None, enforce_readability=False):
    ctx = ctx or mnemonic_context.vocab_context(slug)
    errors = []

    meaning_text = draft.get("meaning_mnemonic")
    if not isinstance(meaning_text, str) or not meaning_text.strip():
        return ["missing or empty field meaning_mnemonic"]

    # Rev 6: which words get a reading mnemonic at all is decided here, from the
    # mechanically computed regularity, never by the model.
    #
    #   regular / kana_only  — none. The reading is what the kanji already say,
    #                          and the shipped `reading_composition` field says
    #                          so more precisely than prose can. Fresh drafts
    #                          must omit the key; stored Rev 5 drafts carry a
    #                          derivation note and keep passing on the old band,
    #                          because re-validation must never requeue prose
    #                          the contract of the day asked for.
    #   reading_taught_by    — one sentence pointing at the earlier word that
    #                          taught this reading.
    #   otherwise            — a full story.
    kind = ctx["regularity"]["kind"]
    derivable = kind in _DERIVATION_KINDS
    taught_by = ctx.get("reading_taught_by")
    reading_text = draft.get("reading_mnemonic")
    has_reading = isinstance(reading_text, str) and bool(reading_text.strip())
    # Both mistakes are reported alongside the meaning errors rather than
    # returned on their own: a repair round that fixes the reading and then
    # discovers the meaning was also wrong burns one of three attempts.
    if derivable and has_reading and enforce_readability:
        errors.append(
            "reading_mnemonic must be omitted entirely for this word — "
            + ("the word is written in kana exactly as it is read"
               if kind == "kana_only"
               else "its reading is exactly what its kanji already say")
            + ", and the page states that in its own computed field: "
              f"“{ctx['reading_composition']}”. Drop the key; a sentence "
              "restating a computed field only competes with it."
        )
        # Nothing below applies to prose that should not exist.
        has_reading = False
    elif not derivable and not has_reading:
        errors.append(
            "missing or empty field reading_mnemonic — this word's reading is "
            + ("one already taught by another word, so it needs the one-sentence "
               "back-reference" if taught_by
               else "not derivable from its kanji, so it needs a full story")
        )

    # reading_mnemonic's length is bounded by the regularity branch below, not
    # by LEN_BOUNDS, so its markup is checked here rather than via _field_errors.
    reading_tags = ALLOWED_TAG[("vocab", "reading_mnemonic")]

    # Rev 5: a word that simply *is* its kanji says so in a line, and the band
    # is what makes that mandatory rather than merely allowed. Which items these
    # are is computed in mnemonic_context, never judged here.
    is_identity = bool(ctx.get("identical_kanji"))
    # Rev 7: a kana word's meaning mnemonic is also its reading mnemonic, so
    # <reading> is legal in it — here only. Stored drafts get the same allowance
    # (they never used it, and refusing it would requeue nothing) so that the
    # two lanes agree on what the field is allowed to contain.
    is_kana = kind == "kana_only"
    meaning_tags = VOCAB_KANA_MEANING_TAGS if is_kana else None
    meaning_bounds = None
    max_sentences = None
    if enforce_readability:
        if is_identity:
            meaning_bounds = VOCAB_IDENTITY_MEANING_BOUNDS
        elif is_kana:
            meaning_bounds = VOCAB_KANA_MEANING_FRESH_BOUNDS
        else:
            meaning_bounds = VOCAB_MEANING_FRESH_BOUNDS
        max_sentences = VOCAB_MEANING_MAX_SENTENCES
    meaning_tag_errors = _field_errors(
        "vocab", "meaning_mnemonic", meaning_text,
        enforce_readability=enforce_readability, bounds=meaning_bounds,
        max_sentences=max_sentences, sentence_cap_reason="kanji-combine",
        tag=meaning_tags)
    errors += meaning_tag_errors
    tag_errors = []
    if has_reading:
        tag_errors = _tag_errors("reading_mnemonic", reading_text, reading_tags)
        if tag_errors:
            errors += tag_errors
        else:
            errors += _markup_errors(
                "reading_mnemonic", _strip_tags(reading_text, reading_tags))

    # 2. the kanji -> vocabulary chain is literal, not name-dropped.
    #    `ctx["untaught_components"]` is deliberately not passed: those kanji may
    #    be named — nothing here forbids a character the word is written with —
    #    but a story that could not fit one in is not a gate failure.
    errors += _component_errors(
        "meaning_mnemonic", meaning_text, "kanji", ctx["components"],
        "the component kanji",
        "the story must connect its kanji to the word")

    # 2b. Rev 5: and the word's own meaning is marked in its own colour, so the
    #     learner can tell "a kanji I already know" from "the word this is
    #     teaching me". Required in both fields on fresh drafts — a reading with
    #     no meaning beside it sticks to the wrong word — and merely policed on
    #     stored ones, which predate the tag.
    errors += _own_meaning_tag_errors(
        "meaning_mnemonic", meaning_text, ctx, required=enforce_readability,
        tag="vocabulary", noun="word")
    if has_reading and not tag_errors:
        errors += _own_meaning_tag_errors(
            "reading_mnemonic", reading_text, ctx, required=enforce_readability,
            tag="vocabulary", noun="word")

    # 2b'. And every highlight names its character, so the app can print it
    #      beside the English word: "a few (少) years (年) ... a boy (少年)".
    #      A borrowed <kanji> names the character it came from — untaught ones
    #      included, since the learner is looking at them in the written form —
    #      and the landing word names the whole word. <reading> names nothing:
    #      its own text is already the kana.
    own = [(ctx["form"], _meaning_words(ctx["meaning_synonyms"]))]
    word_kanji = _glyph_candidates(
        ctx["components"] + ctx["untaught_components"], "char")
    errors += _glyph_errors("meaning_mnemonic", meaning_text, "kanji",
                            word_kanji, enforce_readability)
    errors += _glyph_errors("meaning_mnemonic", meaning_text, "vocabulary",
                            own, enforce_readability)
    errors += _glyph_errors("meaning_mnemonic", meaning_text, "reading",
                            (), enforce_readability)
    if has_reading and not tag_errors:
        errors += _glyph_errors("reading_mnemonic", reading_text, "vocabulary",
                                own, enforce_readability)
        errors += _glyph_errors("reading_mnemonic", reading_text, "reading",
                                (), enforce_readability)

    # 2c. Rev 7: and on a kana word the meaning mnemonic owes the sound too.
    #     A word with no kanji has nothing else on the page connecting 「どれ」
    #     to "which one", so a scene that only illustrates the meaning leaves
    #     the learner with a picture and no word. Fresh drafts only: every
    #     stored draft predates the rule and re-validation must not requeue
    #     prose the contract of the day did not ask for.
    if is_kana and enforce_readability and not meaning_tag_errors:
        reading = ctx["reading"]
        if reading:
            errors += _reading_errors(
                "meaning_mnemonic (this word is written in kana, so its meaning "
                "mnemonic is the only place the sound can live)",
                meaning_text, reading)

    # 3. reading present and highlighted, and shaped by the mechanically
    #    computed regularity
    if has_reading:
        reading = ctx["reading"]
        if reading:
            errors += _reading_errors("reading_mnemonic", reading_text, reading)
        reading_plain = _strip_tags(reading_text, reading_tags)
        cap, cap_reason = READING_MAX_SENTENCES, "sound-and-meaning"
        if derivable:
            # Stored lane only — a fresh draft here returned above.
            errors += _length_errors(
                "reading_mnemonic (a derivation note — this reading is "
                f"{'kana-only' if kind == 'kana_only' else 'regular'}, so do not "
                "write a story)", reading_plain, DERIVATION_NOTE_BOUNDS)
        elif taught_by:
            # Rev 6: a pointer, not a rival story — and one that says which word
            # it points at, or it is just a shorter story.
            cap, cap_reason = (VOCAB_READING_REUSE_MAX_SENTENCES,
                               "reading-already-known")
            errors += _length_errors(
                "reading_mnemonic (a back-reference — "
                f"{taught_by['form']}（{taught_by['reading']}）already taught "
                "this reading, so do not write a second story for it)",
                reading_plain,
                VOCAB_READING_REUSE_BOUNDS if enforce_readability
                else VOCAB_READING_REUSE_STORED_BOUNDS)
            if enforce_readability and taught_by["form"] not in reading_plain:
                errors.append(
                    f"reading_mnemonic must name {taught_by['form']}, the word "
                    "that already taught this reading — a back-reference that "
                    "does not say which word it points back at leaves the "
                    "learner with a claim they cannot check"
                )
        else:
            # Fresh drafts are held to the tighter Rev 5 band; stored Rev 4 stories
            # keep the wider one so re-validation never requeues them for length.
            errors += _length_errors(
                "reading_mnemonic (a full story — this reading is a lone kun'yomi "
                "or is not derivable at all)", reading_plain,
                VOCAB_READING_STORY_FRESH_BOUNDS if enforce_readability
                else READING_STORY_BOUNDS)
        if enforce_readability and not tag_errors:
            errors += _readability_errors(
                "reading_mnemonic", reading_plain, cap, cap_reason)

    # 4. description (Rev 2: optional — only when the word carries a nuance the
    #    mnemonics cannot). When present it still names no stray kanji, since it
    #    carries no furigana.
    description = draft.get("description")
    if isinstance(description, str) and description.strip():
        errors += _field_errors(
            "vocab", "description", description,
            enforce_readability=enforce_readability)
        allowed = set(ctx["form"]) | {c["char"] for c in ctx["components"]}
        for ch in dict.fromkeys(mnemonic_context._CJK_RE.findall(description)):
            if ch not in allowed:
                errors.append(
                    f"description names the kanji {ch}, which is neither in this word "
                    "nor one of its taught components; descriptions carry no furigana"
                )

    return errors


# --- grammar (grammar mnemonics spec §3, §5) --------------------------------

#: The story before the example: one or two sentences.
GRAMMAR_STORY_MAX_SENTENCES = 2

#: Phrases that state an origin. A point whose table entry is null must not
#: claim one: the model has no reviewed origin to state.
GRAMMAR_ORIGIN_PHRASES = ("really is", "comes from", "came from", "originally",
                          "derived from", "short for")

_JP_CHARS = "぀-ヿ㐀-䶿一-鿿々〆ー、"
#: The example: the last run of Japanese, ending in 。, after a space.
_GRAMMAR_EXAMPLE_RE = re.compile(rf"(?:^|\s)([{_JP_CHARS}]+。)\s*$")
_LATIN_RE = re.compile(r"[A-Za-z]")
_STORY_JAPANESE_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿々〆ー]")
_KANA_ONLY_RE = re.compile(r"[぀-ヿー]+")
#: Quoted speech: its "Oh! That one!" punctuation is not a sentence end.
#: Straight and curly double quotes, and curly single quotes (an apostrophe is
#: a ’ followed by a letter, so it does not close one).
_QUOTED_RE = re.compile(r'"[^"]*"|\u201c[^\u201d]*\u201d|\u2018.*?\u2019(?![A-Za-z])')


def _bare_forms(ctx):
    return [f.replace("〜", "") for f in (ctx["form"], *ctx["accepted_forms"]) if f.replace("〜", "")]


def validate_grammar(slug, draft, ctx=None, enforce_readability=False):
    """Every rule always runs: no stored grammar prose predates this contract,
    so there is no fresh-versus-stored lane (`enforce_readability` is accepted
    for the dispatcher's signature and ignored)."""
    ctx = ctx or mnemonic_context.grammar_context(slug)
    field = "mnemonic_text"
    extra = sorted(set(draft) - {field})
    if extra:
        return [f"unexpected key(s) {', '.join(extra)}; submit only {field}"]
    text = draft.get(field)
    if not isinstance(text, str) or not text.strip():
        return [f"{field} is missing or empty"]

    tags = ALLOWED_TAG[("grammar", field)]
    # `form="…"` makes the app print a glyph the gate never reads (no furigana
    # source for it), so a grammar tag carries none.
    if re.search(r"<(?:reading|grammar)\s+form=", text):
        return [f"{field} must not use form= on a tag; <reading> and <grammar> carry no glyph"]
    tag_errors = _tag_errors(field, text, tags)
    if tag_errors:
        return tag_errors
    plain = _strip_tags(text, tags).strip()
    errors = _markup_errors(field, plain) + _length_errors(field, plain, LEN_BOUNDS["grammar"][field])

    readings = [s.strip() for s in _tagged_spans(text, "reading")]
    if not any(_LATIN_RE.search(s) for s in readings):
        errors.append(
            f"{field} has no English sound-alike in a <reading> tag; tag the English "
            "words that sound like the form, e.g. <reading>OK</reading> for おく"
        )
    bare_forms = _bare_forms(ctx)
    kana_forms = [_hira(f) for f in bare_forms]
    # A form written with kanji (代わりに, 反面) is tagged as written: the span
    # may be any piece of the form itself, kana or not.
    if not any((_KANA_ONLY_RE.fullmatch(s) and any(_hira(s) in k for k in kana_forms))
               or any(s in f for f in bare_forms)
               for s in readings):
        errors.append(
            f"{field} does not tag the kana of the form (or the form itself, when it is "
            f"written with kanji); wrap it in the example, e.g. <reading>{ctx['form']}</reading>"
        )

    meanings = _tagged_spans(text, "grammar")
    if not meanings:
        errors.append(f"{field} has no <grammar> tag; wrap the English words that state the meaning")
    elif not all(_LATIN_RE.search(m) for m in meanings):
        errors.append(f"{field}: <grammar> must wrap English words (the meaning), not Japanese")

    match = _GRAMMAR_EXAMPLE_RE.search(plain)
    if not match:
        errors.append(
            f"{field} must end on a short Japanese example sentence ending in 。 "
            "that shows where the form goes, e.g. 買っておく。"
        )
        story = plain
    else:
        example = match.group(1)
        story = plain[:match.start(1)].strip()
        body = example.rstrip("。")
        if not any(f in body and len(body) > len(f) for f in _bare_forms(ctx)):
            errors.append(
                f"{field}'s example must show the form attached to a word "
                "(e.g. 本を読む), not the form alone"
            )
        extra_allowed = set(_bare_forms(ctx))
        if ctx["origin"]:
            extra_allowed.add(ctx["origin"]["word"])
        violations = level_check.find_violations(example, ctx["allowed_index"], extra_allowed)
        if violations:
            errors.append(
                f"{field}'s example uses words above level {ctx['level']}: "
                f"{', '.join(violations)} — use only words the learner already has"
            )
        # The point's own form (代わりに) and origin word are taught by its
        # lesson, so their kanji need no allowed word.
        own_kanji = {ch for w in extra_allowed for ch in w if furigana_lib.is_kanji(ch)}
        unknown_kanji = sorted({ch for ch in example if furigana_lib.is_kanji(ch)}
                               - ctx["allowed_kanji"] - own_kanji)
        if unknown_kanji:
            errors.append(
                f"{field}'s example has kanji {'、'.join(unknown_kanji)} that no allowed word "
                "teaches; the mnemonic shows no furigana, so write those words with kanji "
                "the learner already knows or in kana"
            )

    # The story is English; Japanese belongs in the final example only. Nothing
    # else is level- or kanji-checked, so none may slip in.
    if match and _STORY_JAPANESE_RE.search(story):
        errors.append(
            f"{field}: the story must be English — Japanese belongs only in the final "
            "example sentence"
        )

    # The sound-alike is usually shouted ("Oh! That one!"); count sentences on
    # the story with quoted speech collapsed, so its ! and ? end nothing.
    errors += _readability_errors(field, _QUOTED_RE.sub('"…"', story),
                                  GRAMMAR_STORY_MAX_SENTENCES, "sound-and-meaning")

    lowered = story.lower()
    origin = ctx["origin"]
    if origin:
        if not any(re.search(rf"\b{re.escape(k.lower())}", lowered) for k in origin["keywords"]):
            errors.append(
                f"{field}: the story must act out the origin {origin['word']} "
                f"\"{origin['gloss']}\" — name the action with one of: "
                f"{', '.join(origin['keywords'])}"
            )
    else:
        found = [p for p in GRAMMAR_ORIGIN_PHRASES if re.search(rf"\b{re.escape(p)}\b", lowered)]
        if found:
            errors.append(
                f"{field} states an origin ({', '.join(found)}), but this point has none "
                "in grammar_origins.json — let the sound hook carry the meaning"
            )
    return errors


def validate_draft(kind, slug, draft, ctx=None, enforce_readability=False):
    """`enforce_readability` turns on the Rev 4 sentence-shape gate. Pass it
    only for freshly generated drafts; stored drafts are re-validated without
    it so kept content is never requeued for a readability rewrite."""
    if kind == "kanji":
        return validate_kanji(slug, draft, ctx, enforce_readability)
    if kind == "radical":
        return validate_radical(slug, draft, ctx, enforce_readability)
    if kind == "vocab":
        return validate_vocab(slug, draft, ctx, enforce_readability)
    if kind == "grammar":
        return validate_grammar(slug, draft, ctx, enforce_readability)
    raise ValueError(f"unknown mnemonic type {kind!r}")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--level", type=int, required=True, help="ladder level, 1-60")
    parser.add_argument("--type", dest="kind", choices=["kanji", "radical", "vocab", "grammar"],
                        required=True)
    args = parser.parse_args()

    level_dir = os.path.join(DRAFTS_DIR, context.level_dir(args.level), args.kind)
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
        errors = validate_draft(args.kind, record["slug"], record["tool_input"])
        print(f"{'PASS' if not errors else 'FAIL'} {record['slug']}")
        for e in errors:
            print(f"  - {e}")
        failed += bool(errors)
    raise SystemExit(1 if failed else 0)


if __name__ == "__main__":
    main()
