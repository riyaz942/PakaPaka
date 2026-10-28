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

## 3. N4 → N3 (27 points) — moved

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

## 4. N4 → N2 or higher (7 points) — moved to N3

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

## 6. Not grammar points (2) — moved to vocabulary

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
- The build accepts grammar at N5, N4 and N3, and passages at N5 and N4 only. A point moved to
  N3 is checked against no seed.

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

### Steps 2–4 — N3 grammar, 34 points N4 → N3, 2 points → vocabulary: done 2026-10-28

N5 has 70 points, N4 has 56, N3 has 34. Curriculum version 49.

**Build (step 2).**

- `levels.py`: grammar may be `n3` (passages stay N5/N4). `generate_content/context.py`
  `LEVEL_ORDER` has `n3`, so the pool check, `grammar_detect` and the content tools see N3
  grammar.
- `generate.py --level n3` writes `vocabulary/n3.json` and `grammar/n3.json` and runs the
  grammar pool check (34/34 pass). It writes no readings.
- `reading_seeds.grammar_coverage_errors` returns no error for a level with no seeds.
- `mnemonic_context.GRAMMAR_MNEMONIC_LEVELS` has `n3`: the 34 moved points keep their
  reviewed mnemonics and origins.
- `validate-schema` and `compile-curriculum` accept `grammar/n3.json` with no change.
- App: no change. N3 grammar shows like N3 vocabulary (decision above).

**Move (step 3).** 34 `grammar:<slug>: n3` lines in `levels.json`, in section 3 + 4 order.

**Vocabulary (step 4, section 6).** Decision (maintainer, 2026-10-28): do both now.

- `kanaru` is removed. かなり was already N4 vocabulary (`kanari`).
- `souiu` is removed and replaced by two new N4 words, `souiu` (そういう) and `kouiu`
  (こういう), in a last block of `n4_vocab.py` so that no `vocab_cutoff` moves. Their
  mnemonics and example sentences come from the subagent lanes and are `draft`.
- Both grammar points lost their lesson, mnemonic, pool and origin entries. Their ids are
  `retired` in `id-registry.json` (1924, 1962); the new words got 12737–12738. Learner
  progress on the two grammar items is not carried over.
- `waribiki-no-setsumei` pulls `kanari` forward and `apuri-no-kenka` pulls `souiu` and
  `kouiu` forward. `toka` and `ka-nanka` no longer say the learner already has そういう.

**Seeds.** Each N4 `grammar_cutoff` is now the number of kept points under its old value;
positions 27–30 all reach 56. N3 points left `required_grammar`. Five seeds require no N4
point: `waribiki-no-setsumei`, `nazo-no-bukatsu`, `kotoshi-koso`,
`densha-ga-tomatta-hi`, `matsuri-no-oshirase`. The last four have new topics. Every kept
N4 point except `node-vs-kara` (a `MANUAL_SLUG`) has one owner seed.

**Passages.** 17 N4 passages changed; slugs and ids are the same.

- 12 light ones were edited by hand.
- 5 heavy ones were written again with subagents
  (`reading-passages-subagent-workflow-automation-prompt.md`).
- Each one passed `validate_draft` and `generate_readings ingest`. Then `n4_readings.py` /
  `n5_readings.py` got the dataset entries. `grammar_detect` at level `n3` finds no N3
  point in any N4 passage. The one hit is `上で` in `saru-ga-nigeta`, which means "on top
  of", not "after doing".
- The naturalness review ran on the 17 passages and on the 5 N5 passages from step 1.
  20 came back natural. 2 were corrected, each on the second attempt: the first
  correction dropped a required point (ながら, どうですか).
- The passage at `kasa-o-nakushita` (N5) changed again for that reason.

**Lessons.** 16 N4 lessons linked an N3 point (19 links), and 4 linked `kanaru` or
`souiu`. One of the 16 was the `souiu` lesson, which is deleted with `kanaru`'s, so 17
lessons are edited.

- Every link is removed.
- "Comes later" lines now say "at N3".
- "You already know X" comparisons now use an earlier point: `baai` uses たら, `nitsuite`
  uses を, `tte` uses について, and `sokode`, `suruto` and `soredemo` use それでも / でも
  in place of ところが. `noda` drops っけ.

