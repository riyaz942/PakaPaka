# Grammar JLPT level audit (N5 / N4)

Started 2026-10-28. Status lives in [working-history.md](../working-history.md).

## Why

A Gemini study chat said four N4 points (代わりに, うちに, たびに, もの) are N3. An audit of
`curriculum/grammar/n5.json` (75 points) and `curriculum/grammar/n4.json` (87 points) found that
the problem is larger: N4 holds about 34 points that the common lists put at N3 or higher.

There is no official JLPT grammar list since 2010. The levels below follow the common lists
(JLPT Sensei, Bunpro, Shin Kanzen Master). Those lists do not agree on every point, so the
**borderline** tables keep the point where it is.

## Decision (maintainer, 2026-10-28)

- First release ships N5 + N4 grammar only.
- An N4 point that sits in N5: move it to N4. It still ships.
- An N3+ point that sits in N4: move it to N3. It does not ship in the first release; it is
  kept for later.
- Borderline points stay at their current level.
- Work on `main` (no branch).

`#` is the point's `sort_order` in its source file before any move.

## 1. N5 → N4 (5 points) — move now

| # | Slug | Point | Meaning |
|---|---|---|---|
| 56 | `kamoshirenai` | かもしれない | might / maybe |
| 59 | `sugiru` | すぎる | too much |
| 71 | `nagara` | ながら | while doing |
| 73 | `tame-ni` | ため(に) | in order to (purpose) |
| 75 | `moraru-ageru-kureru` | あげる・くれる・もらう | giving and receiving |

## 2. N5 borderline (10 points) — stay in N5

| # | Slug | Point | Meaning |
|---|---|---|---|
| 37 | `nakutemo-ii` | なくてもいい | don't have to |
| 39 | `ta-koto-ga-aru` | たことがある | have done before |
| 40 | `tari-tari` | たり〜たり | doing things like |
| 47 | `dictionary-koto-ga-dekiru` | ことができる | can / be able to |
| 55 | `darou` | だろう | probably (plain) |
| 57 | `to-omou` | と思う | I think that |
| 58 | `to-iu` | という | called / named |
| 60 | `hou-ga-ii` | ほうがいい | had better |
| 70 | `demo-suggestion` | でも (suggestion) | or something |
| 72 | `janai-desu-ka` | じゃないですか | isn't it? |

All other N5 points are N5.

## 3. N4 → N3 (27 points) — move later

