# Radical coverage audit — N5 shipped, N4 skeleton

> **Status: the N4 skeleton findings below have been fixed** (2026-08-10, same
> day). See [What the skeleton pass changed](#what-the-skeleton-pass-changed) at
> the end. The findings are kept as written so the reasoning behind each fix
> stays readable; where a finding turned out to be wrong, it is struck through
> and corrected in place.

Written 2026-08-10, after the N5 radical repair landed (`f3bbd1a`). Scope: the
radical layer end to end — the authored datasets (`_build/n{5,4}_radicals.py`),
the decomposition map that produces `builds_on` edges (`_build/generate_deps.py`),
the shipped JSON, and the compiled `curriculum.db`. Companion to
[content-audit-plan.md](./content-audit-plan.md); numbers reproduced with
KRADFILE via `import/sources.py`.

## Verdict

**N5 is clean and shipping.** The repair is in the database, and after
subtracting the 56 reviewed exceptions there are **zero** un-decided
decomposition gaps. Three small residues below, none user-blocking.

**N4 is a raw skeleton and it is already in the shipped database.** 33 radicals
and 94 kanji compile and ship today with stub mnemonics, no images, no review
metadata, 9 kanji that duplicate N5 kanji outright, 13 radicals that duplicate
N5 radicals, and 42 of 94 kanji showing no "Built from" chips at all. Nothing
is *missing* structurally — the indexes exist — but the content behind them is
placeholder.

## Is the N5 fix actually shipped?

Yes. Recompiled to a scratch path and compared:

| | shipped `curriculum.db` | fresh compile |
| --- | --- | --- |
| `content_hash` | `4a0cd9af…32aba` | `4a0cd9af…32aba` |
| radicals | 123 (90 N5 + 33 N4) | same |
| `builds_on` edges | 210 | same |

`metadata.json` counts match the JSON and the database. The 14 radicals added
in the repair (刀 卜 匕 宀 夕 夂 士 彳 ヨ 气 母 聿 辛 首) are all present, all
carry `review_status: draft`.

## How the graph is actually built (root cause of the original bug)

`generate_deps.py` derives `builds_on` edges from a **hand-maintained**
dictionary, `N5_DECOMPOSITION` / `N4_DECOMPOSITION` — radical slug → list of
kanji suffixes. KRADFILE is never consulted at generation time; it is only used
afterwards, by the audit. So a kanji's component chips are exactly as complete
as someone remembered to type. That is why radicals were missing: the map, not
the data, was the gap.

The map also **drops unknown keys silently** — an unmatched radical slug or an
unmatched kanji suffix is skipped with no error:

```python
if rad_slug not in radical_slugs:
    continue
```

Both maps currently resolve fully (0 dangling keys, checked), so nothing is
being lost right now. But this is the failure mode that hid the original bug,
and it is the kind of silent degradation this project deliberately avoids
elsewhere. **Recommendation:** make `generate_deps.py` raise on an unresolvable
key rather than `continue`.

## N5 findings

### 1. 長 has a radical and a kanji, but no edge between them (bug)

The corpus links radical→kanji whenever the same character is taught as both —
34 such pairs are wired (日, 月, 木, 水, 火, 口, 山 …). Four are not:

| character | radical | kanji | note |
| --- | --- | --- | --- |
| 長 | `nagai` | `n5-nagai` | **N5 gap** — 長 is a taught radical with zero children and a taught kanji with zero parents |
| 口 | `kuchi` | `n4-kuchi-kanji` | N4 duplicate kanji, see below |
| 目 | `me` | `n4-me-kanji` | N4 duplicate kanji |
| 言 | `gonben` | `n4-gen-say` | N4 duplicate kanji |

This class is invisible to the existing check 3: KRADFILE lists 長's only
component as 長 itself, and `decomposition_gaps` skips `comp == kan`. Worth
adding as a standalone assertion — *every radical whose form is also a taught
kanji has a `builds_on` edge to it*.

### 2. Components taught as a kanji can never become chips (structural)

The dependency schema only allows `radical → kanji builds_on`. Four N5 kanji
have a KRADFILE component that **is** taught, but as a kanji, so no edge is
possible:

- 天 (`n5-ten`) ← 大 (`n5-dai-big`) — chip shows 一 only
- 語 (`n5-go-language`) ← 五 (`n5-go`)
- 飲 (`n5-nomu`) ← 食 (`n5-taberu`)
- 道 (`n5-michi`) ← 自 (`n4-ji-self`) — covered pedagogically by 首

N4 adds 8 more pairings (大 → 太/決/送/戻, 方 → 遊/族, 自 → 道, 西 → 要).

`audit_shipped.py` reports these as INFO with the text *"has no corresponding
taught radical (neither radical nor kanji)"* — which is wrong. The function
builds a `kanji_char` map and then never uses it, so a taught kanji is bucketed
as untaught. Either the message should be corrected, or (better) the schema
should permit `kanji → kanji builds_on` so 天 can show 一 + 大.

### 3. ~~Nine dead exception entries~~ — wrong, retracted

~~`DECOMPOSITION_EXCEPTIONS` holds 56 pairs; 9 no longer correspond to any real
KRADFILE gap and can be deleted: `hachigashira` × (`n5-atarashii`,
`n5-hantime`, `n5-kau`, `n5-kin`, `n5-mae`, `n5-michi`, `n5-minami`), `hito` ×
(`n5-hana`, `n5-kin`).~~

**This finding was an artifact of the audit script, not a real gap.** It
resolved a KRADFILE component to a radical by matching `primary_form` exactly,
where `audit_shipped` resolves through `audit_facts.KRAD_VARIANTS` — under which
八 also owns ハ and 并, and 人 also owns 化 and 个. Re-run with the real
resolution, **all 56 entries are live**; none were deleted.

### 4. Cosmetic / non-blocking

- **The 14 new radicals have no mnemonic image.** `mobile/assets/radicals/n5/`
  holds 76 `.webp` files; the 14 repaired radicals fall back to text. Expected
  per the curriculum README, but they are the only N5 radicals in that state.
- **20 N5 radicals build nothing** (丨 丶 巳 弓 忄 扌 曰 灬 牛 石 示 穴 竹 米 糸 肉 虫 衣 阝 長).
  Most are legitimately taught for later levels; 長 is the bug above; 巳
  (`hidari`, "already / snake") appears in no N5 kanji at all and looks like a
  stray.
- **Misleading slugs** carried over from the original authoring: `hidari` = 巳
  (snake, not 左), `mannaka` = 干 (dry, not "middle"), `shita` = 舌 (tongue,
  while `n5-shita` is 下).
- ~~**Lesson order lets a kanji precede its own radical** in 39 same-level edges
  (日 kanji is `sort_order` 15, 日 radical is 33; same for 月, 木, 水, 火, 十, 口).~~
  **Retracted — a non-issue.** `lessonPlanner` buckets candidates *by type* and
  sorts within each bucket, drawing from them on per-round quotas, so a
  radical's `sort_order` is only ever compared against other radicals. The two
  sequences are independent and comparing them across types means nothing.
  (`builds_on` also does not gate lessons at all — `useLessonPlan` gates only on
  `requires`.)
- **Multi-meaning radicals need no `accepted_answers`.** Only 5 radicals carry
  an explicit list, but `deriveMeaningCandidates` splits `"sun / day"` and
  strips `"(left)"` at runtime, so grading is correct. Not a gap.

## N4 findings

### Are the indexes pre-built, or created at generation time?

**Pre-built, and already compiled into the shipped app.** The skeleton is
hand-authored Python (`_build/n4_radicals.py`, `n4_kanji.py`, `n4_vocab.py`,
`n4_grammar.py`, `n4_readings.py`), assembled by `generate.py` into
`curriculum/*/n4.json`, and compiled into `curriculum.db` alongside N5.
The Phase 2 content generators overlay *sidecars* on top of that skeleton:

```
curriculum/radicals/mnemonics/   n5.json   (no n4.json)
curriculum/kanji/mnemonics/      n5.json   (no n4.json)
curriculum/kanji/examples/       n5.json   (no n4.json)
curriculum/vocabulary/mnemonics/ n5.json   (no n4.json)
curriculum/vocabulary/examples/  n5.json   (no n4.json)
curriculum/grammar/lessons/      n5/       (no n4/)
```

Every N4 sidecar is absent, so what ships today is the raw skeleton: the
one-line placeholder mnemonics typed into `n4_radicals.py`, no `_meta`, no
examples, no images. The N4 audit report reflects this — **1,944 errors**, of
which 75 are radical-level (33 mnemonics too short, 29 missing the
`<radical>` tag, 9 missing a required description).

### Decomposition coverage is roughly half-authored

| | N5 | N4 |
| --- | --- | --- |
| radicals | 90 | 33 |
| kanji | 94 → 106 | 94 |
| kanji with **no** radical parent | 7 (all justified primitives except 長) | **42** |
| kanji with exactly one parent | 59 | 43 |
| residual missing edges vs KRADFILE, after exceptions | **0** | **145** |
| decomposition exceptions recorded for the level | 56 | **0** |

The 145 residual gaps split into two kinds:

1. **Radicals already taught in N5, just missing from `N4_DECOMPOSITION`** —
   e.g. 事 is missing 一/口/ヨ, 教 is missing 子, 歌 is missing 一/欠/口, 終 is
   missing 糸/幺/小/夂. This is pure map-entry work, no new content.
2. **Components taught nowhere** — 37 distinct characters over 93 pairings.
   Discounting KRADFILE's search-only primitives (｜ ノ 并 ハ 个 化 込 乞 杰 汁
   扎 廾), the ones that look like genuine radicals worth authoring for N4 are:
   **厶 老 矢 又 冫 癶 斗 弋 里 羽 豕 巴 也 耒 勿 乙 亅**.

