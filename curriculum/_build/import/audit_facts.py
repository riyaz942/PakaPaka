# -*- coding: utf-8 -*-
"""Phase 1 fact audit (docs/content/content-pipeline-plan.md).

Diffs the hand-authored _build datasets against the authoritative
open-licensed sources:
  - kanji readings + meanings vs KANJIDIC2
  - vocab readings + meanings vs JMdict
  - dependencies/graph.json radical->kanji edges vs KRADFILE decomposition

Writes curriculum/_build/reports/fact-audit.md. Findings are graded:
  ERROR   — factually wrong against the source (fix before generating prose)
  WARNING — likely drift; needs a human eye
  INFO    — context only (level stats, untaught components)

Run: .venv/bin/python import/audit_facts.py   (from curriculum/_build)
"""

import json
import os
import re
import sys

IMPORT_DIR = os.path.dirname(os.path.abspath(__file__))
BUILD_DIR = os.path.dirname(IMPORT_DIR)
CURRICULUM_DIR = os.path.dirname(BUILD_DIR)

sys.path.insert(0, IMPORT_DIR)
sys.path.insert(0, BUILD_DIR)

import furigana as furigana_lib  # noqa: E402
import sources  # noqa: E402


def load_json(*parts):
    with open(os.path.join(CURRICULUM_DIR, *parts), encoding="utf-8") as f:
        return json.load(f)


STOPWORDS = {
    "a", "an", "the", "of", "to", "in", "on", "for", "at", "with", "and",
    "or", "one", "be", "is", "do", "esp", "etc", "something", "someone",
}


def normalize_meanings(meaning):
    """'yen / circle' -> ['yen', 'circle']; strips parenthetical qualifiers."""
    parts = [re.sub(r"\([^)]*\)", "", p).strip().lower() for p in meaning.split("/")]
    return [p for p in parts if p]


def _content_words(text):
    words = re.split(r"[^a-z0-9']+", text.lower().replace("-", " "))
    return {w for w in words if w and w not in STOPWORDS}


def _words_match(a, b):
    """Exact match, or shared stem: one is a prefix of the other, or the
    common prefix is >= 4 chars ('anxious'/'anxiety')."""
    if a == b:
        return True
    shorter, longer = sorted((a, b), key=len)
    if len(shorter) >= 3 and longer.startswith(shorter):
        return True
    return len(os.path.commonprefix((a, b))) >= 4


def meaning_matches(ours, theirs):
    """True if any of our meaning parts shares a content word (or a full
    phrase substring) with any source meaning."""
    theirs_lower = [t.lower() for t in theirs]
    their_words = set()
    for t in theirs_lower:
        their_words |= _content_words(t)
    for part in ours:
        for t in theirs_lower:
            if part == t or part in t or t in part:
                return True
        for w in _content_words(part):
            if any(_words_match(w, tw) for tw in their_words):
                return True
    return False


# Reviewed-and-accepted divergences from the sources. Keyed ("<kind>:<slug>",
# meaning) so that any edit to the underlying item re-raises the warning. Each
# entry needs a rationale.
ACCEPTED_MEANINGS = {
    ("kanji:man", "man"): "KANJIDIC2 says 'male'; 'man' is the natural learner gloss",
    ("kanji:return", "return"): "KANJIDIC2 'homecoming'; 'return' matches 帰る usage",
    ("kanji:examine", "examine"): "KANJIDIC2 'verification/testing'; same concept",
    ("kanji:necessary", "necessary"): "KANJIDIC2 'invariably/certain'; 必要 usage gloss",
    ("vocabulary:ee", "yeah"): "JMdict 'yes'; 'yeah' captures the casual register",
    ("vocabulary:itadakimasu", "let's eat (thanks for food)"): "set phrase; JMdict glosses literally",
    ("vocabulary:mendokusai", "troublesome"): "JMdict 'bothersome/tiresome'; synonym",
    ("vocabulary:tokui", "good at / proud"): "JMdict lists 'one's strong point' in later senses",
    ("vocabulary:supootsuman", "athlete"): "JMdict 'sportsman'; same meaning",
    ("vocabulary:zehi", "by all means"): "JMdict 'certainly/without fail'; same meaning",
    ("vocabulary:sono-ue", "moreover"): "JMdict 'in addition; furthermore'; synonym",
}