| # | Slug | Point | Meaning |
|---|---|---|---|
| 25 | `souni-naru` | そうになる | almost / on the verge of |
| 30 | `mono` | もの | used to (nostalgic) / emotional reason |
| 34 | `uchi-ni` | うちに | while (before it's too late) |
| 35 | `tabi-ni` | たびに | every time |
| 39 | `kawarini` | 代わりに | instead of |
| 40 | `kawari-ni-formal` | というより | rather than say |
| 41 | `toshite` | として | as (in the role of) |
| 45 | `kagiri` | 限り | as far as / as long as |
| 46 | `tatoe-temo` | たとえ〜ても | even if |
| 47 | `kke` | っけ | wasn't it? (recall) |
| 52 | `wake` | わけ | reason / makes sense that |
| 53 | `wakeganai` | わけがない | there's no way that |
| 59 | `ippou-de` | 一方で | on the other hand |
| 60 | `nitotte` | にとって | for / from the view of |
| 61 | `nikanshite` | に関して | regarding |
| 64 | `tteba` | ったら・ってば | emphatic address |
| 68 | `kke2` | 反面 | while at the same time |
| 69 | `tokoroga` | ところが | however (unexpected) |
| 75 | `igo-formal` | 以来 | ever since |
| 76 | `hantai-ni` | 反対に | on the contrary |
| 77 | `koso` | こそ | precisely (emphasis) |
| 78 | `sae` | さえ | even |
| 79 | `saeba` | さえ〜ば | if only |
| 82 | `yoruni` | によって | by / depending on |
| 83 | `tsuide-ni` | ついでに | while I'm at it |
| 85 | `saichuu-ni` | 最中に | right in the middle of |
| 87 | `ni-taishite` | に対して | towards / in contrast to |

## 4. N4 → N2 or higher (7 points) — move later

These go to N3 for now (no N2 grammar is planned). The note is for later.

| # | Slug | Point | Usual level |
|---|---|---|---|
| 50 | `tsutsu-aru` | つつある | N2 |
| 51 | `ageku` | あげく | N2 |
| 58 | `kagirazu` | に限らず | N2 |
| 80 | `nomi` | のみ | N2 / N1 |
| 81 | `hoka-nai` | ほかない | N2 |
| 84 | `ue-de` | 上で | N2 |
| 86 | `oyobi` | および | N2 |

## 5. N4 borderline (8 points) — stay in N4

| # | Slug | Point | Meaning |
|---|---|---|---|
| 33 | `aida` | 間・間に | while / during |
| 42 | `nitsuite` | について | about |
| 43 | `niyoruto` | によると | according to |
| 44 | `tame` | ため (cause) | because of |
| 55 | `hodo` | ほど | to the extent of |
| 57 | `dake-de-naku` | だけでなく | not only… but also |
| 63 | `tte` | って | casual quotation |
| 71 | `sokode` | そこで | so / therefore |

## 6. Not grammar points (2) — move to vocabulary later

| # | Slug | Point | Why |
|---|---|---|---|
| 54 | `kanaru` | かなり | an adverb (quite / fairly) |
| 62 | `souiu` | そういう・こういう | demonstrative words |

All other N4 points are N4.

## How a move works

- `curriculum/_build/levels.json` sets the level of any item: `"grammar:<slug>": "n4"`.
- Then regenerate (see `curriculum/README.md` § Regenerating) and read
  `curriculum/_build/reports/level-report.md`.
- A point that moves one level later is taught **first** in its new level. So every
  `grammar_cutoff` of that level's reading seeds
  (`curriculum/_build/generate_content/reading_seeds.py`) shifts by the number of moved points.
- Every grammar point must be the `required_grammar` of exactly one seed in its level
  (`grammar_coverage_errors`).
- Today the build accepts grammar and passages only at N5 or N4. Section 3, 4 and 6 moves need
  build work first (see step 2 below).

## Steps

### Step 1 — N5 → N4 (section 1): done 2026-10-28

N5 now has 70 points, N4 has 92. Curriculum version 47.

- `curriculum/_build/levels.json`: 5 `grammar:<slug>: n4` lines.
- `reading_seeds.py`:
  - N4: every `grammar_cutoff` +5. Each moved point is now required by one N4 passage that
    already used it: `moraru-ageru-kureru` → `souji-no-nikki`, `nagara` → `kotoshi-no-yotei`,
    `tame-ni` → `benkyou-suru-aida-ni`, `kamoshirenai` → `karita-nabe`, `sugiru` →
    `tabesugita-hi`.
  - N5: cutoffs remapped to the shorter list (56→55, 58→57, 61→59, 63→61, 65→63, 67→65,
    69→67, 71→68, 73→69, 74→70); moved points taken out of `required_grammar`.
- 5 N5 passages rewritten (shipped source `curriculum/_build/n5_readings.py`, generated
  dataset `generate_content/passages/n5.json`; each one passed `validate_draft` and was
  imported with `generate_readings ingest`):

  | Passage | Before | After |
  |---|---|---|
  | `kariru-hito-kasu-hito` | 来週はリクが傘を忘れるかもしれません。 | 来週もリクは傘を忘れるだろうと思います。 |
  | `kasa-o-nakushita` | 「駅員が持って行ったかもしれません」 / 先週、置いたのかもしれません。 | 「駅員が持って行ったでしょう」 / 先週、置いたのでしょう。 (question 3 also) |
  | `shiken-no-mae-no-yoru` | 六時間ぐらい勉強しましたが、それは長すぎました。 | 六時間勉強しましたが、それはとても長かったです。 (question 2 also; ぐらい was already past this seed's cutoff) |
  | `fooku-ga-yonjuu` | 中の物を机に並べながら、 | 中の物を机に並べているとき、 |
  | `saigo-no-hi` | 友達から夏の写真とお菓子をもらいました。嬉しかったので、かばんの中の本をあげました。 / 毎朝みんなのために椅子を並べて、花に水をあげていました。 | 友達は夏の写真とお菓子を持って来ました。嬉しかったので、一緒にお菓子を食べました。 / 毎朝みんなの椅子を並べて、窓を開けていました。 (question 2 also) |

- 9 N5 lessons (`curriculum/grammar/lessons/`): links to moved points removed. Where the
  text said "you already know X" (X now N4), the comparison now uses an earlier N5 point:
  `hou-ga-ii` and `to-omou` → だろう, `shika-nai` → だけ, `zenzen-nai` drops the すぎる
  half. Where it said "soon you will learn X", it now says "at N4" (`ato-de`, `deshou`,
  `dictionary-koto-ga-dekiru`).
- Checked: `level_report.py` has 0 links to a later item. `validate-schema`,
  `compile-curriculum`, 213 + 16 build tests, 11/11 passage fixtures, script tests and the
  curriculum-reading app tests pass. All N4 passages pass `validate_readings`.
- Not checked: the model naturalness review (`naturalness_check.py`) was not run on the 5
  rewritten passages. A human read is still needed.

**Problems found that were there before step 1 (not fixed):**

- 8 N5 passages fail `validate_readings` when each is checked alone (`dare-no-heya`,
  `dekiru-hito`, `hajimete-no-jikoshoukai`, `mainichi-onaji`, `nagai-kotoba`,
  `nanimo-nai-nichiyoubi`, `watashi-no-machi`, `zenbu-sukoshi-itai`): each uses a point past
  its seed's `grammar_cutoff`. A full `--level n5` run reports a different set of 8, so the
  checker's result depends on run order.
- `conjugation-primer` has no owner seed (N5 coverage 69/70).
- `deshou` lesson says "You've already got によると" — によると is N4.
- `level-report.md` in git was out of date before this change.

### Step 2 — N3 grammar support (plan, not started)

Today `levels.py` allows grammar and passages only at N5/N4, and `generate.py --level n3`
writes vocabulary only.

1. **Build.** Allow `grammar` at `n3` in `levels.py`. Make `generate.py --level n3` write
   `grammar/n3.json` (and run the grammar pool check for it). Teach `reading_seeds` that a
   level with no seeds has no coverage rule. Check `validate-schema` and
   `compile-curriculum` accept a grammar file at N3.
2. **App.** N3 vocabulary and kanji already ship (most without mnemonics). **Decision
   (2026-10-28): show N3 grammar the same way** when a learner reaches N3. No hide flag.
3. **N4 passages — the big cost.** 17 of the 30 N4 passages use at least one of the 34
   points:

   | Pos | Passage | N3+ points it uses |
   |---|---|---|
   | 11 | `kotoshi-no-yotei` | そうになる |
   | 13 | `ojiisan-no-onaji-hanashi` | もの |
   | 14 | `benkyou-suru-aida-ni` | たびに, うちに |
   | 15 | `setsumeisho-doori` | 代わりに |
   | 16 | `shirabeta-koto` | というより, として |
   | 17 | `saru-ga-nigeta` | 限り |
   | 18 | `jishin-no-kunren` | っけ, たとえ〜ても |
   | 20 | `tabesugita-hi` | あげく, つつある |
   | 21 | `waribiki-no-setsumei` | わけ, わけがない |
   | 23 | `nazo-no-bukatsu` | 一方で, に限らず, にとって |
   | 24 | `apuri-no-kenka` | に関して, ったら・ってば |
   | 25 | `goukaku-ka-douka` | 反面, うちに |
   | 26 | `sanjuppun-no-kaigi` | ところが |
   | 27 | `sotsugyou-shite-kara` | 反対に, 以来, にとって |
   | 28 | `kotoshi-koso` | こそ, のみ, さえ, さえ〜ば, ところが |
   | 29 | `densha-ga-tomatta-hi` | ほかない, ついでに, 上で, によって |
   | 30 | `matsuri-no-oshirase` | に対して, および, 最中に |

   Light ones (1 point) can be edited like step 1. Heavy ones (`kotoshi-koso`,
   `densha-ga-tomatta-hi`, `matsuri-no-oshirase`, `nazo-no-bukatsu`,
   `sotsugyou-shite-kara`) are built around the points and need a new passage. Every N4
   point that a rewritten passage owned needs a new owner, and the N4 cutoffs need a remap.
   **Decision (2026-10-28):** new passages are generated with subagents
   (`docs/workflows/reading-passages-subagent-workflow-automation-prompt.md`).
4. **N4 lessons.** 16 N4 lessons that stay at N4 link an N3 point in
   `related_grammar_slugs`, and their text may compare with it. Same fix as step 1.
   No N4 example or pool sentence uses an N3 point.

### Step 3 — N4 → N3 (sections 3 and 4, 34 points)

After step 2: 34 `levels.json` lines, then the passage and lesson fixes above.

### Step 4 — vocabulary (section 6)

`kanaru` and `souiu` become vocabulary items. After step 2.