Twelve of the 33 N4 radicals currently build nothing at all: 疒 門 冖 戈 頁 鳥
魚 衤 勹 舌 高 小.

### Duplicates against N5

**13 radicals re-teach an N5 form under a new slug:**

| form | N5 | N4 |
| --- | --- | --- |
| 口 | `kuchi` | `kuchihen` |
| 小 | `shou` | `shou-small-n4` |
| 弓 | `yumi` | `yumihen` |
| 月 | `tsuki` | `nikuzuki` |
| 水 | `mizu` | `mizuhen` |
| 示 | `shimesu` | `shime` |
| 立 | `tatsu` | `tatsuhen` |
| 竹 | `takekanmuri` | `takehen` |
| 舌 | `shita` | `shita-tongue` |
| 貝 | `kai-shell` | `kai-shellhen` |
| 辶 | `shinnyou` | `shinnyou-n4` (meaning literally reads "road / advance (reused)") |
| 門 | `mongamae` | `madogamae` |
| 高 | `takai` | `takai-tall` |

Nine of these carry live edges that should point at the N5 radical instead.
Two kanji already show the same character twice in their component chips:
明 (`nikuzuki` + `tsuki`, both 月) and 貸 (`kai-shellhen` + `kai-shell`, both 貝).

**9 kanji are exact duplicates of N5 kanji** — same meaning, same readings, so
a learner would be taught and SRS-tested on the identical card twice:

