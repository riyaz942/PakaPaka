# curriculum/_build/generate_content/build_answers.py
# -*- coding: utf-8 -*-
"""Accepted answers for grammar Build cards (single-session runbook:
docs/workflows/build-answers-single-session-workflow-automation-prompt.md;
spec: docs/superpowers/specs/2026-10-21-grammar-build-accepted-answers-design.md).

Per grammar point, in order: the session checks every pool sentence against
its lesson and fixes a wrong one; the session proposes the other answers a
teacher would mark correct; a second fresh model judges them; only "valid"
answers are merged into pool.json as alternates. The app grades by exact
match against that list, so a missing correct answer is always a missing
entry. A parser cannot do the judging: GiNZA kept 子供は寝ているうちに…
(the child now eats) and rejected the correct お茶は熱いうちに….
"""

import argparse
import copy
import json
import os
import re
import sys

BUILD_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
import generate  # noqa: E402
from generate_content import check_grammar_pool as pool_check  # noqa: E402
from generate_content import context  # noqa: E402
from generate_content import grammar_sentences as gs  # noqa: E402
from generate_content.generate_examples import _first_json_object  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(HERE, "web", "answers")
PROMPTS_DIR = os.path.join(HERE, "prompts")
MODULE = "generate_content.build_answers"

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
    alternate, so お茶は熱い間に… grades like お茶が熱い間に…. No pair that
    doubles the form's last character (時に with 前に gives 前にに)."""
    if not chunk or valid_alternate.count(chunk) != 1 or chunk not in sentence:
        return []
    k = sentence.index(chunk)
    before, after = sentence[:k], sentence[k + len(chunk):]
    j = valid_alternate.index(chunk) + len(chunk)
    pairs = []
    for other in other_alternates:
        if not (other.startswith(before) and other.endswith(after)):
            continue
        form = other[len(before):len(other) - len(after)]
        pair = valid_alternate.replace(chunk, form)
        if form and valid_alternate[j:j + 1] != form[-1] and pair not in pairs:
            pairs.append(pair)
    return pairs


def merged_entry(entry, candidates, reply, model, chunks):
    """A copy of `entry` with the valid candidates and their other_grammar
    pairs added. review_status is left alone."""
    entry = copy.deepcopy(entry)
    valid = {v["candidate"] for v in reply["verdicts"] if v["verdict"] == "valid"}
    # The sentence's own swaps only: a pair added for one candidate is not a
    # swap of the sentence (社員だけが… would give 社員だけがが…).
    own_others = [[a["japanese"] for a in s.get("alternates", []) if a["kind"] == "other_grammar"]
                  for s in entry["sentences"]]
    for i, candidate in candidates:
        if candidate not in valid:
            continue
        sentence = entry["sentences"][i]
        alternates = sentence.setdefault("alternates", [])
        others = own_others[i]
        alternates.append({"japanese": candidate, "kind": "valid"})
        present = {a["japanese"] for a in alternates}
        for pair in other_grammar_pairs(sentence["japanese"], chunks.get(i), others, candidate):
            if pair not in present:
                alternates.append({"japanese": pair, "kind": "other_grammar"})
                present.add(pair)
    entry.setdefault("_meta", {})["answers_check"] = {"version": CHECK_VERSION, "model": model}
    return entry


def skipped_entry(entry, reason):
    """A copy of `entry` marked checked-and-skipped, so select moves past it."""
    entry = copy.deepcopy(entry)
    entry.setdefault("_meta", {})["answers_check"] = {"version": CHECK_VERSION, "skipped": reason}
    return entry


def select_slugs(levels, limit, sidecar):
    return [g["slug"] for g in context.load_grammar()
            if g["level"] in levels and g["slug"] in sidecar
            and sidecar[g["slug"]].get("_meta", {}).get("answers_check", {}).get("version")
            != CHECK_VERSION][:limit]


# --- gate -------------------------------------------------------------------

def point_gate_errors(slug, entry):
    """Every pool-gate error for the point built from `entry`; [] means it may be written."""
    try:
        return pool_check.check_point(generate.build_grammar_point(slug, entry))
    except (ValueError, KeyError) as error:
        return [str(error)]


