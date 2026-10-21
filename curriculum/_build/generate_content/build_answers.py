# curriculum/_build/generate_content/build_answers.py
# -*- coding: utf-8 -*-
"""Accepted answers for grammar Build cards (single-session runbook:
docs/workflows/build-answers-single-session-workflow-automation-prompt.md;
spec: docs/superpowers/specs/2026-10-21-grammar-build-accepted-answers-design.md).

Per grammar point, in order: a fresh model checks every pool sentence against
its lesson and fixes a wrong one; the session proposes the other answers a
teacher would mark correct; a second fresh model judges them; only "valid"
answers are merged into pool.json as alternates. The app grades by exact
match against that list, so a missing correct answer is always a missing
entry. A parser cannot do the judging: GiNZA kept 子供は寝ているうちに…
(the child now eats) and rejected the correct お茶は熱いうちに….
"""

import copy
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

from generate_content import context  # noqa: E402

CHECK_VERSION = "1"
VERDICTS = ("valid", "contrast", "wrong")
SENTENCE_VERDICTS = ("ok", "fix", "unfixable")
MAX_CANDIDATES = 10

# Mirrors IGNORED_RE in mobile/src/core/grammar/buildEvaluator.ts.
_IGNORED_RE = re.compile(r"[\s、。！？!?,.　「」『』]")


def normalize(text):
    """normalizeBuildText: katakana folded to hiragana, punctuation and spaces removed."""
    folded = "".join(chr(ord(ch) - 0x60) if "ァ" <= ch <= "ヶ" else ch for ch in text)
    return _IGNORED_RE.sub("", folded)


def _one_entry_each(entries, key, expected, label, listed):
    """Shared checks for a reply list keyed by a copied sentence or candidate."""
    if not isinstance(entries, list):
        return [f"{label} must be a list"]
    errors = []
    seen = []
    for j, entry in enumerate(entries):
        if not isinstance(entry, dict):
            errors.append(f"{label}[{j}]: must be an object")
            continue
        if entry.get(key) not in expected:
            errors.append(f"{label}[{j}]: {entry.get(key)!r} is not a listed {listed}")
        seen.append(entry.get(key))
    for item in expected:
        if seen.count(item) != 1:
            errors.append(f"{item}: needs exactly one entry (has {seen.count(item)})")
    return errors


def check_reply_errors(reply, sentences):
    entries = reply.get("sentences")
    errors = _one_entry_each(entries, "japanese", sentences, "sentences", "sentence")
    for j, entry in enumerate(entries if isinstance(entries, list) else []):
        if not isinstance(entry, dict):
            continue
        verdict = entry.get("verdict")
        if verdict not in SENTENCE_VERDICTS:
            errors.append(f"sentences[{j}]: verdict must be one of {SENTENCE_VERDICTS}")
        elif verdict == "fix":
            fixed = entry.get("fixed")
            if not isinstance(fixed, str) or not fixed.strip() or fixed == entry.get("japanese"):
                errors.append(f"sentences[{j}]: a fix needs a fixed sentence that differs")
    return errors


def apply_fixes(entry, reply):
    """A copy of `entry` with every fix applied, and the fixes made. A fixed
    sentence loses its alternates: they vary the wrong sentence."""
    entry = copy.deepcopy(entry)
    verdicts = {v["japanese"]: v for v in reply["sentences"]}
    fixes = []
    for sentence in entry["sentences"]:
        verdict = verdicts.get(sentence["japanese"])
        if not verdict or verdict["verdict"] != "fix":
            continue
        fixes.append({"old": sentence["japanese"], "new": verdict["fixed"],
                      "reason": verdict.get("reason", "")})
        sentence["japanese"] = verdict["fixed"]
        sentence["alternates"] = []
    if fixes:
        entry.setdefault("_meta", {}).setdefault("sentence_fixes", []).extend(fixes)
    return entry, fixes


def propose_reply_errors(reply, sentences):
    entries = reply.get("answers")
    errors = _one_entry_each(entries, "japanese", sentences, "answers", "sentence")
    for j, entry in enumerate(entries if isinstance(entries, list) else []):
        if not isinstance(entry, dict):
            continue
        candidates = entry.get("candidates")
        if not isinstance(candidates, list) or not all(
                isinstance(c, str) and c.strip() for c in candidates):
            errors.append(f"answers[{j}]: candidates must be a list of sentences")
        elif len(candidates) > MAX_CANDIDATES:
            errors.append(f"{entry.get('japanese')}: {len(candidates)} candidates, "
                          f"at most {MAX_CANDIDATES}")
    return errors


def filter_candidates(candidates, known, errors_for):
    """(kept, [(dropped, reason)]). A candidate the app already accepts (same
    text after normalize) or one the pool gate would reject never reaches the
    judge."""
    seen = {normalize(k) for k in known}
    kept, dropped = [], []
    for candidate in candidates:
        if normalize(candidate) in seen:
            dropped.append((candidate, "duplicate of an accepted answer"))
            continue
        errors = errors_for(candidate)
        if errors:
            dropped.append((candidate, errors[0]))
            continue
        seen.add(normalize(candidate))
        kept.append(candidate)
    return kept, dropped


def verdict_errors(reply, candidates):
    verdicts = reply.get("verdicts")
    errors = _one_entry_each(verdicts, "candidate", [c for _, c in candidates],
                             "verdicts", "candidate")
    for j, v in enumerate(verdicts if isinstance(verdicts, list) else []):
        if isinstance(v, dict) and v.get("verdict") not in VERDICTS:
            errors.append(f"verdicts[{j}]: verdict must be one of {VERDICTS}")
    return errors


def other_grammar_pairs(sentence, chunk, other_alternates, valid_alternate):
    """The same-family swaps the sentence already has, applied to a new valid
    alternate, so お茶は熱い間に… grades like お茶が熱い間に…."""
    if not chunk or valid_alternate.count(chunk) != 1 or chunk not in sentence:
        return []
    k = sentence.index(chunk)
    before, after = sentence[:k], sentence[k + len(chunk):]
    pairs = []
    for other in other_alternates:
        if not (other.startswith(before) and other.endswith(after)):
            continue
        form = other[len(before):len(other) - len(after)]
        pair = valid_alternate.replace(chunk, form)
        if form and pair not in pairs:
            pairs.append(pair)
    return pairs


def merged_entry(entry, candidates, reply, model, chunks):
    """A copy of `entry` with the valid candidates and their other_grammar
    pairs added. review_status is left alone."""
    entry = copy.deepcopy(entry)
    valid = {v["candidate"] for v in reply["verdicts"] if v["verdict"] == "valid"}
    for i, candidate in candidates:
        if candidate not in valid:
            continue
        sentence = entry["sentences"][i]
        alternates = sentence.setdefault("alternates", [])
        others = [a["japanese"] for a in alternates if a["kind"] == "other_grammar"]
        alternates.append({"japanese": candidate, "kind": "valid"})
        present = {a["japanese"] for a in alternates}
        for pair in other_grammar_pairs(sentence["japanese"], chunks.get(i), others, candidate):
            if pair not in present:
                alternates.append({"japanese": pair, "kind": "other_grammar"})
                present.add(pair)
    entry.setdefault("_meta", {})["answers_check"] = {"version": CHECK_VERSION, "model": model}
    return entry


def select_slugs(level, limit, sidecar):
    return [g["slug"] for g in context.load_grammar(level)
            if g["slug"] in sidecar
            and sidecar[g["slug"]].get("_meta", {}).get("answers_check", {}).get("version")
            != CHECK_VERSION][:limit]