ACCEPTED_EDGES = {
    ("ichi", "noon"): "一 is visually the top of 午; mnemonic: 'a marker at the top'",
    ("kuchi", "four"): "mnemonic reads the enclosure as a mouth ('a mouth boxing in legs')",
    ("kuchi", "say"): "言 visually contains 口; KRADFILE treats 言 as a primitive",
    ("tsuchi", "life"): "mnemonic 'sprout pushing up from the ground' uses 土 as ground",
    ("inu", "go-back"): "mnemonic teaches traditional form 戾 (dog under door 戸)",
    ("kuruma", "heavy"): "mnemonic 'cart's heavy load' leans on 重's resemblance to 車",
}

GRAMMATICAL_POS = {"助動詞", "助詞"}


def is_derived_form(form, jmdict, tagger):
    """True when the form is an inflected/compound expression whose content
    tokens all lemmatize to JMdict entries (書ける, 勉強する, やってあげる) —
    correctly absent from JMdict as a headword."""
    content = 0
    for t in tagger(form):
        if t.feature.pos1 in GRAMMATICAL_POS:
            continue
        base_forms = [b for b in (t.feature.orthBase, t.feature.lemma) if b]
        if any(b in jmdict for b in base_forms):
            content += 1
            continue
        return False
    return content >= 1


def kunyomi_candidates(kd_kunyomi):
    """KANJIDIC2 kunyomi like 'ひと.つ' / 'ひと-' -> match keys."""
    keys = set()
    for r in kd_kunyomi:
        base = r.replace("-", "")
        keys.add(base.replace(".", ""))       # ひとつ
        keys.add(base.split(".")[0])           # ひと
    return keys


# KRADFILE represents element (hen/tsukuri) forms with specific full-kanji
# glyphs; map taught radical forms to every glyph KRADFILE may use for them.
KRAD_VARIANTS = {
    "亻": ["化"],
    "八": ["八", "ハ", "并"],
    "人": ["人", "化", "个"],
    "氵": ["汁"],
    # 汁 belongs to 氵 alone: both 水 and 氵 claiming it made the owner depend
    # on dataset order, and the N4 pass needs 洗/決/減 to resolve to sanzui.
    "水": ["水"],
    "辶": ["込"],
    "⻌": ["込"],
    "示": ["示", "礼"],
    "礻": ["礼"],
    "⺾": ["艾"],
    "艹": ["艾"],
    "刂": ["刈"],
    # 刂 is not taught; 刀 is the radical the curriculum uses for it (分, 別).
    "刀": ["刀", "刈"],
    "扌": ["扌", "扎"],
    "耂": ["耂", "老"],
    "阝": ["阡", "邦"],
    "𠆢": ["个"],
    # 毋 is how KRADFILE writes the 母 inside 毎; 母 is the taught radical.
    "母": ["母", "毋"],
}


