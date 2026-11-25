"""Throwaway: apply level-ladder spec §7.2 rules to today's curriculum and write an HTML view."""
import html, json, math, sys
from collections import defaultdict

ROOT = sys.argv[1]
OUT = sys.argv[2]
LV = ["n5", "n4", "n3", "n2", "n1"]


def load(kind, lv):
    with open(f"{ROOT}/{kind}/{lv}.json", encoding="utf-8") as f:
        d = json.load(f)
    return d.get("items") or d.get("passages")


kanji = {k["slug"]: k for lv in LV for k in load("kanji", lv)}
radicals = {r["slug"]: r for lv in LV for r in load("radicals", lv)}
words = []  # frequency order: authored N5, N4, then derived
for lv in LV:
    for w in sorted(load("vocabulary", lv), key=lambda w: int(w["sort_order"])):
        words.append({**w, "authored": lv in ("n5", "n4"), "src": lv})
grammar = []
for lv in ("n5", "n4", "n3"):
    for g in sorted(load("grammar", lv), key=lambda g: g["sort_order"]):
        grammar.append({**g, "tier": "n3" if lv == "n3" else "core", "src": lv})
passages = [p for lv in ("n5", "n4") for p in load("readings", lv)]

edges = json.load(open(f"{ROOT}/dependencies/graph.json"))["edges"]
word_kanji = defaultdict(set)
kanji_rads = defaultdict(set)
for e in edges:
    if e["from_type"] == "kanji" and e["to_type"] == "vocabulary":
        word_kanji[e["to_slug"]].add(e["from_slug"])
    elif e["from_type"] == "radical" and e["to_type"] == "kanji":
        kanji_rads[e["to_slug"]].add(e["from_slug"])