**Found by the move.** 5 reviewed N4 vocabulary example sentences used 代わりに, わけ or
以来 (`chokoreeto`, `hanko`, `koufuku`, `seikatsu`, `washoku`). They were edited by hand,
passed the example gate, and kept `reviewed`. They still need a human read.

**Checked.**

- `level_report.py`: 0 links to a later item. The 2 problems left were there before:
  遅刻 in `ta-koto-ga-aru`, and the `conjugation-primer` coverage.
- `validate-schema` and `compile-curriculum` (with `--update-registry`) pass.
- These pass: 213 + 16 build tests, 11/11 passage fixtures, `validate_readings --level n4`
  (30/30), 117 root jest tests and 164 mobile curriculum/reading tests.

**Not done / open.**

- `validate_readings` detects grammar only up to the passage's level. It cannot see an N3
  point in an N4 passage. This run checked with `grammar_detect.detect(text, "n3")` by hand.
- A human read of the changed passages and example sentences (below).
- The lesson text of the 34 N3 points was not changed. Some of it still says "coming soon"
  about N4 points that are now earlier.

#### Changed passage sentences

##### N4 `kotoshi-no-yotei` — 今年の予定
| Before | After |
|---|---|
| 火曜日の朝、起きたのは八時半で、駅まで走って電車に遅れそうになりました。水曜日の晩、電車の中で立ちながら寝そうになって、手からかばんが落ちました。金曜日は母との約束を忘れそうになりました。 | 火曜日の朝、起きたのは八時半で、駅まで走りましたが、電車に遅れてしまいました。水曜日の晩、電車で音楽を聞きながら寝てしまって、手からかばんが落ちました。金曜日は母との約束を忘れていました。 |
| Q: 水曜日の晩、どこで寝そうになりましたか。 | Q: 水曜日の晩、どこで寝てしまいましたか。 |
| Q: 金曜日、誰との約束を忘れそうになりましたか。 | Q: 金曜日、誰との約束を忘れていましたか。 |

##### N4 `ojiisan-no-onaji-hanashi` — おじいさんの長い話
| Before | After |
|---|---|
| 「子供のときは、雪の日も学校まで一時間歩いたものです」と言いました。 | 「子供のときは、雪の日も学校まで一時間歩きました」と言いました。 |

##### N4 `benkyou-suru-aida-ni` — 台所だけきれい
| Before | After |
|---|---|
| でも、座るたびに、何かをしなければなりません。 | でも、座っても、すぐに何かをしなければなりません。 |
| 家族が寝ているうちに、部屋も掃除しました。 | 家族が寝てから、部屋も掃除しました。 |

##### N4 `setsumeisho-doori` — 青い所はありません
| Before | After |
|---|---|
| 最後の言葉は「赤い所の代わりに、青い所を回してください」でした。 | 最後の言葉は「赤い所は回さないで、青い所を回してください」でした。 |

##### N4 `shirabeta-koto` — 川に感謝する日
| Before | After |
|---|---|
| 掃除というより、川に感謝するための行事なのです。今も続けている人は多くありませんが、学校では町の伝統として教えられているそうです。 | 掃除ではなくて、川に感謝するための行事なのです。今も続けている人は多くありませんが、学校では子供たちにこの伝統を教えているそうです。 |

##### N4 `saru-ga-nigeta` — 木の上の猿
| Before | After |
|---|---|
| 教室の窓から見える限り、猿は全然急いでいません。 | 教室の窓から見ると、猿は全然急いでいないようです。 |

##### N4 `jishin-no-kunren` — 地震の練習
| Before | After |
|---|---|
| 階段の前で友達に「二階でしたっけ」と聞きました。 | 階段の前で友達に「音楽室は二階ですか」と聞きました。 |
| 校庭でまた「三階でしたっけ」と聞いて、笑われました。 | 校庭でまた「本当に三階ですか」と聞いて、笑われました。 |
| たとえ夜に一人でいても、机の下に入ってから、家族と決めた場所に行きます。 | 夜に一人でいても、机の下に入ってから、家族と決めた場所に行きます。 |