def audit_kanji(levels, kanjidic):
    findings = []
    for level in levels:
        for item in load_json("kanji", f"{level}.json")["items"]:
            slug, char = item["slug"], item["primary_form"]
            kd = kanjidic.get(char)
            if kd is None:
                findings.append(("ERROR", f"`{slug}` ({char}): not found in KANJIDIC2"))
                continue
            ours_on = next(
                (r["reading"] for r in item["readings"] if r["reading_type"] == "onyomi"), None
            )
            ours_kun = next(
                (r["reading"] for r in item["readings"] if r["reading_type"] == "kunyomi"), None
            )
            if ours_on and ours_on not in kd["onyomi"]:
                findings.append((
                    "ERROR",
                    f"`{slug}` ({char}): onyomi `{ours_on}` not in KANJIDIC2 "
                    f"({', '.join(kd['onyomi']) or 'none'})",
                ))
            if ours_kun and ours_kun not in kunyomi_candidates(kd["kunyomi"]):
                findings.append((
                    "ERROR",
                    f"`{slug}` ({char}): kunyomi `{ours_kun}` not in KANJIDIC2 "
                    f"({', '.join(kd['kunyomi']) or 'none'})",
                ))
            if not meaning_matches(normalize_meanings(item["meaning"]), kd["meanings"]):
                accepted = ACCEPTED_MEANINGS.get((f"kanji:{slug}", item["meaning"]))
                if accepted:
                    findings.append((
                        "INFO", f"`{slug}` ({char}): accepted divergence — {accepted}"
                    ))
                else:
                    findings.append((
                        "WARNING",
                        f"`{slug}` ({char}): meaning `{item['meaning']}` has no overlap with "
                        f"KANJIDIC2 ({', '.join(kd['meanings'][:6])})",
                    ))
    return findings


def pick_jmdict_entry(entries, form, reading):
    """Best JMdict entry for a written form: prefer reading match, then common."""
    def score(e):
        return (reading in e["rebs"], e["common"])

    return max(entries, key=score)


def audit_vocab(levels, jmdict):
    findings = []
    tagger = furigana_lib._get_tagger()
    derived = 0
    for level in levels:
        for item in load_json("vocabulary", f"{level}.json")["items"]:
            slug, form = item["slug"], item["primary_form"]
            reading = next(
                (a["answer_text"] for a in item["accepted_answers"]
                 if a["answer_type"] == "reading"),
                form,
            )
            entries = jmdict.get(form)
            if not entries:
                if is_derived_form(form, jmdict, tagger):
                    derived += 1
                else:
                    findings.append((
                        "WARNING", f"`{slug}` ({form}): written form not found in JMdict"
                    ))
                continue
            entry = pick_jmdict_entry(entries, form, reading)
            kana_only = not entry["kebs"]
            if not kana_only and reading not in entry["rebs"]:
                all_rebs = sorted({r for e in entries for r in e["rebs"]})
                findings.append((
                    "ERROR",
                    f"`{slug}` ({form}): reading `{reading}` not in JMdict "
                    f"({', '.join(all_rebs[:8])})",
                ))
            glosses = [g for e in entries for g in e["glosses"]]
            if not meaning_matches(normalize_meanings(item["meaning"]), glosses):
                accepted = ACCEPTED_MEANINGS.get((f"vocabulary:{slug}", item["meaning"]))
                if accepted:
                    findings.append((
                        "INFO", f"`{slug}` ({form}): accepted divergence — {accepted}"
                    ))
                else:
                    findings.append((
                        "WARNING",
                        f"`{slug}` ({form}): meaning `{item['meaning']}` has no overlap with "
                        f"JMdict ({'; '.join(entry['glosses'][:4])})",
                    ))
    if derived:
        findings.append((
            "INFO",
            f"{derived} inflected/compound forms (Xする, potentials, causatives, "
            f"て-form + auxiliary) lemmatize cleanly to JMdict entries; skipped",
        ))
    return findings