目 (`n5-me-eye` / `n4-me-kanji`), 口, 手, 力, 言, 電, 車, 駅, 道.

The corpus-hygiene check (check 8) does not catch either class because it only
looks for duplicate *slugs*, not duplicate `primary_form` across levels.

Some N4 slugs are also mis-named: `madogamae` is 鬥 not 門, `kanmuri` is 冖
(should be `wakanmuri`), `koro` is 頁 (should be `oogai`), `shikabane-kan` is 戸
(戸 is `tobira`; 尸 is `shikabane`).

## What the skeleton pass changed

Landed 2026-08-10, before any N4 content generation. Curriculum version bumped
to `1.6.0-n4-skeleton-decomposition`; `curriculum.db` recompiled.

### Skeleton (`_build/n4_radicals.py`, `_build/n4_kanji.py`)

- **13 duplicate radicals removed** — every N4 entry whose `form` was already
  taught at N5 (口 小 弓 月 水 示 立 竹 舌 貝 辶 門 高). Their edges now key off the
  N5 slug, so 明 shows 日 + 月 instead of 月 + 月, and 貸 shows 弋 + 貝 + 亻
  instead of 貝 twice. 衤 and 心 stay: those are distinct glyphs from N5's 衣/忄,
  so the learner sees a different shape.
- **9 duplicate kanji removed** (目 口 手 力 言 電 車 駅 道). Vocabulary is
  unaffected — `requires` edges are derived by scanning the character across
  every taught level, so 電車 still resolves, now to the single N5 kanji.
- **12 radicals authored** for components that were taught nowhere:
  厶 耂 矢 又 冫 斗 弋 里 癶 羽 豕 也.
- **3 slugs corrected**: `madogamae`→ removed (it was 門, and 鬥 is the real
  madogamae), `kanmuri`→`wakanmuri`, `koro`→`oogai`, `shikabane-kan`→`tobira`.

N4 goes 33 radicals → 32 and 94 kanji → 85. Corpus totals: 122 radicals,
191 kanji, 1,488 dependency edges (was 1,413).

### Decomposition (`_build/generate_deps.py`)

`N4_DECOMPOSITION` was rebuilt from KRADFILE rather than extended by hand. Every
taught component of every N4 kanji is now either an edge or a documented
exception, authored per-kanji and machine-inverted into the radical-keyed form
the generator wants.

| | before | after |
| --- | --- | --- |
| `builds_on` edges | 210 | **324** |
| N4 kanji with no component chips | 42 of 94 | **3 of 85** (方, 飛, 比 — whole-shape pictographs) |
| N5 kanji with no component chips | 7 of 106 | **6** (長 fixed) |
| N4 check-3 warnings | 183 | **0** |
| decomposition exceptions | 56 N5 / 0 N4 | 59 N5 / **62 N4** |
| radical/kanji forms taught twice | 13 + 9 | **0** |