def fix_gate_errors(slug, entry):
    """point_gate_errors, plus: every fixed sentence keeps the old one's
    register (plain/polite), shape (question/negative/past) and listed words.
    The pool gate checks none of that against the old sentence."""
    errors = []
    texts = {s["japanese"] for s in entry["sentences"]}
    for fix in entry.get("_meta", {}).get("sentence_fixes", []):
        if fix["new"] not in texts:
            continue
        if gs.register_of(fix["old"]) != gs.register_of(fix["new"]):
            errors.append(f"{fix['new']} — register differs from {fix['old']}")
        if gs.sentence_shape(fix["old"]) != gs.sentence_shape(fix["new"]):
            errors.append(f"{fix['new']} — shape (question/negative/past) differs from {fix['old']}")
    errors += point_gate_errors(slug, entry)
    if errors:
        return errors
    _, built = _built(slug, entry)
    fixed = {f["new"] for f in entry.get("_meta", {}).get("sentence_fixes", [])}
    for s in entry["sentences"]:
        if s["japanese"] not in fixed:
            continue
        found = {w["vocabulary_slug"] for w in built[s["japanese"]].get("word_spans", [])}
        missing = sorted(set(s["vocabulary_slugs"]) - found)
        if missing:
            errors.append(f"{s['japanese']} — missing listed words {missing}")
    return errors


def gate_context(slug):
    """What candidate_errors needs, built once per point: the words at or below
    the point's level — the same words as check_point, and the same known
    readings as generate.build_grammar_point."""
    level = context.grammar_item(slug)["level"]
    known = generate._known(generate._grammar_inputs()["words"], level)
    return {
        "vocab_forms": {v["slug"]: v["form"] for v in known},
        "pronouns": pool_check.pronoun_slugs_through(level),
        "known_readings": generate._vocab_reading_map(known),
    }


def candidate_errors(candidate, built, item, ctx):
    """Why the pool gate would reject `candidate` as a valid alternate of the
    built sentence `built` ([] when it would not)."""
    furigana = None if "[" in candidate else furigana_lib.annotate_sentence(
        candidate, ctx["known_readings"])
    if furigana is None:
        return ["cannot be annotated with furigana"]
    if gs.register_of(candidate) != built.get("register"):
        return [f"register is not {built.get('register')}"]
    sentence = dict(built, build_alternates=[{"furigana": furigana, "kind": "valid"}])
    return pool_check._alternate_errors(sentence, item, [], ctx["vocab_forms"], ctx["pronouns"])


def _built(slug, entry):
    """(built item, {japanese: built sentence})."""
    item = generate.build_grammar_point(slug, entry)
    return item, {s["japanese"]: s for s in item["example_sentences"]}


# --- files and prompts ------------------------------------------------------

def _path(slug, name):
    level = context.grammar_item(slug)["level"]
    return os.path.join(WEB_DIR, context.level_dir(level), f"{slug}.{name}")


def _remove(*paths):
    for path in paths:
        if os.path.exists(path):
            os.remove(path)


def _write(path, text):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        f.write(text)


def _read_reply(path):
    if not os.path.exists(path):
        raise SystemExit(f"no reply at {path}")
    with open(path, encoding="utf-8") as f:
        return _first_json_object(f.read())