def audit_decomposition(levels, kradfile):
    """Cross-check curated radical->kanji edges against KRADFILE."""
    findings = []
    radical_char = {}
    for level in levels:
        for r in load_json("radicals", f"{level}.json")["items"]:
            radical_char[r["slug"]] = r["primary_form"]
    kanji_char = {}
    for level in levels:
        for k in load_json("kanji", f"{level}.json")["items"]:
            kanji_char[k["slug"]] = k["primary_form"]

    taught_chars = {}
    for slug, char in radical_char.items():
        for variant in KRAD_VARIANTS.get(char, [char]):
            taught_chars[variant] = slug

    # Radical -> kanji only: a kanji -> vocabulary edge could otherwise match a
    # radical and a kanji that share its slugs.
    edges = [
        e for e in load_json("dependencies", "graph.json")["edges"]
        if e["relationship_type"] == "builds_on"
        and e["from_type"] == "radical" and e["to_type"] == "kanji"
    ]
    for e in edges:
        rad = radical_char.get(e["from_slug"])
        kan = kanji_char.get(e["to_slug"])
        if rad is None or kan is None:
            continue
        comps = kradfile.get(kan)
        if comps is None:
            findings.append(("INFO", f"{kan} ({e['to_slug']}): not in KRADFILE"))
            continue
        variants = set(KRAD_VARIANTS.get(rad, [rad])) | {rad}
        # A radical that *is* the kanji (一 -> 一) always counts as confirmed.
        if rad != kan and not variants.intersection(comps):
            accepted = ACCEPTED_EDGES.get((e["from_slug"], e["to_slug"]))
            if accepted:
                findings.append((
                    "INFO",
                    f"edge {e['from_slug']} ({rad}) → {e['to_slug']} ({kan}): accepted "
                    f"mnemonic-level decomposition — {accepted}",
                ))
            else:
                findings.append((
                    "WARNING",
                    f"edge {e['from_slug']} ({rad}) → {e['to_slug']} ({kan}) not confirmed by "
                    f"KRADFILE ({' '.join(comps)})",
                ))

    # Candidate missing edges: KRADFILE components that are taught radicals but
    # have no builds_on edge to that kanji.
    edge_set = {(e["from_slug"], e["to_slug"]) for e in edges}
    missing = []
    for kslug, kan in kanji_char.items():
        for comp in kradfile.get(kan, []):
            rslug = taught_chars.get(comp)
            if rslug and (rslug, kslug) not in edge_set and comp != kan:
                missing.append(f"{rslug} ({comp}) → {kslug} ({kan})")
    if missing:
        findings.append((
            "INFO",
            f"{len(missing)} KRADFILE component pairings have no builds_on edge "
            f"(candidate additions): " + "; ".join(missing[:40]) +
            (" …" if len(missing) > 40 else ""),
        ))
    return findings


def main():
    levels = ["n5", "n4"]
    print("Loading KANJIDIC2…")
    kanjidic = sources.load_kanjidic2()
    print("Loading JMdict…")
    jmdict = sources.load_jmdict()
    print("Loading KRADFILE…")
    kradfile = sources.load_kradfile()

    sections = [
        ("Kanji vs KANJIDIC2", audit_kanji(levels, kanjidic)),
        ("Vocabulary vs JMdict", audit_vocab(levels, jmdict)),
        ("Dependency graph vs KRADFILE", audit_decomposition(levels, kradfile)),
    ]

    out_dir = os.path.join(BUILD_DIR, "reports")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, "fact-audit.md")
    lines = [
        "# Fact audit — _build datasets vs open sources",
        "",
        "Generated by `curriculum/_build/import/audit_facts.py` "
        "(sources: KANJIDIC2, JMdict, KRADFILE — EDRDG, CC BY-SA; see NOTICE).",
        "",
    ]
    total = {"ERROR": 0, "WARNING": 0, "INFO": 0}
    for title, findings in sections:
        counts = {"ERROR": 0, "WARNING": 0, "INFO": 0}
        for sev, _ in findings:
            counts[sev] += 1
            total[sev] += 1
        lines.append(f"## {title}")
        lines.append("")
        lines.append(
            f"{counts['ERROR']} error(s), {counts['WARNING']} warning(s), "
            f"{counts['INFO']} info."
        )
        lines.append("")
        for sev, msg in findings:
            lines.append(f"- **{sev}** {msg}")
        lines.append("")
    lines.insert(3, (
        f"**Totals: {total['ERROR']} error(s), {total['WARNING']} warning(s), "
        f"{total['INFO']} info.**\n"
    ))
    with open(out_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
    print(
        f"Wrote {out_path}: {total['ERROR']} error(s), {total['WARNING']} warning(s), "
        f"{total['INFO']} info."
    )


if __name__ == "__main__":
    main()