The N5 長 edge is in, and its mnemonic now tags the component so the mnemonic
gate passes.

Audit totals after the pass — **N5: 0 errors, 0 warnings, 19 info** (was 0/0/21;
the 長 error the new edge introduced is fixed). **N4: 1,915 errors, 78 warnings,
24 info** (was 1,944/261/40). Every N4 error is in the "re-run of existing draft
gates" section — the placeholder one-line mnemonics. All ten deterministic
checks are clean at both levels except pre-existing passage-grammar and
word-span warnings, which have nothing to do with radicals.

### Guardrails, so this cannot regress silently

- `generate_deps.py` **raises** on a decomposition key that resolves to no
  taught radical or kanji, instead of `continue`-ing past it. It caught a dead
  `sanzui: []` key on the first run.
- New corpus-hygiene **errors** on a radical or kanji `primary_form` taught at
  more than one level — the check that would have caught all 22 duplicates.
  Check 8 only compared slugs within a single file before.
- New warning when a character is taught as both a radical and a kanji with no
  edge between them. Check 3 structurally cannot see this (KRADFILE lists 長's
  only component as 長 itself, and `comp == kan` is skipped), which is exactly
  how 長 shipped broken.
- `audit_facts.KRAD_VARIANTS` gained 刀→刈, 扌→扎, 耂→老, and 汁 now belongs to
  氵 alone (both 水 and 氵 claimed it, so the owner depended on dataset order).
  These aliases surfaced three genuine N5 diffs that had been invisible: 帰 and
  前 against 刀, and 黒 against 里. All three are recorded as exceptions — 里 is
  an N4 radical so 黒 cannot depend on it, and rewriting reviewed N5 mnemonics
  is out of scope for a skeleton pass.
- Check 3 no longer reports a component that *is* taught, as a kanji, under the
  message "taught nowhere". It gets its own line explaining that the graph
  carries only radical → kanji `builds_on`, so no edge is expressible.

### Deliberately not done

- **N4 mnemonics, examples and images.** Every N4 sidecar is still absent, so
  the 1,915 remaining N4 errors are the placeholder one-liners in the skeleton.
  That is Phase 2's job and it is now unblocked — the graph is settled, which is
  what makes the mnemonic-tag gates bind.
- **The 14 repaired N5 radicals still have no `.webp` art**; they fall back to
  mnemonic text.
- **The misleading N5 slugs** (`hidari` = 巳, `mannaka` = 干, `shita` = 舌) are
  untouched — they are shipped, imaged, and referenced by mnemonic sidecars, so
  renaming them is a separate change with real churn.
- **巳 (`hidari`) is still an orphan**, along with 5 other N4 radicals (疒 頁 鳥
  魚 衤 犬) that build nothing in the current kanji set. N5 has 11 of these; they
  are forward-looking, not bugs.
- **Kanji-as-component is still unexpressible** (天 cannot chip 大). Fixing it
  means allowing `kanji → kanji builds_on` in the schema and the app's
  `getComponentParentsForItem`, which is a product change, not a data fix.

## Suggested order of work

1. ~~**N5, small:** add the 長 radical→kanji edge; drop the 9 dead exceptions;
   author the 14 missing radical images; decide on 巳.~~ — **done except the
   images**; the 9 "dead" exceptions were a false finding (see above), and 巳
   was left as a forward-looking orphan.
2. ~~**Guardrails:** make `generate_deps.py` fail loudly on unresolvable keys;
   add the "same-character radical/kanji must be linked" assertion and a
   duplicate-`primary_form`-across-levels check to `audit_shipped.py`; fix
   check 3's "neither radical nor kanji" mis-classification.~~ — **done**, all
   four.
3. ~~**N4 skeleton, before content generation:** de-duplicate the 13 radicals and
   9 kanji against N5, then fill `N4_DECOMPOSITION` — first the 1st-kind gaps
   (existing radicals), then author the ~17 new radicals for the 2nd kind, then
   record N4 exceptions for what remains.~~ — **done**; 12 new radicals were
   needed rather than ~17, once the KRADFILE search-only primitives that alias
   onto an already-taught radical (刈→刀, 扎→扌, 汁→氵, 込→辶, 礼→示) were
   mapped instead of authored.
4. **Then** run the Phase 2 sidecar generators for N4. ← **next**. Getting the
   graph right first mattered: per the audit plan, adding edges is what makes
   the mnemonic-tag checks bind, so decomposition had to be settled *before*
   mnemonics are generated.