def _write_sidecar(entries):
    with open(generate.POOL_SIDECAR, "w", encoding="utf-8") as f:
        json.dump(entries, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _sentence_lines(entry, built, ctx):
    lines = []
    for s in entry["sentences"]:
        register = built.get(s["japanese"], {}).get("register", "?")
        words = ", ".join(ctx["vocab_forms"].get(v, v) for v in s["vocabulary_slugs"])
        lines.append(f"- {s['japanese']} — {s['english']} ({register}; words: {words})")
    return "\n".join(lines)


def _prompt(template, slug, item, reply_name, next_command, body, errors=None):
    level = item["level"]
    feedback = ""
    if errors:
        feedback = ("\n## Fix these errors from the last attempt\n\n"
                    + "\n".join(f"- {e}" for e in errors) + "\n")
    notes = "\n".join(f"- {n}" for n in item.get("caution_notes", [])) or "- (none)"
    with open(os.path.join(PROMPTS_DIR, template), encoding="utf-8") as f:
        text = (f.read()
                .replace("{{LEVEL}}", f"level {level}")
                .replace("{{FORM}}", item["primary_form"])
                .replace("{{MEANING}}", item["meaning"])
                .replace("{{STRUCTURE}}", item.get("structure") or "")
                .replace("{{CAUTION_NOTES}}", notes)
                .replace("{{SENTENCES}}", body)
                .replace("{{CANDIDATES}}", body)
                .replace("{{VALIDATOR_FEEDBACK}}", feedback))
    header = (f"<!-- Build answers prompt for level {level}/{slug}. Write the reply to "
              f"web/answers/{context.level_dir(level)}/{slug}.{reply_name}, then run:\n"
              f"  .venv/bin/python -m {MODULE} {next_command} --slug {slug}"
              f"{' --model <model>' if next_command != 'judgeprompts' else ''}\n-->\n\n")
    return (header + text.strip()
            + "\n\nReply with exactly one fenced ```json code block and nothing else.\n")


def _check_prompt(slug, entry, errors=None):
    item, built = _built(slug, entry)
    body = _sentence_lines(entry, built, gate_context(slug))
    return _prompt("build-answers-check.md", slug, item, "check.reply.md",
                   "checkingest", body, errors)


def _propose_prompt(slug, entry, errors=None):
    item, built = _built(slug, entry)
    body = _sentence_lines(entry, built, gate_context(slug))
    return _prompt("build-answers-propose.md", slug, item, "propose.reply.md",
                   "judgeprompts", body, errors)


def _judge_prompt(slug, entry, candidates, errors=None):
    item, _ = _built(slug, entry)
    lines = []
    for i, s in enumerate(entry["sentences"]):
        own = [c for k, c in candidates if k == i]
        if own:
            lines.append(f"- {s['japanese']} — {s['english']}")
            lines += [f"  - {c}" for c in own]
    return _prompt("build-answers-judge.md", slug, item, "judge.reply.md",
                   "ingest", "\n".join(lines), errors)


# --- commands ---------------------------------------------------------------

def cmd_select(args):
    slugs = select_slugs(args.levels, args.limit, generate.load_pool_sidecar())
    print(f"{len(slugs)} point(s) selected:")
    print(",".join(slugs))


def cmd_checkprompts(args):
    sidecar = generate.load_pool_sidecar()
    for slug in args.slugs.split(","):
        path = _path(slug, "check.prompt.md")
        _write(path, _check_prompt(slug, sidecar[slug]))
        print(f"wrote {path}")


def cmd_checkingest(args):
    sidecar = generate.load_pool_sidecar()
    entry = sidecar[args.slug]
    prompt_path = _path(args.slug, "check.prompt.md")
    reply_path = _path(args.slug, "check.reply.md")
    reply = _read_reply(reply_path)
    errors = check_reply_errors(reply, [s["japanese"] for s in entry["sentences"]])
    if not errors:
        unfixable = [v for v in reply["sentences"] if v["verdict"] == "unfixable"]
        if unfixable:
            reason = "unfixable: " + "; ".join(
                f"{v['japanese']} ({v.get('reason', '')})" for v in unfixable)
            sidecar[args.slug] = skipped_entry(entry, reason)
            _write_sidecar(sidecar)
            _remove(prompt_path, reply_path)
            print(f"{args.slug}: SKIP — recorded as skipped, no sentence changed: {reason}")
            raise SystemExit(2)
        fixed, fixes = apply_fixes(entry, reply)
        if fixes:
            errors = fix_gate_errors(args.slug, fixed)
    if errors:
        _write(prompt_path, _check_prompt(args.slug, entry, errors))
        _remove(reply_path)
        print(f"{args.slug}: {len(errors)} error(s) — NOT written:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)
    if fixes:
        sidecar[args.slug] = fixed
        _write_sidecar(sidecar)
    _remove(prompt_path, reply_path)
    print(f"{args.slug}: PASS — {len(fixes)} sentence(s) fixed")
    for fix in fixes:
        print(f"  - {fix['old']} → {fix['new']} ({fix['reason']})")


def cmd_proposeprompts(args):
    sidecar = generate.load_pool_sidecar()
    for slug in args.slugs.split(","):
        path = _path(slug, "propose.prompt.md")
        _write(path, _propose_prompt(slug, sidecar[slug]))
        print(f"wrote {path}")


def cmd_judgeprompts(args):
    entry = generate.load_pool_sidecar()[args.slug]
    reply_path = _path(args.slug, "propose.reply.md")
    reply = _read_reply(reply_path)
    errors = propose_reply_errors(reply, [s["japanese"] for s in entry["sentences"]])
    if errors:
        _write(_path(args.slug, "propose.prompt.md"),
               _propose_prompt(args.slug, entry, errors))
        _remove(reply_path)
        print(f"{args.slug}: {len(errors)} error(s) in the proposal:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)
    item, built = _built(args.slug, entry)
    ctx = gate_context(args.slug)
    proposed = {a["japanese"]: a["candidates"] for a in reply["answers"]}
    candidates = []
    for i, s in enumerate(entry["sentences"]):
        known = [s["japanese"]] + [a["japanese"] for a in s.get("alternates", [])]
        kept, dropped = filter_candidates(
            proposed[s["japanese"]], known,
            lambda c, b=built[s["japanese"]]: candidate_errors(c, b, item, ctx))
        candidates += [(i, c) for c in kept]
        for c, reason in dropped:
            print(f"  dropped {c} ({reason})")
    _write(_path(args.slug, "candidates.json"),
           json.dumps(candidates, ensure_ascii=False, indent=2) + "\n")
    if not candidates:
        print(f"{args.slug}: 0 candidates — no judge prompt; run ingest")
        return
    path = _path(args.slug, "judge.prompt.md")
    _write(path, _judge_prompt(args.slug, entry, candidates))
    print(f"wrote {path} ({len(candidates)} candidate(s))")


def cmd_ingest(args):
    candidates_path = _path(args.slug, "candidates.json")
    if not os.path.exists(candidates_path):
        raise SystemExit(f"no {candidates_path} — run judgeprompts first")
    with open(candidates_path, encoding="utf-8") as f:
        candidates = [tuple(c) for c in json.load(f)]
    sidecar = generate.load_pool_sidecar()
    entry = sidecar[args.slug]
    prompt_path = _path(args.slug, "judge.prompt.md")
    reply_path = _path(args.slug, "judge.reply.md")
    reply = _read_reply(reply_path) if candidates else {"verdicts": []}
    errors = verdict_errors(reply, candidates)
    if not errors:
        _, built = _built(args.slug, entry)
        chunks = {}
        for i, s in enumerate(entry["sentences"]):
            span = built[s["japanese"]].get("grammar_span")
            if span:
                chunks[i] = s["japanese"][span["start"]:span["end"]]
        updated = merged_entry(entry, candidates, reply, args.model, chunks)
        errors = point_gate_errors(args.slug, updated)
    if errors:
        _write(prompt_path, _judge_prompt(args.slug, entry, candidates, errors))
        _remove(reply_path)
        print(f"{args.slug}: {len(errors)} error(s) — NOT written:")
        for e in errors:
            print(f"  - {e}")
        raise SystemExit(1)
    sidecar[args.slug] = updated
    _write_sidecar(sidecar)
    _remove(prompt_path, reply_path, candidates_path,
            _path(args.slug, "propose.prompt.md"),
            _path(args.slug, "propose.reply.md"))
    counts = {k: sum(v["verdict"] == k for v in reply["verdicts"]) for k in VERDICTS}
    print(f"{args.slug}: PASS — {counts['valid']} valid, "
          f"{counts['contrast']} contrast, {counts['wrong']} wrong")
    before = {(i, a["japanese"]) for i, s in enumerate(entry["sentences"])
              for a in s.get("alternates", [])}
    for i, s in enumerate(updated["sentences"]):
        for a in s.get("alternates", []):
            if (i, a["japanese"]) not in before:
                print(f"  + [{a['kind']}] {a['japanese']}")


def cmd_skip(args):
    sidecar = generate.load_pool_sidecar()
    sidecar[args.slug] = skipped_entry(sidecar[args.slug], args.reason)
    _write_sidecar(sidecar)
    print(f"{args.slug}: recorded as skipped ({args.reason})")


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser("select")
    pick = p.add_mutually_exclusive_group(required=True)
    pick.add_argument("--level", dest="levels", type=context.parse_level)
    pick.add_argument("--levels", dest="levels", type=context.parse_levels)
    p.add_argument("--limit", type=int, default=6)
    p.set_defaults(func=cmd_select)
    for name, func in (("checkprompts", cmd_checkprompts), ("proposeprompts", cmd_proposeprompts)):
        p = sub.add_parser(name)
        p.add_argument("--slugs", required=True)
        p.set_defaults(func=func)
    for name, func, needs_model in (("checkingest", cmd_checkingest, True),
                                    ("judgeprompts", cmd_judgeprompts, False),
                                    ("ingest", cmd_ingest, True)):
        p = sub.add_parser(name)
        p.add_argument("--slug", required=True)
        if needs_model:
            p.add_argument("--model", required=True)
        p.set_defaults(func=func)
    p = sub.add_parser("skip")
    p.add_argument("--slug", required=True)
    p.add_argument("--reason", required=True)
    p.set_defaults(func=cmd_skip)
    args = parser.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