##### N4 `tabesugita-hi` — 毎年同じ終わり方
| Before | After |
|---|---|
| 父は小さい声で「ズボンがきつくなりつつあります」と言いました。 | 父は小さい声で「ズボンがきつくなってきました」と言いました。 |
| 父と母は一時間も話し合ったあげく、四人で同じだけ払うことになりました。 | 父と母は一時間も話し合って、最後に四人で同じだけ払うことになりました。 |

##### N4 `waribiki-no-setsumei` — 高い割引
| Before | After |
|---|---|
| だから、割引の後でも高いわけです。」 | だから、割引の後でも高いのです。」 |
| 店の中のセーターが暖かくなるわけがありません。 | 店の中のセーターが暖かくなるはずがありません。 |

##### N4 `nazo-no-bukatsu` — テニスをしない仲間
New passage (was 「火曜日のテニス」):

> 私はスポーツが苦手ですが、テニスの仲間に入っています。毎週火曜日の午後、校庭のテニスの場所が予約してあります。でも、みんなは教室でトランプをしています。テニスの場所では白い猫が寝ています。走らなくてもいいので、嬉しいです。しかし、一人だけ真面目な人がいました。その人は毎週三時に教室のドアを開けて、「テニスをしませんか」と聞きました。みんなは「このゲームの後で行きます」と言いました。でも、ゲームはいつも五時まで続きました。二週間に一人、トランプを置いてテニスの場所へ出かけるようになりました。寝る場所がなくなった猫は、教室の椅子で寝ています。今日、教室に残っているのは私と猫だけです。猫とはトランプができないので、困っています。

- Q: テニスの場所はいつ予約してありますか。 → 毎週火曜日の午後
- Q: みんなはどこでトランプをしていますか。 → 教室
- Q: 真面目な人は毎週何時に来ましたか。 → 三時
- Q: テニスの場所では何が寝ていますか。 → 白い猫
- Q: 今日、教室に残っているのは誰ですか。 → 私と猫

##### N4 `apuri-no-kenka` — 雨のアプリ
| Before | After |
|---|---|
| 学校から帰る道で、リクと新しいアプリに関して話し合った。 | 学校から帰る道で、リクと新しいアプリについて話し合った。 |
| 「リクったら、全然聞いていないね」と言ったが、リクも僕も意見を変えなかった。 | 「リク、全然聞いていないね」と言ったが、リクも僕も意見を変えなかった。 |
| Q: リクと何に関して話し合いましたか。 | Q: リクと何について話し合いましたか。 |

##### N4 `goukaku-ka-douka` — 三時の結果
| Before | After |
|---|---|
| 最後に「お菓子を食べない」と書いたので、今のうちにもう一つ食べました。 | 最後に「お菓子を食べない」と書いたので、その前にもう一つ食べました。 |
| 嬉しい反面、とても困っています。 | 嬉しいですが、とても困っています。 |

##### N4 `sanjuppun-no-kaigi` — 十時半までの会議
| Before | After |
|---|---|
| ところが、何度パソコンをつけても、画面には何も出ませんでした。 | でも、何度パソコンをつけても、画面には何も出ませんでした。 |

##### N4 `sotsugyou-shite-kara` — 変わらない人
New passage (was 「卒業してから」):

> 私は大学を卒業してから、三年が経ちました。今も毎週土曜日は、学生のときと同じ駅で電車を降ります。駅を出て右に曲がると、角に小さい喫茶店があります。学生のとき、友達とよくここでコーヒーを飲みながら話しました。でも、最近はみんな仕事が忙しくなって、ほとんど来なくなりました。ハル以外の友達は、もう誰もこの店に来ません。ハルはいつも窓の隣の同じ席に座って、本を読んでいます。先週、ハルから手紙が届きました。台所のテーブルで手紙を開けました。すると、「来月から外国で働くことになりました」と書いてありました。最後に「あなたが全然変わらないので、いつも嬉しかったです」とも書いてありました。びっくりしました。変わらない人はハルだと、いつも思っていたからです。来週の土曜日も、あの喫茶店へ行くつもりです。

- Q: 大学を卒業してから何年が経ちましたか。 → 三年
- Q: 喫茶店はどこにありますか。 → 角
- Q: ハルはいつもどこに座っていますか。 → 窓の隣の同じ席
- Q: ハルは来月から何をしますか。 → 外国で働く
- Q: どこで手紙を開けましたか。 → 台所のテーブル