# kanji per level: 18, 24, 28, 30 x17, rest even over 21-60
per = [18, 24, 28] + [30] * 17
rest = len(kanji) - sum(per)
per += [rest // 40 + (1 if i < rest % 40 else 0) for i in range(40)]

# greedy kanji order: authored words first, then derived
first_rank = {}
for i, w in enumerate(words):
    for k in word_kanji[w["slug"]]:
        first_rank.setdefault(k, i)
order, placed = [], set()
for group in (True, False):
    pool = [w for w in words if w["authored"] == group]
    while True:
        complete, appear = defaultdict(int), defaultdict(int)
        for w in pool:
            missing = word_kanji[w["slug"]] - placed
            for k in missing:
                appear[k] += 1
            if len(missing) == 1:
                complete[next(iter(missing))] += 1
        cands = [k for k in appear if k in kanji]
        if not cands:
            break
        best = max(cands, key=lambda k: (complete[k], appear[k], -first_rank.get(k, 1e9), k))
        order.append(best)
        placed.add(best)
order += sorted((k for k in kanji if k not in placed), key=lambda k: first_rank.get(k, 1e9))

klevel, i = {}, 0
for lvl, n in enumerate(per, start=1):
    for k in order[i:i + n]:
        klevel[k] = lvl
    i += n

rlevel = {}
for k in order:
    for r in kanji_rads[k]:
        rlevel.setdefault(r, klevel[k])

authored = [w for w in words if w["authored"]]
derived = [w for w in words if not w["authored"]]
wlevel = {}
for lst, first, span in ((authored, 1, 20), (derived, 21, 40)):
    for j, w in enumerate(lst):
        slot = first + math.floor(j * span / len(lst))
        ks = [klevel[k] for k in word_kanji[w["slug"]] if k in klevel]
        wlevel[w["slug"]] = max([slot] + ks)

glevel = {}
for tier, first, span in (("core", 1, 20), ("n3", 21, 5)):
    lst = [g for g in grammar if g["tier"] == tier]
    for j, g in enumerate(lst):
        glevel[g["slug"]] = first + math.floor(j * span / len(lst))

# today's passages, measured on this ladder (they are all rewritten)
old_plevel = {}
for p in passages:
    lv = [wlevel.get(s, 0) for s in p.get("vocabulary_slugs", [])] + [glevel.get(s, 0) for s in p.get("grammar_slugs", [])]
    old_plevel[p["slug"]] = max(lv or [0])

# new passages: 60 over levels 2-20 (spec: about 3 per level)
new_pass = defaultdict(int)
for j in range(60):
    new_pass[2 + math.floor(j * 19 / 60)] += 1


# JLPT display rows (approximate: today's JLPT files as the reference lists)
def first_level_90(slugs, lvmap):
    vals = sorted(lvmap[s] for s in slugs if s in lvmap)
    return vals[math.ceil(0.9 * len(vals)) - 1]


jl = {}
for lv in ("n5", "n4"):
    jl[lv] = max(
        first_level_90([k["slug"] for k in load("kanji", lv)], klevel),
        first_level_90([w["slug"] for w in load("vocabulary", lv)], wlevel),
        first_level_90([g["slug"] for g in load("grammar", lv)], glevel),
    )


def jlpt_label(n):
    return "N5 range" if n <= jl["n5"] else "N4 range" if n <= jl["n4"] else "Beyond N4"


# ---------- group per level ----------
L = {n: {"rad": [], "kan": [], "voc": [], "gra": []} for n in range(1, 61)}
for r, n in sorted(rlevel.items(), key=lambda x: x[1]):
    L[n]["rad"].append(radicals.get(r, {"slug": r, "primary_form": r, "meaning": r}))

# ---------- what needs new writing or regeneration (spec §7.6) ----------
# fix[slug-key] = (timing, reason); timing "now" = before release, "later" = later phase
def side(path):
    with open(f"{ROOT}/{path}", encoding="utf-8") as f:
        return json.load(f)


kan_mn = side("kanji/mnemonics.json")
rad_mn = side("radicals/mnemonics.json")
voc_ex = side("vocabulary/examples.json")
pool = side("grammar/pool.json")
gra_mn = side("grammar/mnemonics.json")
builds_on_words = {e_["to_slug"] for e_ in edges
                   if e_["from_type"] == "kanji" and e_["to_type"] == "vocabulary" and e_["relationship_type"] == "builds_on"}
kanji_by_char = {k["primary_form"]: s for s, k in kanji.items()}
fix = {}

for s, k in kanji.items():
    if klevel[s] <= 20 and s not in kan_mn and not k.get("meaning_mnemonic"):
        fix[("kan", s)] = ("now", "No mnemonic yet: write a new one before release")
for s, n in rlevel.items():
    r = radicals.get(s, {})
    if n <= 20 and s not in rad_mn and not r.get("mnemonic_text"):
        fix[("rad", s)] = ("now", "No mnemonic yet: write a new one before release")


def above(slugs, lvl):
    return [x for x in slugs if wlevel.get(x, 0) > lvl]


for w in words:
    s, lvl, why = w["slug"], wlevel[w["slug"]], []
    sents = voc_ex.get(s, {}).get("example_sentences", [])
    bad = [x for x in sents if above(x.get("vocabulary_slugs", []), lvl)]
    if bad:
        why.append(f"{len(bad)} of {len(sents)} example sentences use a later word")
    if s in builds_on_words:
        why.append("mnemonic was written without its kanji (now taught first)")
    if why:
        fix[("voc", s)] = ("later", "Regenerate in the later phase: " + "; ".join(why))

for g in grammar:
    s, lvl, why = g["slug"], glevel[g["slug"]], []
    sents = pool.get(s, {}).get("sentences", [])
    bad = [x for x in sents if above(x.get("vocabulary_slugs", []), lvl)]
    if bad:
        why.append(f"{len(bad)} of {len(sents)} pool sentences use a later word")
    if len(sents) - len(bad) < 2:
        why.append(f"only {len(sents) - len(bad)} readable sentences (needs 2)")
    links = above(g.get("vocabulary_slugs", []), lvl)
    if links:
        why.append(f"{len(links)} linked word{'s' if len(links) > 1 else ''} at a later level")
    mn = gra_mn.get(s, {}).get("mnemonic_text", "")
    late = sorted({c for c in mn if c in kanji_by_char and klevel[kanji_by_char[c]] > lvl})
    if late:
        why.append("mnemonic example uses later kanji " + "".join(late))
    if why:
        fix[("gra", s)] = ("now", "Regenerate before release: " + "; ".join(why))


def fixcount(n, c):
    return sum(1 for x in L[n][c] if (c, x["slug"]) in fix)
for k in order:
    L[klevel[k]]["kan"].append(kanji[k])
for w in words:
    L[wlevel[w["slug"]]]["voc"].append(w)
for g in grammar:
    L[glevel[g["slug"]]]["gra"].append(g)

e = html.escape


def chips(items, cls, limit=None):
    def chip(x):
        form = e(x.get("primary_form") or "")
        f = fix.get((cls, x["slug"]))
        mark = f" fix-{f[0]}" if f else ""
        tip = x.get("meaning", "") + (f" — {f[1]}" if f else "")
        return f'<span class="chip {cls}{mark}" title="{e(tip)}">{form}</span>'
    if limit is None or len(items) <= limit:
        return "".join(chip(x) for x in items)
    head = "".join(chip(x) for x in items[:limit])
    tail = "".join(chip(x) for x in items[limit:])
    return f'{head}<details><summary>+{len(items) - limit} more</summary>{tail}</details>'


def words_list(items, limit=24):
    def row(w):
        f = fix.get(("voc", w["slug"]))
        mark = f" fix-{f[0]}" if f else ""
        tip = w.get("meaning", "") + (f" — {f[1]}" if f else "")
        return (f'<span class="word{mark}" title="{e(tip)}"><b>{e(w["primary_form"])}</b>'
                f'<i>{e((w.get("meaning") or "")[:28])}</i></span>')
    head = "".join(row(w) for w in items[:limit])
    if len(items) <= limit:
        return head
    tail = "".join(row(w) for w in items[limit:])
    return f'{head}<details><summary>+{len(items) - limit} more words</summary>{tail}</details>'


def grammar_list(items):
    if not items:
        return '<p class="none">No grammar at this level.</p>'
    def li(g):
        f = fix.get(("gra", g["slug"]))
        mark = f' class="fix-{f[0]}"' if f else ""
        why = f'<small class="why">{e(f[1].split(": ", 1)[1])}</small>' if f else ""
        return (f'<li{mark}><b>{e(g["primary_form"])}</b> <span>{e(g["meaning"])}</span>'
                f'<em class="tag {g["src"]}">{g["src"].upper()} today</em>{why}</li>')
    return "<ol>" + "".join(li(g) for g in items) + "</ol>"


# ---------- WaniKani comparison (private reference; local preview only) ----------
WK = {n: {"rad": [], "kan": [], "voc": []} for n in range(1, 61)}
with open(f"{ROOT}/_build/data/ref_subjects.json", encoding="utf-8") as f:
    for s in json.load(f):
        d_ = s["data"]
        if d_.get("hidden_at") or not 1 <= d_.get("level", 0) <= 60:
            continue
        kind = {"radical": "rad", "kanji": "kan", "vocabulary": "voc", "kana_vocabulary": "voc"}[s["object"]]
        mean = next((m["meaning"] for m in d_.get("meanings", []) if m.get("primary")), d_.get("slug", ""))
        WK[d_["level"]][kind].append({"form": d_.get("characters"), "meaning": mean, "pos": d_.get("lesson_position", 0)})
for n in WK:
    for k in WK[n]:
        WK[n][k].sort(key=lambda x: x["pos"])
our_klevel_by_char = {kanji[s]["primary_form"]: klevel[s] for s in kanji}


def wk_block(n):
    w = WK[n]
    ours = {k["primary_form"] for k in L[n]["kan"]}
    same = sum(1 for k in w["kan"] if k["form"] in ours)

    def kchip(k):
        lv = our_klevel_by_char.get(k["form"])
        where = f"our level {lv}" if lv else "not in our corpus"
        cls = " wk-same" if k["form"] in ours else ""
        return f'<span class="chip wk{cls}" title="{e(k["meaning"])} — {where}">{e(k["form"])}</span>'

    def rchip(r):
        txt = r["form"] or r["meaning"]
        small = "" if r["form"] else " wk-img"
        return f'<span class="chip wk{small}" title="{e(r["meaning"])}">{e(txt)}</span>'

    vocab = "".join(f'<span class="word wk"><b>{e(v["form"] or "")}</b><i>{e(v["meaning"][:28])}</i></span>' for v in w["voc"])
    none = '<span class="none">None</span>'
    return f'''<section class="wkc"><h4>WaniKani level {n} <small>radicals {len(w["rad"])} · kanji {len(w["kan"])} · words {len(w["voc"])} · {same} of {len(w["kan"])} kanji also in our level {n}</small></h4>
<div class="wkrow"><span class="wkl">Kanji</span>{"".join(kchip(k) for k in w["kan"]) or none}</div>
<div class="wkrow"><span class="wkl">Radicals</span>{"".join(rchip(r) for r in w["rad"]) or none}</div>
<details class="wkv"><summary>Show {len(w["voc"])} WaniKani words</summary>{vocab}</details></section>'''


def passage_block(n):
    k = new_pass.get(n, 0)
    if not k:
        return '<p class="none">No passages at this level.</p>' if n <= 20 else '<p class="none">No passages (skeleton level).</p>'
    slots = "".join(f'<div class="pslot fix-now">New passage {i + 1}<small>write before release (Task 9)</small></div>' for i in range(k))
    return f'<div class="pslots">{slots}</div>'


def card(n, open_):
    d = L[n]
    band = "a" if n <= 10 else "b" if n <= 20 else "c"
    counts = [("Radicals", len(d["rad"]), "rad"), ("Kanji", len(d["kan"]), "kan"), ("Words", len(d["voc"]), "voc"),
              ("Grammar", len(d["gra"]), "gra"), ("Passages", new_pass.get(n, 0), "pas")]
    def fx(c):
        if c == "pas":
            return new_pass.get(n, 0)
        return fixcount(n, c)
    def stat_fix(c):
        if not fx(c):
            return ""
        return f'<b class="fixn {"later" if c == "voc" else "now"}">{fx(c)} to fix</b>'
    stat = "".join(f'<div class="stat {c}"><span>{v}</span>{t}{stat_fix(c)}</div>' for t, v, c in counts)

    def h(c, title, extra=""):
        k = fx(c)
        when = "later phase" if c == "voc" else "before release"
        note = f'<small class="fixn {"later" if c == "voc" else "now"}">{k} to {"write" if c in ("kan", "rad", "pas") else "regenerate"}, {when}</small>' if k else ""
        return f"<h4>{title}{extra}{note}</h4>"
    return f'''
<details class="level band-{band}" id="L{n}" {"open" if open_ else ""}>
  <summary><span class="num">Level {n}</span><span class="jl">{jlpt_label(n)}</span><div class="stats">{stat}</div></summary>
  <div class="body"><div class="ours"><h3 class="side">Our ladder (test run)</h3>
    <section class="kan">{h("kan", "Kanji", f'<small>gate: 90% at Guru = {math.ceil(len(d["kan"]) * 0.9)} of {len(d["kan"])}</small>')}{chips(d["kan"], "kan")}</section>
    <section class="rad">{h("rad", "Radicals")}{chips(d["rad"], "rad", 40) or '<p class="none">None</p>'}</section>
    <section class="gra">{h("gra", "Grammar")}{grammar_list(d["gra"])}</section>
    <section class="pas">{h("pas", "Reading passages")}{passage_block(n)}</section>
    <section class="voc">{h("voc", "Words")}{words_list(d["voc"], 10_000 if n <= 20 else 24)}</section></div>
    {wk_block(n)}
  </div>
</details>'''


def overview():
    rows = []
    mx = {c: max(len(L[n][c]) for n in range(1, 61)) for c in ("rad", "kan", "voc", "gra")}
    for n in range(1, 61):
        d = L[n]
        cells = ""
        for c in ("rad", "kan", "voc", "gra"):
            v, k = len(d[c]), fixcount(n, c)
            fx_ = f' <b class="fixn {"later" if c == "voc" else "now"}">{k} to fix</b>' if k else ""
            cells += f'<td class="{c}"><div class="bar" style="width:{v / mx[c] * 100:.0f}%"></div><span>{v}{fx_}</span></td>'
        p = new_pass.get(n, 0)
        cells += f'<td class="pas">{f"<b class={chr(34)}fixn now{chr(34)}>{p} to write</b>" if p else "–"}</td>'
        rows.append(f'<tr class="band-{"a" if n <= 10 else "b" if n <= 20 else "c"}"><th><a href="#L{n}">{n}</a></th><td class="jlc">{jlpt_label(n)}</td>{cells}</tr>')
    return "".join(rows)


tot = lambda c, a, b: sum(len(L[n][c]) for n in range(a, b + 1))
old_hist = defaultdict(int)
for v in old_plevel.values():
    old_hist[v] += 1
old_txt = ", ".join(f"level {k}: {v}" for k, v in sorted(old_hist.items()))

page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Level ladder — what each level contains</title>
<style>
:root{{--bg:#faf8f4;--card:#fff;--ink:#1f1d1a;--mute:#6b665e;--line:#e6e1d8;
--rad:#2f6fb0;--kan:#b0412f;--voc:#6a4fb0;--gra:#2f8a5a;--pas:#b07a1f;--now:#d6336c;--later:#1c7ed6}}
@media (prefers-color-scheme:dark){{:root{{--bg:#16150f;--card:#201f19;--ink:#ece8df;--mute:#a39d92;--line:#35332b;
--rad:#7fb2e8;--kan:#ec8b78;--voc:#b39cf0;--gra:#78cfa0;--pas:#e3b25e;--now:#f783ac;--later:#74c0fc}}}}
*{{box-sizing:border-box}}body{{margin:0;font:15px/1.5 system-ui,-apple-system,"Hiragino Sans",sans-serif;background:var(--bg);color:var(--ink)}}
main{{max-width:1100px;margin:0 auto;padding:28px 20px 80px}}h1{{margin:0 0 4px;font-size:26px}}
.lead{{color:var(--mute);margin:0 0 18px}}.note{{background:var(--card);border:1px solid var(--line);border-left:4px solid var(--pas);padding:12px 16px;border-radius:8px;margin:0 0 22px}}
.note ul{{margin:6px 0 0;padding-left:20px}}
.totals{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin:0 0 26px}}
.tot{{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:12px 14px}}.tot h3{{margin:0 0 6px;font-size:14px}}
.tot div{{display:flex;justify-content:space-between;color:var(--mute)}}.tot b{{color:var(--ink)}}
table{{width:100%;border-collapse:collapse;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden;font-size:13px}}
th,td{{padding:3px 8px;border-bottom:1px solid var(--line);text-align:left}}thead th{{background:var(--bg);font-weight:600}}
td.rad,td.kan,td.voc,td.gra{{position:relative;width:17%}}.bar{{position:absolute;left:0;top:3px;bottom:3px;opacity:.22;border-radius:0 3px 3px 0}}
td span{{position:relative}}td.rad .bar{{background:var(--rad)}}td.kan .bar{{background:var(--kan)}}td.voc .bar{{background:var(--voc)}}td.gra .bar{{background:var(--gra)}}
td.pas{{color:var(--pas);letter-spacing:2px}}.jlc{{color:var(--mute)}}a{{color:inherit}}
tr.band-c{{opacity:.75}}.legend{{display:flex;gap:14px;margin:30px 0 10px;flex-wrap:wrap;font-size:13px;color:var(--mute)}}
.legend i{{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}}
h2{{margin:34px 0 10px;font-size:19px}}
.level{{background:var(--card);border:1px solid var(--line);border-radius:12px;margin:0 0 10px}}
.level>summary{{list-style:none;cursor:pointer;display:flex;align-items:center;gap:14px;padding:12px 16px;flex-wrap:wrap}}
.level>summary::-webkit-details-marker{{display:none}}.num{{font-weight:700;font-size:17px;min-width:76px}}
.jl{{font-size:12px;color:var(--mute);border:1px solid var(--line);border-radius:20px;padding:1px 9px}}
.stats{{display:flex;gap:6px;margin-left:auto}}.stat{{font-size:11px;color:var(--mute);text-align:center;min-width:62px}}
.stat span{{display:block;font-size:17px;font-weight:700}}.stat.rad span{{color:var(--rad)}}.stat.kan span{{color:var(--kan)}}
.stat.voc span{{color:var(--voc)}}.stat.gra span{{color:var(--gra)}}.stat.pas span{{color:var(--pas)}}
.body{{display:grid;grid-template-columns:1fr 1fr;gap:14px 22px;padding:4px 16px 16px;border-top:1px solid var(--line)}}
.body section{{min-width:0}}.body .voc{{grid-column:1/-1}}
.body{{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:0 22px}}
.ours{{display:grid;grid-template-columns:1fr 1fr;gap:4px 22px;align-content:start}}.ours .side{{grid-column:1/-1}}
.side{{margin:12px 0 0;font-size:14px}}
.body .wkc{{border-left:1px dashed var(--line);padding-left:18px;min-width:0}}section.wkc h4{{color:var(--mute)}}
.wkc h4 small{{display:block;margin:2px 0 0}}
.wkrow{{display:flex;flex-wrap:wrap;align-items:center;margin:0 0 4px}}.wkl{{font-size:12px;color:var(--mute);min-width:64px}}
.chip.wk{{background:color-mix(in srgb,var(--mute) 12%,transparent);font-size:17px}}.chip.wk-img{{font-size:12px}}
.chip.wk.wk-same{{background:color-mix(in srgb,var(--kan) 14%,transparent)}}
.word.wk{{background:color-mix(in srgb,var(--mute) 10%,transparent)}}.wkv>summary{{cursor:pointer;color:var(--mute);font-size:12px;padding:4px 0}}
h4{{margin:10px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:.04em}}h4 small{{text-transform:none;letter-spacing:0;color:var(--mute);font-weight:400;margin-left:6px}}
section.rad h4{{color:var(--rad)}}section.kan h4{{color:var(--kan)}}section.voc h4{{color:var(--voc)}}section.gra h4{{color:var(--gra)}}section.pas h4{{color:var(--pas)}}
.chip{{display:inline-block;min-width:30px;text-align:center;padding:2px 6px;margin:0 4px 4px 0;border-radius:6px;font-size:19px;line-height:1.35}}
.chip.kan{{background:color-mix(in srgb,var(--kan) 14%,transparent)}}.chip.rad{{background:color-mix(in srgb,var(--rad) 14%,transparent);font-size:16px}}
.word{{display:inline-flex;flex-direction:column;padding:3px 8px;margin:0 5px 5px 0;border-radius:6px;background:color-mix(in srgb,var(--voc) 10%,transparent)}}
.word b{{font-weight:600;font-size:15px}}.word i{{font-style:normal;font-size:11px;color:var(--mute)}}
details details{{display:inline}}details details>summary{{cursor:pointer;color:var(--mute);font-size:12px;display:inline-block;padding:4px 6px}}
ol{{margin:0;padding-left:22px}}ol li{{margin:0 0 3px}}ol li span{{color:var(--mute)}}
.tag{{font-style:normal;font-size:10px;border-radius:4px;padding:0 5px;margin-left:6px;color:var(--mute);border:1px solid var(--line)}}
.pslots{{display:flex;gap:8px;flex-wrap:wrap}}.pslot{{border:1.5px dashed var(--pas);border-radius:8px;padding:6px 10px;font-size:13px}}
.pslot small{{display:block;color:var(--mute);font-size:11px}}.none{{color:var(--mute);margin:0;font-size:13px}}
.chip.fix-now,.word.fix-now{{outline:2.5px solid var(--now);outline-offset:-1px;background:color-mix(in srgb,var(--now) 22%,transparent)}}
.chip.fix-later,.word.fix-later{{outline:2px dashed var(--later);outline-offset:-1px;background:color-mix(in srgb,var(--later) 16%,transparent)}}
ol li.fix-now{{background:color-mix(in srgb,var(--now) 12%,transparent);border-left:4px solid var(--now);border-radius:4px;padding:2px 6px;margin-left:-10px}}
.why{{display:block;color:var(--now);font-size:12px}}
.pslot.fix-now{{border-color:var(--now);background:color-mix(in srgb,var(--now) 10%,transparent)}}
.fixn{{font-weight:600;font-size:11px;margin-left:6px;text-transform:none;letter-spacing:0}}
.fixn.now{{color:var(--now)}}.fixn.later{{color:var(--later)}}.stat .fixn{{display:block;margin:0}}
.legend .sw-now{{outline:2.5px solid var(--now);background:color-mix(in srgb,var(--now) 22%,transparent)}}
.legend .sw-later{{outline:2px dashed var(--later);background:color-mix(in srgb,var(--later) 16%,transparent)}}
@media (max-width:760px){{.body{{grid-template-columns:1fr}}.totals{{grid-template-columns:1fr}}.stats{{margin-left:0}}}}
</style></head><body><main>
<h1>Level ladder — what each level contains</h1>
<p class="lead">A preview made by applying the rules in the level ladder design (spec §7.2) to today's curriculum files. The ladder is not built yet, so this is a test run, not the final ladder.</p>
<div class="note"><b>How to read this page</b>
<ul>
<li><b>Kanji, radicals, words</b>: placed with the spec rules (greedy kanji order; 18 / 24 / 28 / 30 kanji per level; radical at its first kanji; word at the later of its last kanji and its frequency slot). The real build (Task 2) can give different numbers.</li>
<li><b>Grammar</b>: decided by the spec. The 126 N5+N4 points keep today's teaching order and spread over levels 1–20 (about 6 per level). The 34 N3 points spread over levels 21–25. Nothing after level 25 has grammar.</li>
<li><b>Passages</b>: the spec says 60 new passages, about 3 per level, over levels 2–20. They are not written yet, so each one is an empty slot here. The split of the 3 extra passages is my guess. Level 1 and levels 21–60 have no passages. (For comparison: today's 60 passages, measured on this ladder, would land at {old_txt}.)</li>
<li><b>Highlights</b> (spec §7.6), measured on this test ladder:
<span style="color:var(--now)"><b>solid pink</b></span> = work before release: kanji and radicals in levels 1–20 with no mnemonic (write new), grammar points whose pool sentences, linked words or mnemonic example use a later word or kanji (regenerate; the reason is under each point), and all passages (write new).
<span style="color:var(--later)"><b>dashed blue</b></span> = work in the later phase: words whose example sentences use a later word, or whose mnemonic was written without its kanji.
Levels 21–60 are a skeleton, so a missing mnemonic there is not marked. The grammar mnemonic check looks at kanji only, so it can miss a later kana-only word.</li>
<li><b>WaniKani</b> (grey, at the bottom of each level): the same level number in WaniKani, from the private reference file. Kanji that are also in our level have the kanji colour. Hover a WaniKani kanji to see where our ladder puts it. Radicals that WaniKani shows only as a picture appear as their name. This is for your own comparison only: do not share or commit this page.</li>
<li><b>JLPT label</b>: display only. Measured with today's N5/N4 files as the reference lists: N5 range = levels 1–{jl["n5"]}, N4 range = levels {jl["n5"] + 1}–{jl["n4"]}.</li>
</ul></div>
<div class="totals">
<div class="tot"><h3>Levels 1–10</h3><div>Radicals<b>{tot("rad", 1, 10)}</b></div><div>Kanji<b>{tot("kan", 1, 10)}</b></div><div>Words<b>{tot("voc", 1, 10)}</b></div><div>Grammar<b>{tot("gra", 1, 10)}</b></div><div>Passages<b>{sum(new_pass[n] for n in range(1, 11))}</b></div></div>
<div class="tot"><h3>Levels 11–20</h3><div>Radicals<b>{tot("rad", 11, 20)}</b></div><div>Kanji<b>{tot("kan", 11, 20)}</b></div><div>Words<b>{tot("voc", 11, 20)}</b></div><div>Grammar<b>{tot("gra", 11, 20)}</b></div><div>Passages<b>{sum(new_pass[n] for n in range(11, 21))}</b></div></div>
<div class="tot"><h3>Levels 21–60 (skeleton)</h3><div>Radicals<b>{tot("rad", 21, 60)}</b></div><div>Kanji<b>{tot("kan", 21, 60)}</b></div><div>Words<b>{tot("voc", 21, 60)}</b></div><div>Grammar<b>{tot("gra", 21, 60)}</b></div><div>Passages<b>0</b></div></div>
</div>
<h2>All 60 levels at a glance</h2>
<table><thead><tr><th>Level</th><th>JLPT label</th><th>Radicals</th><th>Kanji</th><th>Words</th><th>Grammar</th><th>Passages</th></tr></thead><tbody>{overview()}</tbody></table>
<div class="legend"><span><i style="background:var(--rad)"></i>Radicals</span><span><i style="background:var(--kan)"></i>Kanji</span><span><i style="background:var(--voc)"></i>Words</span><span><i style="background:var(--gra)"></i>Grammar</span><span><i style="background:var(--pas)"></i>Passages</span><span><i class="sw-now"></i>Write or regenerate before release (solid pink)</span><span><i class="sw-later"></i>Regenerate in the later phase (dashed blue)</span><span>Hover a character to see its meaning and why it needs work. Click a level to open or close it.</span></div>
<h2>Levels 1–10</h2>{"".join(card(n, n <= 3) for n in range(1, 11))}
<h2>Levels 11–20</h2>{"".join(card(n, False) for n in range(11, 21))}
<h2>Levels 21–60 (skeleton: readings and meanings only)</h2>{"".join(card(n, False) for n in range(21, 61))}
</main></body></html>'''

open(OUT, "w", encoding="utf-8").write(page)
print("level1 kanji:", "".join(k["primary_form"] for k in L[1]["kan"]))
for n in (1, 2, 3, 10, 20, 21, 60):
    print(n, {c: len(L[n][c]) for c in L[n]}, new_pass.get(n, 0))
print("totals 1-10", [tot(c, 1, 10) for c in ("rad", "kan", "voc", "gra")], "11-20", [tot(c, 11, 20) for c in ("rad", "kan", "voc", "gra")])
print("jlpt", jl, "unplaced radicals", len(radicals) - len(rlevel), "old passages", dict(old_hist))