##### N4 `kotoshi-koso` — 窓の予定
New passage (was 「今年こそ」):

> 今年の一月一日に、私は毎日日本語を勉強することにしました。その夜、大きい紙にきれいに予定を書いて、机の前の窓に貼りました。月曜日は漢字、火曜日はカタカナ、水曜日は新しい言葉です。最初の一週間は、風邪をひいてしまったので、勉強しませんでした。次の一週間は、猫がペンを全部机の下に落としました。二月も、毎週新しい理由がありました。三月になりました。予定の紙は、貼った日に一回読んだだけです。でも、隣の家の男の子が、毎朝自分の部屋の窓から、その紙を読んでいます。昨日、男の子は「今日は水曜日なので、新しい言葉の日ですね」と言いました。隣のお母さんによると、男の子はカタカナがとても上手になったそうです。来年も同じ予定を書くつもりです。隣の男の子が待っているからです。

- Q: 一月一日に、何をすることにしましたか。 → 毎日日本語を勉強すること
- Q: 予定の紙をどこに貼りましたか。 → 机の前の窓
- Q: 最初の一週間は、どうして勉強しませんでしたか。 → 風邪をひいてしまったので
- Q: 予定の紙を何回読みましたか。 → 一回
- Q: 毎朝その紙を読んでいるのは誰ですか。 → 隣の家の男の子

##### N4 `densha-ga-tomatta-hi` — 電車が止まった日
New passage (was 「電車が止まった日」):

> 昨日の夜、私の町に台風が来ました。朝、駅に行くと、電車が止まっていました。そこで、会社まで歩いて行くことにしました。風が強くて、傘はすぐに壊れてしまいました。道には、先月から行かなければならなかった郵便局と図書館と薬局がありました。まず郵便局で、母への手紙を出しました。次に図書館で、本を二冊返しました。最後に薬局で、風邪の薬を買いました。風邪はもう治っていましたが、買いました。薬局の隣には、傘の店がありました。店には黒い傘が百本ぐらい並べてありました。どれも同じ傘でした。それでも、二十分ぐらい立って、一本を選びました。店員さんは「いい傘を選びましたね」と言いました。外に出ると、雨はもう降っていませんでした。新しい傘はまだ一度も濡れていません。

- Q: 電車はどうして止まりましたか。 → 台風
- Q: 郵便局で何を出しましたか。 → 母への手紙
- Q: 図書館で本を何冊返しましたか。 → 二冊
- Q: 傘の店はどこにありましたか。 → 薬局の隣
- Q: 傘を何分ぐらい選びましたか。 → 二十分ぐらい

##### N4 `matsuri-no-oshirase` — 夏の祭りの案内
New passage (was 「市の夏の祭りについて」):

> 市役所からの夏の祭りの案内です。今年の祭りは八月二十日の土曜日に、駅の南の公園で行います。祭りは午後四時に始まって、夜九時に終わります。花火は午後八時から八時半まで、公園の東の空に上がります。ごみ箱は公園の入口と出口と川の近くの三つの場所に置いてあります。公園には車を止める場所がありませんので、祭りに来る方は電車やバスで来てください。小さい子供と来る方は、子供が一人で川へ行かないように注意してください。店を出す方は、お客さんが分かりやすいように、値段を看板に大きく書いておいてください。店のごみは、公園のごみ箱に入れてはいけません。店の人が持ち帰ってください。花火の間に雨や風が強くなった場合は、その時に花火を止めますので、ゆっくり駅まで歩いてください。みんなで楽しい夏の夜を過ごしましょう。

- Q: 祭りは何月何日ですか。 → 八月二十日
- Q: 花火は何時から始まりますか。 → 午後八時
- Q: ごみ箱はいくつの場所に置いてありますか。 → 三つ
- Q: 店のごみは誰が持ち帰りますか。 → 店の人
- Q: 雨や風が強くなったら、花火はどうなりますか。 → 花火を止めます

##### N5 `kasa-o-nakushita` — 傘をなくした
| Before | After |
|---|---|
| 友達に電話して、「駅の傘はどうですか」と聞きました。 | 友達に「駅で探すのはどうですか」と聞きました。 |
| 晩、うちに帰ってから、傘は部屋にありました。 | 晩、うちに帰ってから、部屋で傘を見つけました。 |

