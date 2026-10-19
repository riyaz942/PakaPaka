# Working history — plan status

Every plan and story doc in this repo, with one status each. Details stay in the linked
plan; **only leftovers are listed here**, one line per point.

Last verified against the codebase: **2026-09-02**

- **Done** — plan acceptance met, or the doc is a closed investigation / reference.
- **Partial** — meaningful work shipped, leftovers listed in [What's left](#whats-left).
- **Not started** — no product work yet, by intent or because it is queued.

## At a glance

| Area | Done | Partial | Not started |
| --- | ---: | ---: | ---: |
| Product plans (`docs/feedback/`) | 14 | 4 | 0 |
| Content plans (`docs/content/`) | 2 | 5 | 0 |
| Design & platform (`docs/design/`) | 4 | 0 | 4 |
| BMAD stories (`_bmad-output/`) | 52 | 1 | 3 |

---

## Product plans — `docs/feedback/`

| Plan | Status |
| --- | --- |
| [01 — SRS scheduling correctness](./feedback/01-srs-scheduling-correctness.md) | Done |
| [02 — Review session mechanics](./feedback/02-review-session-mechanics.md) | Done |
| [03 — Answer validation & feedback](./feedback/03-answer-validation-and-feedback.md) | Done |
| [04 — Lesson pacing & grammar coverage](./feedback/04-lesson-pacing-and-grammar-coverage.md) | Done |
| [05 — Session UX polish](./feedback/05-session-ux-polish.md) | Done — §5.2 cancelled by PRD decision R2 |
| [06 — UI navigation & polish](./feedback/06-ui-navigation-and-polish.md) | Done |
| [07 — Grammar review overview](./archive/07-grammar-review-overview.md) | Index for 07–10. Review side replaced 2026-10-13 by Grammar Read + Build SRS (row below) |
| [07 — Grammar cloze contract](./archive/07-grammar-cloze-contract.md) | Done; replaced 2026-10-13 by Grammar Read + Build SRS (row below) — cloze cards removed |
| [08 — Grammar stage ladder](./archive/08-grammar-stage-ladder.md) | Done; replaced 2026-10-13 by Grammar Read + Build SRS (row below) — MC → type-in ladder removed |
| [09 — Cloze variants & families](./archive/09-grammar-cloze-curriculum.md) | **Superseded 2026-10-13** by Grammar Read + Build SRS (row below): cloze variants no longer ship (curriculum v33), and `check_cloze.py` / `promote_cloze.py` are deleted. `family` is still used, for the `other_grammar` Build alternates. Earlier status: **Done for N5 + N4 (2026-09-21)** — every shipping point has a `family` and ≥4 authored cloze variants: N5 74 points / 372 variants, N4 97 points / 512 variants, 884 rows in `curriculum.db`. N4 was closed by promoting the cloze candidates the grammar-lesson lane had been parking in `generate_content/drafts/n4/` since Plan 04 — `generate_content/promote_cloze.py` gates each candidate with `check_cloze`'s rules and writes only survivors into `_build/n4_grammar.py`. 461 of 523 drafts passed untouched; 10 points were hand-repaired because the drafted blank swallowed the conjugated stem (`降ったら` for `たら`), which `accepted_forms` grading would have marked a correct learner wrong. `generate.py` now derives `jp_cloze_furigana` for every variant (883/884; the two misses are `→`-notation drills, where the app falls back to the plain prompt). N3+ is vocabulary-only and has no grammar points to cover. |
| [10 — Grammar hints & near-miss](./archive/10-grammar-hints-and-nearmiss.md) | Done; replaced 2026-10-13 by Grammar Read + Build SRS (row below) — hint ladder and near-miss grading removed |
| [11 — Lesson content order & navigation](./feedback/11-lesson-content-order-navigation-and-grammar-furigana.md) | Done |
| [12 — Android playtest round 2](./feedback/12-android-playtest-round-2.md) | Done |
| [13 — Vacation mode](./feedback/13-vacation-mode.md) | Done |
| [14 — Conjugated-form linking & furigana gesture](./feedback/14-conjugated-form-linking-and-furigana-gesture.md) | Done |
| [15 — ChatBubble word linking & furigana toggle](./feedback/15-chatbubble-word-linking-and-furigana-toggle.md) | Done |
| [Grammar Read + Build SRS (spec, 2026-10-13)](./superpowers/specs/2026-10-13-grammar-read-build-srs-design.md) | Partial — Plans 1–2 done 2026-10-13: every N5/N4 grammar point has a passing pool (curriculum/grammar/pool.json, report curriculum/_build/reports/grammar-pool-final.md); generate.py gates on it. Plan 3 (app, [plan](./superpowers/plans/2026-10-14-grammar-read-build-app.md)) code done 2026-10-13: Read + Build cards replace the cloze / MC / hint review; cloze variants no longer ship (curriculum v33). Simulator check not yet run |
| [Grammar content — linked words (spec, 2026-10-17)](./superpowers/specs/2026-10-17-grammar-linked-words-design.md) | Partial — code and content done 2026-10-17: the build wraps taught vocabulary words in grammar lessons as `{{slug\|inflection\|text}}` markers and adds `word_spans` to grammar `uses`; the compile checks markers and rewrites slugs to item ids; the app renders linked words with per-word furigana. N5 + N4 rebuilt and compiled into the seed (curriculum v34): 161/161 points carry markers (6,320 total; none inside the lesson's own grammar form), 40 of 41 `uses` carry spans. In-app check pending |
| [Grammar content — mnemonics (spec, 2026-10-17)](./superpowers/specs/2026-10-17-grammar-mnemonics-design.md) | Partial — pipeline, gate, app, Studio and content done 2026-10-18: all 161 N5 + N4 grammar points carry a story mnemonic (sound-alike hook plus a Japanese example), all reviewed by the maintainer (`curriculum/grammar/mnemonics.json`, `review_status: reviewed`); the compile warns about no unreviewed grammar. §6a: the example links its taught words (`{{slug\|inflection\|text}}` markers, resolved at compile; tap opens the word, long-press toggles its furigana). Seed rebuilt (curriculum v36). Tests green; in-app check not run |

## Content plans — `docs/content/`

| Plan | Status |
| --- | --- |
| [Content quality pipeline](./content/content-pipeline-plan.md) | **Partial** — leftovers in [What's left](#content-quality-pipeline) |
| [Content audit plan](./content/content-audit-plan.md) | **Partial** |
| [Furigana support plan](./content/furigana-support-plan.md) | **Partial** |
| [Radical mnemonic images](./content/radical-mnemonic-images.md) | **Partial** |
| [Reading mnemonics continue the meaning story (spec, 2026-10-17)](./superpowers/specs/2026-10-17-reading-mnemonic-meaning-link-design.md) | **Done 2026-10-17** — prompt rule in `kanji-mnemonic.md` / `vocab-mnemonic.md` (`PROMPT_VERSION` unchanged); triage of 737 N5+N4 candidates (325 kanji, 412 vocab story readings) marked 180 kanji + 304 vocab; 484 rewritten via `reading_link.py`, now `draft` awaiting Studio review; 0 still failing. Meaning mnemonics byte-identical (`reading_link verify`) |
| [Phase 4 — reading passage tooling](./content/phase-4-reading-passage-tooling.md) | **Partial** |
| [Reading passage expansion — N5/N4 to 30 each](./content/reading-passage-expansion-plan.md) | **Done — 60 passages shipped in curriculum v19 (2026-09-26)**; steps 1–3 done, step 4's seeds authored (2026-09-11) — 19 passages → 60; 100% grammar coverage per level as a build invariant; `grammar_slugs` is tokenizer-derived instead of model-declared. Step 1 shipped `generate_content/grammar_detect.py`: 29 POS rules over the reviewed `accepted_forms`, calibrated at **98.8% recall** (N5 99.2%, N4 97.8%) against the 19 shipped passages — `--selftest` pins 32 discriminations, `--calibrate` measures recall. Step 2 put it to work: seeds carry an authored window (`vocab_cutoff` / `pull_forward` / `grammar_cutoff`, replacing `position/N` and the deleted flat `READING_CORE_SLUGS`) plus `required_grammar`; `reading_seeds.grammar_coverage_errors` fails the build when a level slug is assigned to no seed or two (proven on a synthetic complete N5 assignment: 74/74 clean, 73/74 on a deletion); gate check 6 now reads grammar **out of the body** — out-of-level and required-but-absent — and caught 3 of the 10 retired N5 drafts using grammar past their own window, which the declared-slug check had passed. 11 fixtures. **Step 4's 30 N4 seeds are authored (2026-09-11)** — `seed_errors('n4')` clean, 96 of 97 points assigned one seed each, 24/30 humorous, 100→200-word bands, all 30 prompts build; generation runs separately from the subagent workflow and the 9 hand-authored N4 passages stay until it lands. Authoring them cost three gate repairs, each one a point no passage could have written: `grammar_coverage_errors` now skips `MANUAL_SLUGS` (`n4-node-vs-kara` was both forbidden and demanded), `n4-temo` became a two-token て+も rule (unidic never emits ても as one token, so it had never fired), and `level_check.pattern_words()` + `reading_context` let a passage write a pattern's own word (限り, 以来, 反面, わけ, …) exactly where that point is allowed — 28 of 97 N4 points and 6 N5 ones were unwritable without it. `--selftest` 37/37, `--calibrate` unchanged at 98.8%, 11/11 fixtures. **Step 3's 30 N5 seeds are authored (2026-09-11)** — `seed_errors('n5')` clean, all 74 points assigned one seed each, 24/30 humorous, 35→110-word bands, all 30 prompts build; the thinnest window carries 36 verbs and 10 adjectives. The ladder follows N5's own thematic bands (71→718 words, 10→74 points) and `pull_forward` stayed nearly empty because `CORE_SEED_SLUGS` already supplies the survival verbs. Authoring it cost one schema field: N5 grammar points 47–50 are the adjective forms and `grammar_detect` fires them on *any* adjective, so a prefix window forbids 大きい, 好き and いい for two thirds of the level — optional `pull_forward_grammar` is the grammar-side mirror of `pull_forward`, carried by every N5 seed below cutoff 47 and by no N4 seed (N4 inherits all 74). The 10 retired N5 seeds and `_RETIRED_PULL_FORWARD` are deleted, their drafts and web prompts moved to `retired-2026-09-11/`, and the gate's 11 fixtures re-anchored on the two kept seeds (`neko-to-shukudai` at 7, `eki-made-no-michi` at 9) — five note/expect strings, no fixture body. **N5 is fully generated (30/30, completed 2026-09-15)** — every seed passed the gate and carries a `natural` naturalness verdict; the artifact is `generate_content/passages/n5.json`. **N4 is fully generated (30/30, completed 2026-09-26).** **Both levels wired in (2026-09-26)** — `n5_readings.py` / `n4_readings.py` rebuilt from the artifacts in seed order, `generate.py --level n5/n4`, compile → curriculum v19, 60 passages in `reading_passages`. `_meta.review_status` is still unset on every entry: the Phase 5 human read is not recorded. No open blockers |
| [Reading passages — match the Minna no Nihongo shape](./content/reading-passage-minna-no-nihongo-alignment.md) | **Items 1–4 built 2026-09-12; 5, 6 and 8 deferred, 7 waits on the first batch; two naturalness passes followed 2026-09-13.** Measures our 8 new N5 drafts against five Minna no Nihongo I 読み物 passages (transcribed into the doc, so the photos are not needed again): our drafts are 37–58 tokenizer-words against MnN's 63–97, and 7 of 8 join no clauses at all. Three mechanical causes, all now fixed. (1) `prompts/reading-passage.md` said only "Vary sentence length" — it now carries a *How the sentences hold together* block (name the subject once then drop it, start each sentence from a noun already on the page, open some on a time or a place, join two clauses **where the window allows a linker**, grow の-stacked noun phrases), and `generate_readings.PROMPT_VERSION` is 3. (2) そして/それから/でも/だから/とても/いつも/時々 are in `context.CORE_SEED_SLUGS["n5"]` (65 → 72 slugs): they sit at vocab sort_order 669–694 of 718, so before this とても was reachable only at position 30 and the regenerated level would have read *worse* than the shipped one, which used them under the retired proportional window. N4 and the grammar-lesson and kanji-example lanes inherit the same seven words. (3) `target_words` stepped instead of ramping: **positions 1–5 are untouched** — their `grammar_cutoff` stops short of から (21) and ので (22) so they cannot join clauses at all, and MnN's own L4 and L7 join none either — and from position 6 the band jumps to 63–78 (MnN's shortest reading is 63 words) and interpolates to 98–126 at 30. The plan's item 4 (start the whole level at `vocab_cutoff` 190) was **rejected by the maintainer** in favour of that same step: from position 6 each seed carries the cutoff the next position used to (176 → 190 at 6, up to 718/74 at 29), which is one extra thematic band of nouns per passage, and position 6 is exactly where から and ので enter the window, so the prompt's conditional linker rule switches on at the passage the band steps at. Fallout was mechanical: four `pull_forward` words the raised cutoffs swallowed, `pull_forward_grammar` dropped at position 17 (cutoff 50 now contains the 47–50 adjective block), no `required_grammar` reassignment (coverage still 74/74, a point inside a window stays inside a wider one), and the two fixture pins held (position 7 at 26 < 29, position 9 at 32 ≥ 28). **Three fixture bodies were rewritten** to the new bands — both `expect: pass` ones (43 → 77 and 62 → 77 words) and `bad/too-long` (76 → 100, expect string now `64–80`) — with the six other bad fixtures re-derived from them so each still isolates one failure; the new good bodies are written to the item-1 rules, so the fixture set demonstrates the register it gates. Verified: `seed_errors` clean on both levels, 11/11 fixtures, all 60 prompts build, `grammar_detect` untouched at 37/37 selftest and 98.9% recall. Positions 6–8 of the 8 existing drafts now fail on the word band alone and are regenerated rather than repaired; the 10 shipped passages (40–110 words, written at MnN scale) move *closer* to their bands, one of them from fail to pass. Not built: the readings cast (5), `ga-contrast` and its sort_order renumbering (6), paragraph support in `PassageBody.tsx` (8). **First regenerated batch run 2026-09-12** — all 8 existing N5 drafts set to `failed_validation` and regenerated via the subagent workflow (opus-5, batch-size 1), all 8 passed on the first ingestion attempt, no repairs needed. Positions 1–5: 36–47 words (unchanged pre-linker bands), 0 clause-joining sentences each, as designed — subject-drop and lexical chaining checked by hand instead (e.g. seed 1 chains ここ→学校→部屋→窓→友達; seed 4 reuses 部屋 across family/narrator/cat). Positions 6–8: 74/76/78 words (bands 63–78/64–80/66–82), 2/2/4 clause-joining sentences — target of "≥2" met or exceeded at every position, with callback structure (seed 7's cat-on-homework excuse, seed 8's salt-for-sugar payoff). All `body_furigana` present, no missing `prompt_furigana`. Item 7's verdict: not needed yet — item 1's prompt text held cleanly across the batch (zero repairs), though positions 6–8 were prompted with an explicit "use ≥2 linked sentences" reminder alongside the base prompt, so this isn't a fully unreinforced test; a future batch (9–12) without that reminder would give a cleaner signal. 22 of 30 N5 seeds remain unregenerated. **Two corrections on 2026-09-13 after an outside read:** draft 2 had `昨日はこれです` (past time word, present copula) → `でした`, and draft 3 had `私の本の月曜日` ("my book's Monday") because at `vocab_cutoff: 118` no writing surface is reachable — ノート is sort_order 265, 紙 238, カレンダー absent from N5 — so 本 was the nearest allowed noun; fixed by adding `nooto` to that seed's `pull_forward`. Both re-ingested, both PASS. The general lesson: **a seed topic that names a concrete object must be checked against that seed's own `vocab_cutoff`**, because nothing in the loop catches the mismatch — the generator substitutes the nearest in-level noun and the passage still clears every gate. **All 60 seeds swept 2026-09-13** and both causes addressed. (a) Seven more seeds asked for a word past their own cutoff and are fixed by `pull_forward`: `dekiru-hito`/歌う (444 vs 440 — its topic is "the brother can sing"), `hako-no-naka-no-fuyu`/冬 (292 vs 284, and the seed is named "the winter in the box"), `ichido-dake-shita-koto`/有名 (365 vs 356), `junban-ga-okashii`/試験, `motte-ikanakereba`/旅行する, `kagi-wa-doko`/外+引き出し, n4 `souji-no-nikki`/日記. Three miss by under ten places, which is why it ships. **Still open:** 12 words are absent from n5+n4 entirely so `pull_forward` cannot help (`ポスター`, `規則`, `ボタン`, `押す`, `屋根`, `建物`, `訓練`, `誕生日`, `カード`, `玄関`, `葉`, `まっすぐ`) — three seeds are named for a word the curriculum lacks (`posutaa-no-yakusoku`, `nazo-no-bukatsu`, `setsumeisho-doori` whose topic is "press this button"); those topics need rewriting or the words adding. (b) The 曜日 furigana bug is fixed at the cause: unidic splits 月曜日 into 月曜+日 and reads 日 from its own lemma, and `_suffix_compound_notation` only repaired that when the second token is 接尾辞. New `furigana._split_compound_notation` handles noun+noun under three guards — every token carries kanji (so a particle cannot be swallowed: 今日+は is not こんにちは), the dictionary lists exactly one reading, and either the span is solid kanji or the readings differ only by voicing. The single-reading guard is load-bearing: 三分 is both さんぷん and さんぶん and its primary さんぶん means "a third", so auto-applying it would swap one wrong reading for another (十分, 三十分, 四時, 日本人, 一昨日, 二十歳 held back likewise); the solid-kanji guard is what admits the counters while excluding `日待ち`, where the text is really 日+待ち. Repairs 曜日 ×7 plus 九時 くじ, 七時 しちじ, 二日 ふつか, 四日, 七日, 八日, 四人, 一匹, 一本, 一回, 一週間, 一ヶ月, 外国人, 世界中, 三本, 二本, 昼頃. New `furigana.suspect_compound_readings` + `validate_readings` step 5b fail a passage on what the repair won't touch, since round-trip is consistency, not correctness; the detector consults **both** repair paths, or it would fail 日本人, which `_suffix_compound_notation` already gets right. Verified: 3,962 shipped sentences re-annotated with 0 round-trip failures and 0 nulls, 11/11 fixtures, 8/8 drafts pass, seed/ladder/coverage/tone clean on both levels, `passages/n5.json` reassembled. **Still open:** 7 compounds the detector reports rather than repairs, all genuinely ambiguous — 一昨日 (×4 across two readings), 三十分 ×2, 四時 ×2, 十分, 三分 — plus the `日待ち` ×9 false positive. They sit in shipped vocabulary/kanji/grammar/readings JSON, left alone as reviewed content; a future regeneration picks up the repair for everything else. No app code touched. **Word-fidelity pass 2026-09-13** (new § *The words were never the problem*) — several outside AI reads of the 11-draft N5 set returned "it feels unnatural" on passages that clear every gate, so the defect had moved from shape to word choice. Six causes, five mechanical. The instructive one: `する`/`ある`/`いる`/`なる` were **already** accepted at every seed by `level_check.FUNCTION_WORD_ALLOWLIST` but appeared in no prompt, so the generator wrote around a limit that did not exist and produced `宿題を書きました`; and `言う` (vocab sort_order 384) was in no core set, so no seed below cutoff 384 could quote anyone and both drafts with dialogue used 話す as a quotative (`「…」と話しました`). Fixed by putting `iu-v`, `suru`, `aru`, `iru-exist`, `naru-become` in `CORE_SEED_SLUGS["n5"]` (72 → 77) — four needed only *listing*, `言う` is the one real widening. `prompts/reading-passage.md` gained three sections, each rule written against the draft that broke it: *Words have to mean what they mean* (no near-miss substitution — `お茶は辛いです` for salty tea, since しょっぱい is in neither level and the **scene** was what had to change; と言いました for quotations; 宿題をします / 薬を飲みます; no counting without the object's counter; past time word takes a past sentence; every sentence must be one a person could mean — `私は一から話しました` is allowed words meaning nothing), *When someone speaks* (「」 + と言いました, ≤2 speakers, speech holds the narration's polite register), and *How often to write 私* (**at most twice**, a count not a principle, because § Finding 6's principle had already failed — 8 of 11 drafts open 私は). `PROMPT_VERSION` 3 → 4. Separately, found while reading a rendered prompt: `_extra_allowed_block` rendered the **gate's** exception set — the seed's names merged with `level_check.pattern_words()` — under the heading *"Names you may use"*, so all 60 seeds were told `ある`, `いる`, `ください`, `ない`, `く`, `かっ` were people's names, and a castless seed got a list of nothing else; it now renders `ctx["seed"]["extra_allowed"]` only. Two redundant `pull_forward` `aru` entries dropped (positions 9, 11), which `seed_errors` flagged immediately. Verified: seeds/coverage/tone clean on both levels, 11/11 fixtures with no fixture body touched, **all 11 existing drafts still PASS** (widening can only reduce failures), 60/60 prompts build, `grammar_detect` untouched at 37/37; `passages/n5.json` reassembled with **byte-identical bodies**, three passages gaining `aru`/`iru-exist` spans that were gate-legal but absent from `span_forms` and therefore untappable. **Maintainer chose prompt-only** — the 11 drafts are *not* regenerated and keep their `prompt_version: 3` stamp; the rules apply to seeds generated from here on. **Still open — cause 6:** `validate_readings` checks level, grammar, spans and furigana, and `audit_semantic`'s system prompt says "The Japanese is authoritative" so it grades only the English. **Nothing in the pipeline grades the Japanese.** Both offered fixes (a deterministic `と話す`-class blacklist, and an AI naturalness pass modelled on `audit_semantic`) were declined in the same decision, so an unnatural collocation still reaches a human read with every automated check green. **Topic-authority pass 2026-09-13** (new § *An object is not a person*) — seed 12 `hako-no-naka-no-fuyu` is the first draft generated under `PROMPT_VERSION = 4`, and an outside read confirmed the version-3 failures were gone (no `と話しました`, `私` used once, no invented collocation) but returned three new ones: `箱が先月から待っています` (a box does not wait), `角に持っていきました` for putting a box down, and `コートが二つ`. All three are one cause, and it is **not** the one version 4 addresses — the word the passage needed was not on the list at all, and the seed's own topic still demanded it. `置く` is vocab sort_order **591 of 718**, so it was outside the window at **25 of the 30 N5 seeds**: a passage could 開ける a box (417) and 閉める it (418) and never put it down, and the adult alternative 置いてあります is `n4-tearu`, N4 grammar. `着` (clothes) and `足` (pairs) are in **neither** n5 nor n4 — the only 着 is the verb 着る and the only 足 is the body part — so a numbered coat was never writable. Given a scene it could not write and a rule saying *change the scenario*, the model kept the topic, because nothing said the topic was the thing allowed to give way. Fixed by (a) a paragraph under `## What this passage is about` stating the topic is a sketch, **the vocabulary list outranks it**, and dropping a detail is the correct answer rather than a compromise — this is the fix, the rest are its cases; (b) `oku` into `CORE_SEED_SLUGS["n5"]` (77 → 78), where it sits with 使う 415, 開ける 417, 閉める 418 and 待つ 426, already core — 置く was the missing member of that group, not a widening of its kind; (c) an animacy rule (待つ/聞く/見る/話す need a subject that can intend the action; a thing that has sat somewhere since a time takes ある); (d) 〜つ named explicitly as **not** a general-purpose counter, which is how the model had read the existing "use the counter the object takes" rule. `PROMPT_VERSION` 4 → 5. Three seed topics stopped asking for the impossible, each with the reason commented beside it: 12 `hako-no-naka-no-fuyu` (numbered coats dropped — the joke was the lone shoe, not the arithmetic), 13 `yama-no-yakusoku` ("you may take photographs" needs 撮る, in neither level; the `toru` this seed pulls forward is 取る, there for 花を取る, so the topic would have produced 写真を取ります — the `te-mo-ii` slot is now drinking water at the top), 25 `hikkoshi-ikkagetsu` ("the picture is already on the wall" needs 壁, in neither level; it now stands on the desk). Verified: seeds/coverage clean on n5 and n4, 11/11 fixtures untouched, **12 PASS** on n5 including seed 12, 60/60 prompts build, and `level_check` at seed 12 now accepts `箱を角に置きました` and `箱は先月から部屋の角にあります`. **Still open:** the three bad topics were found by reading 30 topic strings against 30 windows **by hand** — nothing in the build does that, a seed naming an object/action/count the level cannot express is still accepted silently, and the n4 seeds were never audited this way. That is cause 6 in a second form, with the same standing answer. Draft 12 keeps its `prompt_version: 4` stamp and is not regenerated. **Cause 6 built 2026-09-14** (new § *Cause 6: something grades the Japanese now*) — the maintainer reversed the earlier decision and asked for an AI naturalness check run by a subagent, applying the fixes it returns. New `generate_content/naturalness_check.py`: `webprompts` writes one review prompt per **gate-passing** draft to `web/naturalness/<level>/`, a fresh subagent replies, `ingest` applies the sentence rewrites and re-runs `validate_draft` on the whole corrected passage. The load-bearing design point is that the prompt carries the seed's **entire allowed vocabulary and grammar window** — asked plainly "is this natural?", a model returns correct diagnoses with unusable fixes (the outside review of seed 12 proposed 置いてあります, which is `n4-tearu`, and the counter 二着, in neither level), so a reviewer that cannot see the window can only complain. Findings are per sentence and exact: `original` must be a body sentence copied character for character or the whole reply is malformed. Three outcomes — **natural** (body untouched), **corrected** (rewrite passed the gate; original kept on the draft under `naturalness.original_body`), **rejected** (findings came back but the corrected passage failed the gate — draft keeps its original body, gate errors appended to the prompt, exit 1). Nothing partial is ever merged. `--selftest` runs the reply contract against a known-bad reply for every rule plus the sentence splitter and the fix applier, 16/16, no model call. Runbook: `docs/workflows/reading-passage-naturalness-subagent-workflow-automation-prompt.md`, linked from the generation runbook and the workflows README. **Pilot 2026-09-14, four passages, one fresh opus-5 subagent each, run blind** (the prompt's error examples were checked against every draft first so the reviewer was not handed its answers): seed 6 natural; **seed 7 `宿題を書きました` → `宿題をしました` and seed 8 `「…」と話しました` → `と言いました`, both found blind and both passing the gate on the first ingest** — the two known word-fidelity defects, repaired in passages that were never going to be regenerated. Three results matter more. (a) At `REVIEW_VERSION = 1` seed 12 came back *natural*, explicitly clearing `箱が待っています` as "a deliberate literary device signalled by the title 箱の冬"; a reviewer allowed to read a sentence as intentional style can clear anything, so version 2 adds *this is a teaching text, not literature* and the re-run returned both 待っています sentences with in-window replacements. (b) The gate then **rejected** that correction: removing both 待っています stripped the passage's only 〜ています and seed 12 is the only passage in the level assigned `te-iru`, so the draft kept its original body — the rejection path working, since the naturalness fix had broken something the reviewer could not see. The repair round solved it and beat the brief: a fresh reviewer given the gate error moved 〜ています onto `冬の服は来年の冬まで、箱に入っています` (a stative 入る, correct where a waiting box is not) and additionally dropped `靴は二つではありません` — a present-tense denial of a count nobody asserted — for `冬の服はいいです`, reasoning the window has no 足 and no だけ or しか so the arithmetic had to go. Three sentences corrected, gate green first try, `questions` rewritten because Q3 asked `箱はいつから待っていますか`. **All four pilot passages now carry a naturalness verdict and the level is 12/12 PASS.** (c) The pilot surfaced a real bug in the lane: a rejected reply file was left on disk, so a caller waiting for the reply file to *exist* rather than for the repair subagent to *finish* re-ingests the reply just rejected and reads the identical failure as a second attempt — which happened here and briefly went into the doc as "rejected twice". `ingest` now deletes a rejected reply and the runbook says to wait on the subagent, not the file. (d) One earlier claim did not survive review: `私は一から話しました` was listed as "allowed words meaning nothing" and is in fact a real idiom (一から話す), natural in its context, so that example was removed from `prompts/reading-passage.md` — the rule now carries only `猫は毎週その日曜日に座ります`. The same reviewer also declined to flag draft 8's `お茶は辛いです`, which § *The words were never the problem* calls a defect. Both are one model's opinion against another's, which is the honest standing of everything this pass produces — a `natural` verdict is **not** the Phase 5 human read and sets no `review_status`. **Whole level reviewed 2026-09-14** (new § *The whole level, 2026-09-14*) — the maintainer asked for the check to be run across whatever needed it **without bumping `PROMPT_VERSION`**, since nothing was to be regenerated, so the remaining 11 drafts were reviewed at `REVIEW_VERSION = 2`, one fresh opus-5 subagent each: the 8 never seen, plus the 3 the pilot had reviewed at version 1, which version 2 makes stale. **All 12 N5 drafts now carry a version 2 verdict — 5 natural, 7 corrected — and the level is 12/12 PASS.** Six new corrections: `nanimo-nai-nichiyoubi` `猫は毎週その日曜日に座ります` → `猫は毎週そこに座ります`, `dare-no-heya` `家族の誰も分かりません` → `知りません` (awareness of a stated fact is 知る; with no が-marked thing to comprehend, 分かりません dangles), `kagi-wa-doko` `椅子の引き出しも開けました` → `引き出しも開けました` (a chair has no drawer, so the object does not exist), `eki-made-no-michi` and `sasoi-ga-fueru` both `と話しました` → `と言いました`, and `kaban-no-naka` `友達に電話で話しましたので、分かりました` → `聞きましたので` (友達に話す sends the information *away* from the writer, so it cannot be the reason the writer understood). Three results worth keeping. (a) **The prompt's own example returned as a blind finding:** `猫は毎週その日曜日に座ります` is the specimen § *An object is not a person* cites for allowed-words-meaning-nothing, and `nanimo-nai-nichiyoubi` is the passage it came from — its reviewer, which never sees `prompts/reading-passage.md`, found it unaided with the same diagnosis (毎週 fights その日曜日, and 座る wants a place). That is the closest thing the lane has to a positive control. (b) **All three quotative defects are `prompt_version: 3` passages** — this is not a new pattern needing a prompt rule, it is the pattern version 4 was written to stop, measured on drafts generated before it; the one version 4 draft in the set does not have it, and nothing was promoted into the generation prompt from this run. (c) **The rejection path ran a second time and the two reviewers disagreed.** `kaban-no-naka` was first flagged at `でも書きません` (the dropped subject carries over from `ペンが四つあります`, so it reads as the pens declining to write); the correction `でも、私は書きません` is sound but adds a word to a passage already at 85 of the seed's 69–86 band, so the gate rejected it whole and the body was left alone. The repair reviewer declined that finding as ambiguous rather than wrong and returned a different, **word-neutral** one, so `でも書きません` is still in the body — as is `お茶は辛いです`, which a second reviewer again declined to flag. The operational rule: **a correction must fit in the word count it replaces**, because a passage at the top of its band has no room to buy words. **Still open:** n4 has no reading drafts at all, so the lane has never run there; a correction is sentence-local — it can replace a sentence, never add one, which is exactly what blocked seed 12 and then `kaban-no-naka`; and `角に持っていきました` in seed 12 has survived three reviews unflagged — the topic-authority prompt pass is what stops it being written next time, not this pass. **Chained into generation 2026-09-14** — the maintainer asked that generation run the naturalness check itself rather than leaving it a separate invocation, so it is now **Step 4 of `reading-passages-subagent-workflow-automation-prompt.md`**, run once after the seed loop and scoped with `--slugs` to the seeds that run ingested (without `--slugs` a 4-seed generation run would silently become a whole-level review). The two rules the chaining had to preserve are written into the step: the reviewer is **never the subagent that wrote the passage** (a writer reviewing its own work clears its own choices — the reason this is a separate model call at all) and never shared across passages; and the caller waits for each review subagent to *finish*, never for the reply file to appear. The reviewer brief is not duplicated — Step 4 points at § *Step 2* of the naturalness runbook and adds one line the word band makes necessary: a correction must fit in the word count it replaces, since `kaban-no-naka` was rejected for adding one word to a passage at 85 of 69–86. Step 4 is also fenced: no `PROMPT_VERSION` bump, no regeneration on a finding, no editing `prompts/reading-passage.md` mid-run (a pattern is reported, and the `prompt_version` stamps are checked first, because a defect the current prompt already forbids is an older passage, not a pattern), no `review_status`. The standalone runbook keeps its job — backfill, and re-review after `REVIEW_VERSION` changes — and now says so at the top. **The single-session lane is chained too, as its Step 5**, on the maintainer's instruction — it is the one place that lane spawns subagents, and the reason is the same fact that first argued against it: the session that drafts a passage is exactly the model that must not review it, so delegation is not a relaxation of that lane's constraint but the only way to satisfy the rule. Its header no longer claims "no subagents" (the title is now *This Session Writes*), it carries a separate `<review-model>` knob, the old Step 5 is renumbered 6, and two prohibitions are spelled out because this lane invites them: do not review your own passages, and do not hand-edit a review reply — that lane repairs everything else inline precisely because it has no drafting subagent, and applying that habit to Step 5 would put the writer's judgement back into the step built to exclude it. Both lanes scope with `--slugs`, and in the single-session case that also protects the context isolation the lane exists for |
| [Radical coverage audit](./archive/radical-coverage-audit.md) | Done — N4 skeleton findings fixed 2026-08-10 |
| [Untaught kanji in vocabulary mnemonics](./content/untaught-kanji-in-vocabulary-mnemonics-plan.md) | **Partial** — step 1 (pipeline), step 2 (chip annotation) and step 3 (opt-in unlock) done 2026-09-05; the 803 words are not regenerated yet |
| [Kanji coverage & dependency order](./content/kanji-coverage-and-dependency-order-plan.md) | **v2 Phases A–D done 2026-08-17** (A: corpus 2,000 kanji, bands 150/300/700/1000/2000, 238 radicals. B: all four app rules — reading prompts gated on guru+ kanji, two-card vocabulary, master cap with the reason on the card, furigana at master + reading-live, annotated meaning prompts, Stats note. C: pull-forward dropped, `requires` band-gated. D: 8,500 derived N3/N2/N1 words, every band ranked on reuse, "No mnemonic" marker in Browse — 12,156 items, 25,124 edges, 6.5 MB); **Phase E track 1 done 2026-08-17, track 2 in progress (2026-08-18)** — track 1 (kanji prose) authored all 238 radicals (14 N5 + 10 N4) and all 300 N5+N4 band kanji (55 N5 + 118 N4) via the subagent lane (`sonnet-5`, groups of ≤4): 197 net-new items this phase, 195/197 gate-passing on attempt 1, only `k-storey` (N5) and `k-have-the` (N4) needing one repair each — both the same failure shape, a `description` naming a Japanese character not on the item's reviewed look-alike list. The runbook's Step 1a auto-select was fixed to read "done" from the per-source sidecar (`bands.json`-mapped) instead of the drafts folder, which the reband had made stale — verified against the sidecar directly, giving the exact counts the plan predicted (10 N4 radicals, 55 N5 kanji, 118 N4 kanji), and the runbook doc is updated in place with the corrected snippet. `generate.py --bands`, `validate-schema`, `compile-curriculum` all clean after every layer; the sidecar-based auto-select confirms 0 remaining across all four layers. Track 2 (N5/N4 vocabulary top-up) started 2026-08-17 with its mandatory prerequisite — `reading_regularity()` now judges against KANJIDIC (checked-in `_build/kanjidic_readings.json`, built by `import/build_kanjidic_readings.py`) and gained a `kun_word` kind, which puts N5+N4's 1,247 words at 538 note / 459 story / 207 kana / 43 irregular and leaves a 220-word re-authoring queue, 188 of them **reviewed** in the sidecar (the shipped file says draft for all 718 because the least-reviewed-wins rollup folds in the draft examples sidecar — read the sidecar, not the shipped file). 12-word pilot done, both directions, 12/12 gate-passing, run as seed-and-repair so untouched meaning prose stays byte-identical. Also found: 209 shipped words (189 reviewed) fail the gate on their *meaning* mnemonic, a separate pre-existing Phase A reband regression. **Track 1 gated most of track 2**: 345 of the 1,247 N5+N4 words could not have a prompt built until the 173 band kanji had prose — now unblocked, track 1 being fully done. First batch of word-writing, 50 N5 words, done 2026-08-18: same seed-and-repair method as the pilot but run at subagent scale (7 parallel repair subagents, groups of 8, mechanical seed step scripted rather than model-generated), 50/50 gate-passing, `generate.py --level n5` + `validate-schema` + `compile-curriculum` clean, shipped N5 vocab gate-error count 413 → 333 lines. Second batch, 36 N5 words, done 2026-08-18: same method (5 parallel repair subagents, groups of ≤8, `claude-sonnet-5-low`), 36/36 on the first repair attempt, 29 reading-only reshape + 7 meaning grafts, gate-error count 333 → 288 lines. Third batch, 36 N5 words, done 2026-08-18: same method (9 parallel repair subagents, groups of ≤4, `cursor-grok-4.6-high`), 36/36 on the first repair attempt, 24 reading-only reshape + 12 meaning grafts, gate-error count 288 → 243 lines. Fourth batch, 100 N5 words, done 2026-08-18: same method (25 parallel repair subagents, groups of ≤4, `cursor-grok-4.6-high`, three waves), 100/100 on the first repair attempt — finished the remaining 57 N5 regularity words (27 reading-only reshape + 30 meaning grafts) and started the meaning-mnemonic pass (43 wraps/grafts), gate-error count 243 → 89 lines. **N5 regularity is done**; **29 N4 regularity + 73 N5 / 1 N4 meaning-only** remained going into batch 5. Fifth batch, 100 words, done 2026-08-19: same seed-and-repair method (26 parallel general-purpose repair subagents, `sonnet-5`, groups of ≤4, three waves) — all 73 remaining N5 meaning-only words plus 27 of the 30 remaining N4 words (regularity reshapes and meaning grafts, mixed per item), 100/100 on the first repair attempt, `generate.py --level n5`/`--level n4` + `validate-schema` + `compile-curriculum` clean. Sixth batch, 3 N4 words, done 2026-08-20: same seed-and-repair method, closing out the queue — `setsumei` and `shuukan-custom` each needed one meaning-component wrap (an already-present synonym word left untagged: "explanation", "becomes") plus a reading_mnemonic reshape from story to one-sentence derivation note; `keizai` needed only the reshape. All 3 passed on the first repair attempt; `generate.py --level n4` + `validate-schema` + `compile-curriculum` clean. **The re-authoring queue is done (0 remaining).** Scoping batch 5 also surfaced that **N4's bulk vocabulary authoring has not actually started**: only 36 of N4's 529 shipped words have ever had a mnemonic generated through this pipeline (the other 493 ship with empty `meaning_mnemonic`/`reading_mnemonic`) — a much larger task than the tracked re-authoring queue, not yet scheduled. The +82 N5 / +171 N4 new-word top-up (no JLPT word-list source held yet) is still untouched. See the Phase E section of the plan. v1 Phases 1–4 tranche 1 shipped 2026-08-16 but the design is superseded: pull-forward is reverted in favour of gating the *question* (reading prompts withheld until a kanji is guru) rather than the display. New ladder 150/300/700/1000/2000 kanji, ~10,000 vocabulary, ~240 radicals. Kept from v1: Phase 1 ordering moves, Phase 2 skeleton, Phase 4 tranche-1 prose (30 kanji + 30 radicals), the `getParentsByRelationshipType` chunking fix |

## Design & platform — `docs/design/`

| Plan | Status |
| --- | --- |
| [Design System v2 restyle](./design/redesign-v2/README.md) | Done — Sessions 1–8 |
| [Curriculum Studio (web tool)](./design/curriculum-studio-web-plan.md) | Done — Chunks 1–9 live in [`web/`](../web/README.md). **Generated page added 2026-09-12** (outside the 9 chunks): a read-only view over the Phase 4 reading-passage artifact (`_build/generate_content/passages/<level>.json`) joined onto the `reading_seeds.py` ladder, so generated passages are reviewable before the Phase 5 wire-in without entering the shipped index — N5 2/30, N4 0/30 at time of writing |
| [Backup/restore + web build](./design/backup-and-web-plan.md) | **In progress** — Part A complete: export is story 9-1 (`done`), restore + backup nudge is 9-2 (`done`). Part B (web learner app) not started |
| [Web SQLite ATTACH findings](./design/web-sqlite-attach-findings.md) | Done — spike closed, `ATTACH` verified working |
| [AI reading & community contribution](./design/ai-reading-and-community-contribution-design-note.md) | Done — design note only, no app work by intent |
| [Customizable Home screen](./design/customizable-home-screen-plan.md) | Done — all 7 steps shipped: settings route restructure, catalog + reconciler, `ActionCard` extraction, Home rewired to the stored layout, customizer screen with drag/eye/lock/reset, Settings entry row |
| [Curriculum schema migration](./design/curriculum-schema-migration-plan.md) | **Not started** — Phase A (frozen item ids) done 2026-09-27 as phase 1 of the level-agnostic curriculum plan. Queued to run after content is finalized, before first public release. Phases A–C + F (frozen item ids, `schema_version` contract, seed re-import on app update, CI guardrails) and the Phase G runner are launch blockers; D (OTA gate) and E (orphan tolerance) follow. Three ladders: user schema (exists), curriculum replacement, content-change ops shipped inside `curriculum.db` |
| [Level-agnostic curriculum](./design/level-agnostic-curriculum-plan.md) | **Done 2026-10-17** — planned 2026-09-27. Phase 0 (baseline, no code change) done 2026-09-27. Phase 1 (permanent ids: `curriculum/id-registry.json` for items, passages and passage questions, seeded from the v22 build; `--update-registry`; passages carry a permanent slug) done 2026-09-27. Phase 2 (no level in slugs via `curriculum/_build/slug-renames.json`; kind-tagged look-alike refs; 10 N4 grammar duplicates merged into N5, ids kept and merged ids retired; `validate-schema` rejects `^(n[1-5]|k)-`) done 2026-09-27; 25 merged or shifted cloze variants that failed `check_cloze` were removed (maintainer decision). Phase 3 (one content file per kind: `radicals/mnemonics.json`, `kanji/mnemonics.json`, `vocabulary/mnemonics.json`, `vocabulary/examples.json`; lessons at `grammar/lessons/<slug>.md`; radical art at `mobile/assets/radicals/<slug>.webp`, `visual_mnemonic_url` now `radicals/<slug>.webp`) done 2026-09-27. Phase 4 (one level-override file: `curriculum/_build/levels.json` sets the level of any radical, kanji, word, grammar point or passage and replaces `PINNED_DERIVED`; `reports/level_report.py` lists what a move breaks and never fails the build; `kanji_bands.py` rerun first, so radicals `nine` N4 → N5 and `the-latter` N5 → N3; seed v28; also fixed: compile writes `metadata.json` `content_counts`, Studio compiles with `--update-registry`, mock update DB slugs mapped) done 2026-10-11. Phase 5 (`scripts/rewrite-backup-slugs.ts` rewrites a backup's slugs through `slug-renames.json`, merges rows of merged grammar, checks against `curriculum.db`; the 2026-10-11 backup rewritten with 0 unmatched slugs) script done 2026-10-11; restore on the phone worked 2026-10-17 (reviews and lessons available). Makes a level change a one-line edit: permanent item ids (Phase A of the schema migration plan), no JLPT level in slugs, N5/N4 duplicate grammar merged, one content sidecar per kind, radical art in one folder, one level-override file. Ends with a one-time rewrite of the maintainer's backup file to the new slugs |

## BMAD stories — `_bmad-output/implementation-artifacts/`

Two generations of stories share this folder. The live tracker is
[`sprint-status.yaml`](../_bmad-output/implementation-artifacts/sprint-status.yaml); see
[`_bmad-output/README.md`](../_bmad-output/README.md) for which is which.

**Wave 2 — current epics** ([`epics.md`](../_bmad-output/planning-artifacts/epics.md)):

| Epic | Status |
| --- | --- |
| 1 Kanji Review Clarity · 2 Goal-Driven Home · 3 Browse & Passages · 4 Lessons & Details | Done (2 stories each) |
| 5 AI Conversation · 6 Onboarding Personalization · 7 Contextual Guidance | Done (2 stories each) |
| 8 Shadow Mode & post-MVP backlog | **Not started** (`backlog`) |
| 9 Backup & Restore | **In progress** — 9-1 `done`, 9-2 `done` |

**Wave 1 — MVP epics** (from a superseded epics doc): 40 story files, all `done`
except [3-3 Bunpro import](../_bmad-output/implementation-artifacts/3-3-bunpro-import-or-documented-fallback.md), still at `review`.

## Defect logs

| Log | Status |
| --- | --- |
| [known-issues.md](./known-issues.md) | 1 open (accepted risk) |
| [codebase-issues.md](./codebase-issues.md) | 8 open (L1–L4, L6, L8–L10); H1, M1–M8, L5, L7 fixed |
| [deferred-work.md](../_bmad-output/implementation-artifacts/deferred-work.md) | Reference — consciously-not-fixed review findings |

## Reference / runbooks (no status)

| Doc | What it is |
| --- | --- |
| [README.md](./README.md) | Docs navigation hub |
| [app-overview.md](./app-overview.md) | What the app is, screen by screen |
| [workflows/](./workflows/) | Maintainer generation runbooks (web-chat + subagent lanes) |
| [srs-system-vs-wanikani.md](./srs-system-vs-wanikani.md) | How the SRS stages work, compared with WaniKani |
| [archive/](./archive/README.md) | Superseded plans, stale snapshots, closed investigations |

---

## What's left

### Grammar Read + Build SRS
- Simulator check (spec §6, manual list) not yet run by the maintainer.

### Grammar content — linked words
- In-app check pending (tap / long-press on a grammar page): tap on a lesson word opens its page, long-press toggles only that word's furigana, a "Uses" sentence word opens its page.

### Grammar content — mnemonics
- In-app check pending: a grammar detail page (ておく) shows the Mnemonic block under the header; lesson step 2 "Usage" shows it above "How it works"; a linked word in the example opens its page on tap; Browse grammar rows show no "No mnemonic" pill. Not run on 2026-10-18: no simulator or emulator on the build machine, and Expo web fails on the `expo-sqlite` wasm import.

### Content quality pipeline
- **N5 + N4 review complete (verified 2026-10-18).** Every N5/N4 sidecar is `reviewed`: radicals 148 + 106, kanji 150 + 175, vocab mnemonics and examples 718 + 529, grammar lessons and mnemonics 74 + 87. The compile's unreviewed-content warnings are all N3/N2/N1.
- **Example-sentence single-session lane, runbook written 2026-09-26, not yet run.** `docs/workflows/example-sentences-single-session-workflow-automation-prompt.md` — same auto-select, gate and retry budget as the subagent lane, but the session drafts every reply and repairs inline. Batch-size guidance is kept here, not in the runbook: each prompt stays in the session's context and N4 prompts grow from ~13k to ~23k tokens across the level, so Opus 5.5 ~8 slugs (6 from slug ~250), Sonnet 5 ~5 (then 4); for a whole level, the subagent lane gives each slug a fresh context.
- **Kanji example sentences removed, done 2026-09-24.** Only vocab (2c) and grammar (2a) carry example sentences now. A kanji rarely stands alone as a word, so its 1,242 shipped sentences only showed compounds (説 in 説明, 小説). The kanji lesson's third step is renamed "Vocabulary" and shows only "Vocabulary using this kanji". Deleted `curriculum/kanji/examples/` and `prompts/kanji-examples.md`; `generate_examples` / `validate_examples` take `--type vocab` only; the schema rejects kanji `example_sentences`, and `audit_shipped` flags any that appear. Studio lane `examples-kanji` removed. Runbooks under `docs/workflows/example-sentences-*` updated.
- ~~N5 radical/kanji mnemonics still fail the current Rev-3 gate by design~~ — **closed 2026-08-31**. All 469 stored kanji and 185 stored radicals now pass the full gate (2 length nits on one radical remain). Closed by the Rev 6/7 sweep, not by the wholesale regen, which still has not run.
- **Rev 6/7 kanji meaning-mnemonic sweep, done 2026-08-31.** Rev 6 (previous session) retargeted the house style to 120–220 characters of plain English in one cause-and-effect chain and added the `<kanji>` landing tag; Rev 7 added the *identity* class — a kanji that simply **is** a taught radical (山 the radical, 山 the kanji) now says so in one line instead of getting an invented scene, detected mechanically by `mnemonic_context.identical_radical` (116 kanji) with its own 40–200 gate band. Applied in place over stored prose rather than regenerated: 118 drafts (Rev 6), then 35 identity items and 231 over-length reviewed items (Rev 7), 266 in this session. Only `meaning_mnemonic` was touched — reading mnemonics and descriptions are byte-identical. `PROMPT_VERSION` deliberately stays at 4 throughout (bumping would make `cmd_run` regenerate every stored draft and throw the sweep away). Corpus after: 469 kanji, meaning length 77/188/260, 0 gate failures, 0 missing landing tags. **Cost: every rewritten item dropped to `draft`, so reviewed went 351 → 86** — a re-review queue of 383 is the outstanding work.
- **N5-band draft radical regen, done 2026-09-02.** The 39 N5-band radicals still at `review_status: draft` (all in `radicals/mnemonics/k.json`, previously `claude-opus-5`) were regenerated via the subagent lane (`sonnet-5`, 10 groups of ≤4, `PROMPT_VERSION` radical stays 1). 39/39 gate-passing — 38 on the group's first pass, `circumference` needed one inline trim (`image_prompt` 503 → under 500). `generate.py --bands` + `validate-schema` + `compile-curriculum` clean. All 39 were then flipped to `review_status: reviewed` on operator instruction (outside the subagent workflow's automation gate). Quality note carried forward: group 3 (`circumference`, `do-not`, `mingle`, `i`) plus `hill-left` and `left-hand-2` lean on a bolt-on animal/gag the style calibration discourages, and most `mnemonic_text` run ~190–225 chars vs the ~180 soft target.
- **N4 kanji mnemonic review, 32 items, done 2026-09-02.** Operator verified the first N4 subagent-lane batch (8 groups of ≤4). All 32 mnemonic sidecars flipped `draft` → `reviewed` (`kanji/mnemonics/n4.json` 30 slugs; `kanji/mnemonics/k.json` `k-world` + `k-idea`). Example sidecars for `n4-hosoi` and `n4-yowai` were still `draft` and were flipped too — `generate.py` takes the min status across both sidecars, so those two would otherwise have stayed draft in Studio; 29 others already had reviewed examples; `n4-atsumeru` has no examples sidecar. `generate.py --bands` + `validate-schema` clean. Shipped `kanji/n4.json` shows all 32 as `reviewed`. Slugs: k-world, n4-omou, n4-isogu, n4-iro, n4-dou, n4-ani, k-idea, n4-sha, n4-mono, n4-akarui, n4-chi, n4-tokoro, n4-mise, n4-ie-kanji, n4-shitsu, n4-zu, n4-shi-try, n4-ken-exam, n4-tsukau, n4-hajimeru, n4-owaru, n4-hosoi, n4-shinu, n4-atsumeru, n4-shu-main, n4-otouto, n4-ane, n4-suki, n4-warui, n4-futoi, n4-yowai, n4-tsuyoi.
- **N5 vocab mnemonic review, 32 items, done 2026-09-04.** Operator verified the first N5 subagent-lane vocab batch (8 groups of ≤4: pronouns/demonstratives/interrogatives). All 32 mnemonic sidecars flipped `draft` → `reviewed` in `vocabulary/mnemonics/n5.json`; example sidecars were already `reviewed`. Shipped `vocabulary/n5.json` updated to match. Slugs: watashi, watashitachi, boku, anata, kimi, kare, kore, sore, are, dore, kono, sono, ano, dono, koko, soko, asoko, doko, kochira, sochira, achira, dochira, konna, sonna, anna, donna, dare, donata, nani, nan, itsu, naze.
- **N5 flagged-kanji mnemonic regen, done 2026-09-02.** The 32 N5-band kanji an operator review pass had marked `review_status: flagged_for_rewrite` (11 in `kanji/mnemonics/n5.json`, 21 in `kanji/mnemonics/k.json`) were regenerated via the subagent lane (`sonnet-5`, high effort, 8 groups of ≤4, `PROMPT_VERSION` kanji stays 4). The runbook's Step 1a auto-select finds 0 because flagged drafts still match v4 — the flagged set was selected explicitly instead, reusing the runbook's grouping logic. 32/32 gate-passing on the group's first pass; zero repairs. `generate.py --bands` + `validate-schema` + `compile-curriculum` clean. After regen the 32 sat at `review_status: draft`; the operator then verified all 32 and, on instruction (outside the automation gate), both sidecars were flipped to `review_status: reviewed` — the mnemonic sidecars (`kanji/mnemonics/{n5,k}.json`) for the regenerated prose, and the example-sentence sidecars (`kanji/examples/{n5,k}.json`) for the pre-existing example sentences, which the same review pass had also flagged. `generate.py` sets the shipped `review_status` to the min across both sidecars, so both had to move before Studio (which reads the compiled DB) would clear. Shipped `kanji/n5.json` now shows all 32 as `reviewed`. Slugs: n5-nichiyou, n5-mai-every, n5-kou-school, n5-uru-baku, n5-takai, n5-atarashii, n5-ooi-ta, n5-hayai, n5-kuni, n5-michi, n5-shi-city, k-body, k-thing, k-meal, k-ill, k-inst, k-building, k-empty, k-brush-stroke, k-roof, k-paper, k-true, k-move, k-music, k-dwell, k-trip, k-attend, k-topic, k-sound, k-medicine, k-revolve, k-sentence.
- Review card mnemonic (`queueBuilder`) and `PassageWordDetailSheet` still read the old `mnemonic_text` field only.
- Phase 5 human review tool (`npm run review-content`) never built — review-status flips are ad hoc.
- Settings → About attribution UI missing (root `NOTICE` exists, no in-app surface).
- Default CI compile does not pass `--fail-on-draft`.
- Humor-tagged passages: planned, not built.
- Cast-coherence ship gate for draft → reviewed mnemonics/examples: not built.

### Content audit plan
- The single `audit_shipped.py` command exists; the ~8 new cheap checks it was specced with are only partly in (round-trip answer checks, graph completeness vs KRADFILE, look-alike symmetry).
- Tier 2 AI semantic pass (`audit_semantic.py`) built but not run over a full level.
- Tier 3 human pass on flagged items: not started.

### Furigana support plan
- Per-passage eye toggle (Phase 3) — per-*word* long-press toggle shipped via Plans 14/15, whole-passage switch did not.
- Open product questions unresolved (default by JLPT level, katakana policy). Not shipping blockers.
- **Mid-token kana fix, done 2026-10-18.** `furigana._fallback_annotate_token` put one bracket over a whole token when JmdictFurigana had no line for it, so the reading sat on the last kanji only: `召し上[めしあ]がる`, `池の上[いけのうえ]`, `二、三[にさん]`. It now aligns the reading across the kana inside the token (`召[め]し上[あ]がる`), uses dictionary readings to break a tie (`二[に]、三[さん]`), and leaves a still-ambiguous token bare. N5 + N4 regenerated: 22 strings changed, furigana-coverage warnings 14 → 0, seed v37. Test: `generate_content/test_furigana_fallback.py`.

### Radical mnemonic images
- N5 + N4: every radical (148 + 106) has an image under `mobile/assets/radicals/`, and every `visual_mnemonic_url` resolves to a file (verified 2026-10-18).
- Tier 2 (curated AI art) not started; production process is [radical-art-web-chat-workflow.md](./workflows/radical-art-web-chat-workflow.md).
- **`k`-corpus art made reband-safe (done 2026-08-22).** The art path's first segment is the
  *source dataset*, and `k` had no directory of its own, so `generate.py` fell back to keying
  `k` radicals' `visual_mnemonic_url` to their **band** — a silent-loss bug, because a slug
  does not follow its band: reband a `k` radical and its ref moves while the file stays put,
  and the art disappears behind the text fallback. Four files were exposed (`bou-stick`,
  `hakenobou`, `kawa-skin`, `nogihen`). `k` now has `mobile/assets/radicals/k/`, the schema
  pattern is `^radicals/(n[1-5]|k)/…`, `generate-radical-asset-map.js` accepts the directory,
  and the band-keyed fallback in `_write_banded` is deleted — every ref is now keyed to the
  dataset that wrote the radical, for all three sources. 126 files, 0 orphans, every ref's
  directory equals its source. Docs corrected in `radical-mnemonic-images.md`,
  `curriculum/README.md`, the art workflow and `web/src/lib/guide.ts`.

### Kanji coverage & dependency order
- Phase 1 done: `curriculum/_build/reports/dependency_order.py` reports coverage + ordering, and the 6 same-level ordering cases are fixed.
- Phase 2 done: 553 skeleton kanji at N3/N2/N1 (104/356/93) + 10 new radicals, generated from
  KANJIDIC2/KRADFILE by `curriculum/_build/import/build_skeleton.py` into the checked-in
  `curriculum/_build/skeleton.json`. Coverage is 100% — every kanji in every shipped word is
  now taught somewhere.
- `visual_mnemonic_url` is now optional in the schema — skeleton radicals ship without art.
- `listLevelsWithContent` now tests for **vocabulary**, not any item: with skeleton kanji in
  the DB, onboarding would otherwise have offered N3/N2/N1 as startable levels.
- Phase 3 done: `listLessonCandidatePool` (`itemRepository.ts`) makes the lesson pool the
  level's items **plus their transitive `requires` parents, wherever taught**, each parent
  taking the sort position of the earliest item that needs it. `planLesson` is unchanged — the
  chain falls out of the existing unlock gate. Skeleton `requires` edges are on: 711 → 1,607,
  0 kanji-bearing words left parentless (was 479), 765 words rely on pull-forward, 624 kanji
  pulled forward, N5 pool 988 → 1,355. Nothing is permanently locked (closure is depth 1).
  **Reverted by v2 Phase C** — the pool is one level again and `requires` is band-gated.
- Phase 3 needed no display change: `jlpt_level` comes straight off the item row, so Browse
  filters and item detail already showed 写 as N3. `builds_on` parents are deliberately not
  pulled forward — radicals never gate, and it would undo Phase 2's art deferral.
- `getParentsByRelationshipType` now chunks its `IN (…)` list; it sat one bound parameter under
  SQLite's 999 limit and the pull-forward pool would have blown past it.
- `dependency_order.py`'s severity model was rewritten for the new planner: cross-level
  `requires` is INFO (pull-forward, by design) with its own section, ERROR now means a
  `requires` chain that never bottoms out. Report is clean — 0 errors, 0 warnings. The 115 N5
  words Phase 1 left as ERRORs are resolved by the pull-forward, as Phase 1 predicted.
  **Superseded by v2 Phase C:** cross-level `requires` is an ERROR again, and the section is
  now a reading-gate table.
- ~~**Live cost until Phase 4:**~~ paid down by Phase 4 tranche 1 — see below.
- **Open, from Phase 1:** re-running `audit_shipped.py` after the 2026-08-16 group moves shows
  14 N5 example sentences referencing a word taught later — 13 for 彼女 (`kanojo`), 1 for 日本
  (`nihon`) — plus 2 `tabun` mnemonic errors. Moving 彼女 later fixed the ordering of the word
  itself and broke the examples that used it. Not Phase 2 fallout; not yet fixed.
- ~~Phase 2 leaves 3 known WARNINGs on 方~~ — resolved in Phase 4.
- ~~Running `generate.py --level <n>` reverts Studio review-status flips in `radicals/*.json` and `kanji/n5.json`; those files must be `git checkout`-ed after a regeneration until the sidecars carry the status.~~ **Fixed 2026-08-21** in `web/server/curriculum/sidecar.ts`: every Studio save now writes the sidecar generate.py reads back (source-keyed for radicals/kanji, level-keyed for vocabulary, lesson frontmatter for grammar), and an edit to a field with no sidecar behind it is refused instead of written to a file the next generate run overwrites. Verified: after a Studio save, `generate.py --bands` + `--level n5` reproduces the level files byte-for-byte.

### Phase 4 — authoring the skeleton (tranche 1 done 2026-08-16)
- **The plan's "order by reuse count" is obsolete.** It assumed authoring a kanji is what
  makes its words reachable; Phase 3 turned every edge on, so coverage is already 100% and
  what is missing is prose — met in *lesson* order. `reports/kanji_priority.py` is the queue
  (first encounter, reuse as tie-break) and writes `kanji-priority.md` / `.json`.
- Authored: **30 kanji** (queue #1 私 → #30 医) and **all 30 skeleton radicals**. First card
  with no mnemonic moved from **lesson 2 to lesson 96**; 0 empty cards in the first 200
  non-grammar cards, was 12. 523 kanji remain.
- Three prerequisites had to land first: 20 new radicals for decompositions that dropped a
  dominant component (私 was 厶 alone, ignoring 禾); maximal-component pruning in
  `build_decomposition`, since KRADFILE lists sub-strokes the gate then demands a story for
  (彼 = 彳 + 皮 now, mean 2.9 components); and `builds_on` pull-forward in
  `listLessonCandidatePool`, at the child's position minus half a step — a kanji mnemonic
  names its components, and `builds_on` does not gate, so position is the only ordering.
- 灬 (`rekka`) had looked untaught on all 318 kanji carrying it: KRADFILE writes it 杰 and the
  variant map had no entry. A mapping bug, not missing content.
- 方/遊/族 got their `katahen` edges and their mnemonics extended to name the component; all
  three are back to `review_status: draft`, since a sign-off does not carry to changed prose.
- **Open:** 30 skeleton radicals owe `.webp` art (text fallback renders today, and 禾 now
  appears in an N5 learner's lesson 1). `vocab_context`'s taught-kanji window still excludes
  pulled-forward kanji, so ~390 words keep a reading story for a now-regular reading —
  deliberately deferred until the kanji layer exists to chain from.

### v2 Phase A — reband (done 2026-08-17)
- **Corpus is 2,000 kanji.** The user held the ladder's N2/N1 figures at 1,000 / 2,000
  cumulative, and a band size is a count, so Phase D step 1 had to land inside Phase A:
  `import/build_skeleton.py` now derives the whole corpus (192 hand-authored +
  **1,808 derived**) instead of only the 553 kanji shipped words needed. Selection is every
  kanji a shipped word uses, then jōyō by KANJIDIC frequency rank until 2,000. 136 of the
  2,136 jōyō are left out.
- **Bands are exactly 150 / 300 / 700 / 1,000 / 2,000 cumulative.** New
  `reports/kanji_bands.py` ranks by corpus reuse (how many of a level's *own* words each
  kanji appears in), tie-breaks by KANJIDIC grade, and writes the checked-in
  `_build/bands.json` plus `reports/kanji-bands.md`. N3+ has no vocabulary to rank on and
  falls back to frequency.
- **Radicals: 152 → 238**, derived not curated. `build_skeleton.py` now mints a radical for
  every KRADFILE component of a derived kanji that nothing already teaches (86 new), rather
  than waiting for someone to hand-list it. Each files at the level of the first kanji that
  needs it: 122 / 40 / 42 / 15 / 19.
- **A slug no longer names a level.** It names the *source dataset* — `n5`/`n4` hand-authored,
  `k` derived — and is frozen, because the mnemonic sidecars, the bundled radical art and
  `user.db` are all keyed by it. `n5-en` ships in `kanji/n3.json`. The 553 old `n3-`/`n2-`/
  `n1-` kanji slugs were rewritten to `k-` with their suffixes intact, and their 30 mnemonic
  sidecar entries merged into `kanji/mnemonics/k.json` (radicals likewise into
  `radicals/mnemonics/k.json`).
- `generate.py` gained `--bands`: radicals and kanji can no longer be written per level,
  because a band mixes sources. `--level` now writes vocabulary, grammar and readings only.
  `generate_deps.py` resolves the curated decomposition maps by source, not level.
- `generate_mnemonics.py`'s sidecar now follows the slug's source and merges rather than
  rewrites for banded kinds — one level's drafts can no longer drop another level's entries.
- **113 hand-authored kanji changed level; 188 derived kanji moved up into N5/N4.** 53 kanji
  with written prose fell out of the 300-band and now wait, 百 千 万 円 東 西 南 北 道 高 足
  雨 among them. Their prose is not lost.
- Authoring debt is **173 kanji + 24 radicals** in the N5+N4 bands (plan estimated ~180
  kanji). `reports/kanji_priority.py` was rewritten against bands — its pull-forward
  reconstruction is gone, the queue is simply band order.
- **Plan claim corrected:** "every radical the 300-kanji N5+N4 band needs already exists" is
  false. 24 of the newly derived radicals land in N5/N4 with no mnemonic; they need prose
  (art is optional — text fallback renders).
- Verified: `validate-schema` clean, `compile-curriculum` clean (DB 3.6 MB, 3,656 items,
  8,059 edges), `dependency_order.py` 0 errors, mobile `npm test` 2,130 passing. 0 radicals
  file at a later *level* than a kanji that needs them; the 18 remaining within-level
  off-by-ones are a pre-existing artifact of radicals and kanji being separate streams, down
  from 48. The 8 kanji with no radical parent are unchanged from before.
- **Not done here:** Phase B (app rules), Phase C (drop pull-forward, band-gate `requires`),
  the rest of Phase D (N3+ vocabulary, Browse marker), Phase E (authoring). Pull-forward is
  still on, as Phase A intends.
- **Open risk, pre-existing and now acute:** `compile-curriculum` assigns `items.id` by
  (level, type, slug), and `user.db` stores progress against those integers. Rebanding
  renumbers essentially the whole corpus, so any installed profile would map onto the wrong
  items after an OTA swap. Nothing in this repo remaps them.

### v2 Phase C — drop pull-forward, band-gate edges (done 2026-08-17)
- **The non-gating edge is `builds_on`, not a new relationship type.** A kanji banded at or
  before the word's level emits `requires` (gates the lesson); a later-banded one emits
  `builds_on`, which already means *is a component of, never gates*. Schema enum, the DB
  CHECK constraint and both apps' types are untouched, and Phase B's `masteryRepository`
  already read both edge types, so rule 1's reading gate needed no change.
- `generate_deps.py`: 1,607 `requires` became **1,023 gating + 584 non-gating**. Edge total
  unchanged at 8,059; DB still 3.6 MB.
- `listLessonCandidatePool` is the level's own items and nothing else — the transitive
  `requires` walk and the `builds_on` component pass are both deleted. Radicals need no
  pull-forward because Phase A re-filed each to the level of its first kanji.
- **Two display surfaces had to widen**, or an out-of-band kanji would vanish from the UI:
  component chips on a word (`getComponentParentsForItem`) and "vocabulary using this kanji"
  (`useRelatedItems`) read either edge. Without it 写真 shows no components at all.
- `dependency_order.py`: a `requires` parent banded later than its child is now an **ERROR**
  — the pool never leaves the level, so it is a permanent lock. The pull-forward section is
  replaced by a reading-gate table.
- **Reading-gate coverage measured: 727 of 1,247 words (58%)** have a live reading card by
  their level's end — N5 407/718 (56%), N4 320/529 (60%), against the plan's estimate of 417
  at N5 and 65% overall. 520 words are meaning-only, held by 501 out-of-band kanji.
- Verified: `validate-schema` and `compile-curriculum` clean, `dependency_order.py` 0 errors,
  mobile `npm test` 2,145 passing, root 62, lint + typecheck clean. A fresh N5 profile meets
  its first prose-less card at position **205** (bar was 200); N4 hits one at position 1 —
  that is Phase E's authoring debt (173 kanji + 24 radicals), not a Phase C regression.
- **Open, not fixed:** the 11 same-level ordering WARNINGs from Phase A's reband stand.
  Fixing them means re-ordering inside a level, which the plan puts out of scope.
- **Stale decomposition exceptions cleared (done 2026-08-22).** Ten of
  `audit_shipped.DECOMPOSITION_EXCEPTIONS`'s group 1 suppressed a missing `builds_on` edge
  with the reason "the component radical is taught a level later". Banding files a radical at
  the level of the first kanji that needs it, so after Phase A all ten radicals band N5 and
  the reason was false — those kanji were shipping without a component chip for a radical the
  learner already knows, and the mnemonic generator was never told about the component. The
  ten edges are in `generate_deps.N5_DECOMPOSITION` now (斤→新, 冖→学/帰/売/読, 尸→駅,
  王→金/国, 广→座, 里→黒) and each child's `meaning_mnemonic` was rewritten to reference and
  tag the new component, back to `review_status: draft` for a human read. One group-1
  exception survives and is the only shape that still can: 隹→曜, where the radical's first
  kanji (集) bands N4 while 曜 bands N5. Adding the edges also pulls 冖 (86→37), 王 (75→17)
  and 里 (76→58) forward inside N5; no radical or kanji changed **level**.
- **Cost of that fix, accepted:** non-gating radical→kanji edges out of order went 18 → 21
  (INFO in `dependency_order.py` — presentation only, never a lesson gate). One is the new
  王→金 edge; two are collateral, radicals pushed a slot later by 王 jumping ahead. Radicals
  and kanji are separate dense ranks, so the k-th radical cannot always precede the k-th
  kanji; removing these would mean re-ordering inside a level, still out of scope.

### v2 Phase D — skeleton to full scale (done 2026-08-17)
- Step 1 (2,000-kanji corpus) landed back in Phase A. This is steps 2 and 3.
- **N3/N2/N1 vocabulary: 8,500 derived words**, 2,250 / 2,250 / 4,000.
  `import/build_vocab_skeleton.py` selects them from JMdict by `nfXX` frequency bucket
  (nf01–nf19) into the checked-in `_build/vocab_skeleton.json`; `generate.py --level n3|n2|n1`
  writes the vocabulary files. Slug is `v-<romaji reading>`, frozen once minted, as `k-` is
  for derived kanji.
- **Furigana is a selection filter, not an output step.** A candidate with no JmdictFurigana
  alignment for its exact (form, reading) is dropped — 49 of them — so every shipped entry has
  furigana without the tokenizer guessing at build time.
- **Bands now rank on reuse at every level.** `kanji_bands.py`'s N3+ frequency fallback only
  existed because those levels had no words. Ranking N3/N2/N1 on their own words moved 492
  kanji between those three bands (N5/N4 untouched — they are assigned first, from their own
  words) and took reading-gate coverage at the tail from 21/18/18% to **78% N3, 85% N2, 100%
  N1**. Overall 8,422 of 9,747 words (86%) get a live reading card by their level's end.
- **Word selection is constrained by the kanji corpus, not by band.** A word written with a
  kanji outside the 2,000 is dropped (556 candidates): its reading card would otherwise go
  live at the end of N1 having never taught the kanji. Coverage is 100% at every level, and
  `dependency_order.py`'s "authored nowhere" section is empty for the first time.
- **JMdict `ateji` is not a rejection reason** — 時計, 試合, 支払う, 拠出 are all tagged ateji
  and are the normal spellings; rejecting the tag taught them as bare kana. Rejected instead:
  search-only / rarely-used / out-dated / irregular spellings, digit headwords (４０ beside
  四十), and first senses that are only a particle, auxiliary, affix or numeral.
- **Browse marker, not a filter:** a `has_mnemonic` column on the item branch of the browse
  query drives a **"No mnemonic"** pill on the row. Grammar is exempt — its prose is
  `explanation_markdown`, not a mnemonic column.
- Verified: `validate-schema` clean (3 pre-existing warnings), `compile-curriculum` clean,
  `dependency_order.py` 0 errors / 11 pre-existing warnings, mobile `npm test` 2,148 passing,
  root 62, lint + typecheck clean. **12,156 items, 25,124 edges, curriculum.db 6.5 MB** —
  under the plan's 10–14 MB estimate. metadata 1.12.0.
- **Open, and now larger:** `items.id` is assigned by (level, type, slug), so 8,500 new words
  plus the N3+ reband renumber the corpus again. Nothing remaps an installed `user.db`.
- **Not done:** N3+ grammar, examples, mnemonics and passages — all out of scope by the plan.
  Phase E track 1 (author 173 kanji + 24 radicals) is done; track 2's re-authoring
  queue (N5 regularity + N4 regularity + meaning-mnemonic fixes, 103 words) is
  **done** (batch 6, 2026-08-20: the last 3 N4 words — `setsumei`, `keizai`,
  `shuukan-custom` — same seed-and-repair method, all 3 gate-clean on the first
  repair attempt); the +82/+171 new-word top-up is untouched. Also found while
  scoping batch 5: 493 of N4's 529 shipped vocabulary words have **no mnemonic
  prose at all** (only 36 ever went through this pipeline) — a much larger,
  separate authoring task the plan's progress notes had not surfaced.

### v2 Phase A revision — JLPT-first band ranking (done 2026-08-30)
- **Why:** N5/N4 items kept showing up at N3+ in Browse. The pronoun pins (私僕君彼誰) were a
  named workaround for a rule that was wrong in general: `kanji_bands.py` ranked the derived
  corpus by **KANJIDIC school grade**, the order Japanese *schooling* teaches in, while the app
  teaches to the JLPT.
- **Measured damage before the fix:** 58 kanji the JLPT tests at N4 (勉 医 病 薬 銀 館 英 飯 研
  究 転 進 都 開 院 題 …) sat at N3 or N2; 38 of the 64 derived N4 slots and 12 of the 44 N5
  slots went to early-school kanji no word at that level uses (麦 羽 矢 貝 黄 竹 森 草 …).
- **Fix:** `import/build_skeleton.py` now emits KANJIDIC2's `jlpt` tag into `skeleton.json`
  (additive, 1,808 lines, nothing else changed). `reports/kanji_bands.py` ranks the derived
  corpus by that tag first, then reuse, then grade, then frequency. `PINNED_DERIVED` stays —
  KANJIDIC tags the five pronouns 3/2/2/1/none, so JLPT-first alone does not place them at N5.
- **Budget: N4 150 → 175, N3 400 → 375**, cumulative still 2,000. Needed because 181 kanji
  carry the JLPT-N4 tag and 150 slots could not hold them all.
- **Result:** 0 JLPT-N5 and 0 JLPT-N4 kanji band above N4. (会 店 社 read as N5 on the exam and
  sit at N4 because `n4_kanji.py` hand-authors them — an authored-list call, not a ranking
  one.) Reading-gate coverage rose: N5 357 → 375 readable words, N4 206 → 245, N3 1,327 →
  1,645; N2 slipped 1,697 → 1,618, N1 unchanged. Total 7,187 → 7,883.
- **Cost, open:** the N5+N4 bands grew 300 → 325 kanji and 152 → 162 radicals, and **25 kanji
  plus 2 radicals (品, 井) inside them now have no mnemonic prose** — the authoring queue was
  empty before this change. See `_build/reports/kanji-priority.md`.
- **Amended the same day — two corrections inside the JLPT rank.** JLPT-first alone read wrong
  in the other direction, which playtest caught: 番 fell to N2 although six N5 words are
  written with it (一番, 番号, 交番, 電話番号, 部屋番号, 番), and 雲 皿 貝 虫 丸 黄 才 泳 — all
  grade 1-3, all written into just one N5/N4 word each — sat at N2 behind kanji twice their
  stroke count. Fixes, both acting *inside* a JLPT tier so no exam-N4 kanji is displaced:
  `RESERVED_BY_REUSE` ({n5: 10, n4: 6}) hands the front of each band to its own highest-reuse
  kanji, and `SIMPLE_GRADE` (3) sorts grade 1-3 ahead of the rest of its JLPT tier. Result:
  番 → N5, the other eight → N3. Cost: N3 reading cards 1,645 → 1,575 and N4 245 → 241; N5
  gained one (375 → 376). Budgets untouched. Rejected on the way: promoting *any* kanji this
  level's words use, which threw 58 exam-N4 kanji straight back to N3.
- Verified: `validate-schema` clean (6 pre-existing warnings, none new), `compile-curriculum`
  clean, root `npm test` 62 passing, `dependency_order.py` 0 errors / 27 warnings (24 before —
  all the same "kanji sorts one slot after its word inside a level" class, none new in kind).
  metadata 1.13.1.

### Phase 4 — reading passages
- N5 and N4: 30 generated passages each, wired in (curriculum v19, 2026-09-26). The hand-authored
  sets are retired.
- Phase 5 human read of the generated set not done (`_meta.review_status` unset).

### Backup/restore + web build
- Part A export (backup format + Settings export) is story 9-1, `done`.
- Part A restore preview + backup nudge is story 9-2, `done`. Replace-all restore inside one
  transaction, preview-then-confirm in Settings and as a fourth onboarding source, "last backed up
  N days ago" in Settings, and a web-only stale-backup banner on Home.
- Restore keeps `passage_practice_results` on raw curriculum ids (v1); rows pointing at passages this
  device lacks are counted in the preview and skipped, not migrated to slugs.
- Part B (web build + PWA) not started. The `ATTACH` blocker is cleared; the real one is the `expo-sqlite` sync-bridge bug.

### BMAD open stories
- 3-3 Bunpro import: at `review`, and seed `external_id_mappings` for Bunpro is still empty, so most imports report unmatched.
- 5-1 BYOK chat: `done`, but the native dev-client rebuild smoke test was never run on a machine with Xcode / Android Studio.
- Epic 8 (shadow mode positioning, AI reading backlog): `backlog` by design — post-MVP.

### Open defects
- Executorch main vs Expo resource-fetcher nightly skew: accepted risk, revisit on upstream release.
- `codebase-issues.md` L1–L4, L6, L8–L10: naming/perf/fragility items, all low severity, none user-visible.

### Mnemonic highlights carry their character: the `form` attribute (2026-09-08)
- **What changed.** A highlight tag now names the character it stands for, in a `form`
  attribute: `Give it a <kanji form="少">few</kanji> <kanji form="年">year</kanji>s, and the
  child grows into a <vocabulary form="少年">boy</vocabulary>.` Both apps render that as
  "Give it a few (少) years (年), and the child grows into a boy (少年)." All three layers
  carry it — a radical's `mnemonic_text`, a kanji's borrowed `<radical>` and its own
  `<kanji>`, a word's borrowed `<kanji>` and its own `<vocabulary>`.
- **Why an attribute rather than prose.** The parenthesis, the Japanese face and the accent
  colour stay render decisions, the character never counts toward a length band, and
  `stripHighlightTags` drops it so a screen reader is not asked to read a kanji mid-English-
  sentence. `<reading>` carries no `form` (its own text is already the kana), and neither
  does a radical's `image_prompt` — a glyph in an art prompt is a thing the picture might
  try to draw.
- **Gate.** `validate_mnemonics` checks three things per tag: the character is one the tag
  may legally name here, it is the one the tagged *words* mean when they identify exactly
  one candidate (so `<kanji form="年">few</kanji>` fails), and on a fresh draft it is
  present at all. Fresh drafts only, the same `enforce_readability` lane every added
  contract rides. Re-validating the whole shipped corpus is **byte-identical** to before —
  no stored item is requeued.
- **`PROMPT_VERSION` deliberately unchanged** (`radical 1 / kanji 4 / vocab 6`): bumping
  would make `cmd_run` regenerate every stored draft. Reviewed prose keeps its bare tags and
  renders exactly as it did; only newly generated mnemonics carry characters.
- **Quoted prose stays bare, on purpose.** A kanji prompt injects each taught radical's stored
  `mnemonic_text`, and a vocab prompt each component kanji's stored `meaning_mnemonic`, so the
  new story hooks into imagery the learner already has. That stored prose predates the
  attribute, so its tags carry no character — 4 bare of 42 tagged specimens in the 海 prompt,
  7 of 28 in the 少年 one. Accepted: both prompts say the quoted tags are history and not the
  format, and a fresh draft that misses a character is a hard gate error, so a slip costs a
  repair round and cannot ship.
- **`restyle_drafts.py` and `restyle/` deleted (2026-09-08).** Both matched `"<kanji>"`
  literally and would have rejected every rewrite in the new format. Rather than teach the
  attribute to a spent lane, the whole restyle pass was removed — the remaining
  `flagged_for_rewrite` kanji get regenerated through `generate_mnemonics.py` instead. See
  "Kanji meaning mnemonics restyled to one logical sentence".

### Untaught kanji in vocabulary mnemonics — steps 1 and 2 (2026-09-05)
- Plan: [untaught-kanji-in-vocabulary-mnemonics-plan.md](./content/untaught-kanji-in-vocabulary-mnemonics-plan.md).
  **Step 1 (content pipeline) and step 2 (app annotation) are done; step 3 (opt-in unlock)
  is not started**, deliberately deferred — it reverses `StudyStatusBanner`'s stated no-CTA
  contract (BUG7), which is a product decision worth taking on its own.
- **The defect.** A word can be written with a kanji banded above its own level — 昨 (N3) in
  N5's 昨日 — and `mnemonic_context.vocab_context` fed the prompt only the `requires` kanji, so
  the mnemonic explained half the word while the app rendered a chip for the other half.
  `vocab_component_edges` now returns both edge kinds; `vocab_context` returns the `builds_on`
  ones as `untaught_components`, and `format_vocab_components` renders them **meaning-only**,
  interleaved with the taught ones in written-form order. Meaning-only is what keeps the block
  buildable — 17 N5 and 51 N4 of those kanji have no `meaning_mnemonic` at all, which would trip
  the "regenerate the kanji layer first" `ValueError`.
- **Two filters, both computed, never the model's call.** A kanji whose meaning restates the
  word's is dropped via the same `_shares_meaning` test `identical_kanji` uses (昨日 "yesterday"
  over 昨 "yesterday" reads as "the yesterday day is yesterday"), and a word with *no* taught
  kanji keeps its existing standalone-story contract.
- **803 words gain a kanji: 70 N5, 94 N4, 324 N3, 315 N2, 0 N1** (N1's taught window is every
  level, so nothing is untaught there). The plan's table predicted 1,016 from a slightly
  different partition — it also calls 写真 zero-taught when 真 is in fact an N5 `requires`
  parent. The mechanism is the same; the arithmetic in the plan doc is stale, not the code.
- **`PROMPT_VERSION["vocab"]` stays 6**, same reasoning as the Rev 7 kana amendment: a bump
  requeues all 861 stored drafts including reviewed prose the new rule cannot change. Of the 164
  affected N5+N4 words, **only 3 needed stamping** (N5, at v6) — the other 92 with drafts were
  already at v4 against the v6 contract, i.e. already in the Rev 5/Rev 6 re-authoring queue, and
  69 N4 words have never been generated at all. N3/N2 have no drafts. All 164 regenerate.
  Stamp only *downward*, and only from the current version: a draft already below it is already
  queued, and rewriting its `prompt_version` erases which contract actually wrote the prose on
  disk. (Done wrong first here — 92 drafts were pushed 4 → 5 — then restored from the shipped
  sidecar's `_meta.prompt_version`, which is the surviving record.)
- **The gate allows the untaught kanji and never requires it.** Nothing in `validate_vocab`
  forbade naming one to begin with — a mnemonic names kanji by English meaning, and the only
  character check is on `description`, whose allow-list already contains the word's own form.
  `_component_errors` still gets the taught list only, so a two-sentence story that could not fit
  a fourth kanji is not a gate failure. Re-validating all 861 stored drafts on the stored lane
  gives the **same 14 pre-existing failures before and after** — zero new.
- **Step 2: the chip says so.** `CurriculumParentItem` gains `inBand: boolean`, set at
  `getComponentParentsForItem` per edge kind (vocabulary `requires` in-band, `builds_on` not;
  radical → kanji always in-band, because Phase A re-filed every radical to the level of the first
  kanji needing it). `useComponentParents` combines that curriculum fact with the learner's
  `item_study_status` and returns `ComponentParent.notYetLearned`. Both halves are needed: band
  alone would keep 昨 marked long after an N3 learner had learned it, and status alone would mark
  日 on a freshly opened 昨日, where the study-status banner is already saying so. The plan's file
  table said edge type alone, which contradicts its own "an N3 learner sees neither dimmed"
  verification; the verification won.
- The marked chip drops from the layer-below `soft` tint to the quiet `surface` tile, gains
  ", not learned yet" on its accessibility label, and the section prints one caption underneath —
  "You haven't learned 昨 yet — it comes later in the course." It is never hidden or delinked
  (FR76: a detail screen informs, it never withholds).
- **Not done, and it is the reason step 1 is only half-shipped: the 803 words have not been
  regenerated.** The plan's own step-1 verification #5 asks for N5 + N4 (164 words here) to be
  regenerated and read before touching the 639 at N3/N2. That is a paid batch run and has not been
  started.

### Untaught kanji in vocabulary mnemonics — step 3, opt-in unlock (2026-09-05)
- The chip now offers to do something about itself: `NotYetLearnedNote` puts a "Learn 昨 now
  (+2 items)" button under the not-yet-learned caption, writing one row to a new
  `lesson_opt_ins` table (migration 020). `useLessonPlan.buildPlanForLevel` unions that
  learner's opt-ins into the candidate pool.
- **This is not the pull-forward Plan v2 Phase C removed.** That was curriculum-level and
  automatic — every N5 learner got 写 and 真 whether they asked or not. This is per-learner and
  opt-in; the level model, the graph and everyone else's queue are untouched.
- **"Transitive *required* parents", as the plan's file table put it, would have unioned
  nothing.** The curriculum authors no `requires` edge into a kanji — a kanji holds its radicals
  through `builds_on`. Opting into 昨 by `requires` alone queues a kanji with none of the
  radicals its own mnemonic is written from. `getOptInPoolForItems` is one recursive CTE over
  **both** component edge kinds, which is what the plan's cost table ("the kanji + its radicals",
  minimum 2) always described. 昨's real closure: 日 (N5 radical, already in band), 乍 (N4
  radical), 昨 itself — so an N5 learner pays 2.
- **Only the anchor is stored, never the closure.** Which components a kanji needs is a fact
  about `curriculum.db`, and that file is replaced wholesale by OTA update; writing the closure
  into `user.db` would freeze one version of the graph.
- **Opted-in items sort to the front of their type bucket** (`LessonCandidate.optedIn`). Not a
  nicety: `sort_order` restarts at 1 per level *and* per type, so an opted-in N3 kanji merged
  into an N5 pool would land wherever N3's own numbering happened to put it — 昨 is N3 #67 and
  would have interleaved with N5 kanji #67. `ROUND_QUOTAS` still leads each round with radicals,
  so 乍 is never taught after 昨.
- **The count is always on the button**, and the offer is hidden when it would add nothing (every
  component already in band or already studied). "Already started" uses the planner's own
  two-part definition — a study status, or an SRS state from a progress import — so the number
  on the button is the number of lessons that actually appear.
- **The opt-in toggles off.** Not in the plan's file table; added because a mistap would
  otherwise permanently add items to the queue. Removing takes the item back out of the *pool*
  only — an item already taught keeps its SRS state.
- **The BUG7 friction, settled.** `StudyStatusBanner`'s "no CTA, no lesson entry point" is now
  scoped to the banner rather than the whole details screen, and both its docstring and
  `ItemDetailBody`'s record why: the button is a **queue** entry point, not a lesson one. It
  writes a row and stays on the screen, so details still enters no session and still withholds
  nothing. The stale `useLessonPlan.ts` comment the plan flagged (still claiming 写/真 are pulled
  forward) is rewritten.
- **Not wired: backup/restore.** `lesson_opt_ins` is not in `exportBackup`/`restoreBackup`, so a
  restore onto a new device drops pending opt-ins. Out of the plan's step-3 scope and low harm
  (the learner re-taps a chip), but it is a real gap.

### Vocabulary mnemonics Rev 6: reading composition becomes a field, reading reuse (2026-09-03)
- Rev 6 landed the same day as Rev 5 and **before a single word had been generated under Rev 5**,
  which is what made a second bump free rather than wasteful. It answers one question: where does
  "this is a jukugo word, so both kanji use their on'yomi" belong?
- **Not in the mnemonic, and not in the description — in a computed field.** `reading_regularity`
  already knows the pattern and every sound change *exactly*, so a model paraphrasing it can only
  lose precision, and the paraphrase was eating the reading mnemonic's whole one-or-two-sentence
  budget. The description was the wrong home for the opposite reason: it is authored prose for
  nuance the mnemonics cannot carry (register, false friends), and mixing derived data into it
  means no one can tell later which sentences a reviewer wrote.
  `mnemonic_context.reading_composition(form, reading)` now emits one line per word —
  "Jukugo — 年（ねん）＋中（じゅう）, each kanji read with its on'yomi. Rendaku: 中 ちゅう → じゅう.",
  "Kun'yomi — 入（い）＋り＋口（ぐち）. Rendaku: 口 くち → ぐち.", "Mixed — 太（ふと）kun'yomi ＋
  字（じ）on'yomi.", "Irregular — あした cannot be assembled from the dictionary readings of 明日."
  Carried through `generate.py` → `reading_composition` on `vocabItem` → an
  `items.reading_composition` column → `CurriculumItemDetail.readingComposition` → a "Reading
  composition" row on `VocabularyDetail`, under Word type. All 9,747 vocabulary rows carry one.
- **So 745 of N5+N4's 1,247 words now ship no `reading_mnemonic` at all** (538 `regular` +
  207 `kana_only`). That is the point rather than a gap: the field states the derivation better
  than prose could, and `reading_mnemonic` is left with the one job a field cannot do — a hook for
  a sound nothing derives. The gate enforces it in both directions: a fresh draft that writes one
  for a derivable word is rejected, and one missing for a `kun_word`/`irregular` word is too. The
  studio's reading-mnemonic panel now renders even when empty, saying the absence is correct, so a
  reviewer can tell it apart from prose that is merely missing.
- **A reading an earlier word already taught gets a pointer, not a rival story.** WaniKani's 教え
  says "you already learned this reading from 教える"; ours invented a second hook for the same
  sound, which competes with the first rather than reinforcing it.
  `mnemonic_context._reading_teachers()` walks all five levels in teaching order and records the
  first `kun_word` to teach each (kanji, reading-chunk) pair — **90 words at N5+N4, 351 across the
  whole curriculum** — covering exactly the transitive/intransitive pairs (上がる → 上げる,
  壊す → 壊れる), the derived nouns (答える → 答え, 続き → 続く), the potentials (書く → 書ける)
  and the passives/causatives (食べる → 食べさせる). Only a `kun_word` counts as a teacher: a
  `regular` word merely *contains* the reading and now ships a composition line rather than a
  mnemonic, so being shown 月（つき）inside 毎月 does not count and 月 the word keeps its own story.
  Those 90 get one sentence at 50–200 characters, and the gate requires the source word's written
  form to actually appear in it.
- **No kun'yomi/on'yomi terminology in the prose at all**, per the maintainer's call. The prompt
  says so twice and the composition field carries the vocabulary instead.
- `PROMPT_VERSION["vocab"]` 5 → 6; the vocab tool schema drops `reading_mnemonic` from `required`.
  Re-validating the 858 stored drafts on the stored lane gives **10 failures, all of them the
  pre-existing untagged-component ones on `meaning_mnemonic`** — zero new. That took two
  fresh-lane-only bands to achieve: the reuse rule would otherwise have requeued 43 kept Rev 4
  stories, and `VOCAB_READING_REUSE_STORED_BOUNDS` spans both a Rev 4 story and a Rev 6 pointer so
  neither shape fails re-validation.
- **Leftover:** the whole vocabulary layer is now at v4 against a v6 contract — 1,247 N5+N4 words
  queued, of which 529 N4 (493 of them never written at all) are the first batch. Under Rev 6 only
  ~412 of the 1,247 need an invented reading story at all (502 `kun_word`/`irregular`, less the 90
  back-references), down from 1,247.
- **First two N5 Rev 6 batches, 64 words, done 2026-09-04 (uncommitted).** Subagent lane
  (`sonnet-5`, groups of ≤4, `PROMPT_VERSION["vocab"]` stays 6). Batch 1 (uncommitted from an
  earlier session, 32 words): pronouns/demonstratives/question words — watashi, watashitachi,
  boku, anata, kimi, kare, kore/sore/are/dore, kono/sono/ano/dono, koko/soko/asoko/doko,
  kochira/sochira/achira/dochira, konna/sonna/anna/donna, dare, donata, nani, nan, itsu, naze.
  Batch 2 (this session, 32 words, 8 groups of 4): the number words — doushite, dou, ikaga,
  ikutsu, ikura, zero, rei, ichi through juu (both native and Sino-Japanese counting series),
  hyaku, sen, man, and the ひとつ–やっつ/ここのつ native counter series. 32/32 gate-passing on
  the group's first pass — zero repairs needed. `generate.py --level n5` + `validate-schema` +
  `compile-curriculum` clean. **64/718 N5 words now done at v6; 654 remain**, all still `draft`
  (per the workflow's discipline — review is a separate manual step). Both batches are
  uncommitted in the working tree as of this entry.

### Vocabulary mnemonics Rev 5: word type, WaniKani-length prose, `<vocabulary>` tag (2026-09-03)
- Three changes to the word layer, all aimed at what WaniKani actually does and what our N4 output
  visibly was not doing.
- **Word type is now shipped data, not prose.** `import/build_vocab_word_types.py` distills JMdict's
  first-sense part of speech into the checked-in `_build/vocab_word_types.json` — 9,710 of 9,747
  words (99.6%), 277 KB — in WaniKani's own vocabulary: `い adjective`, `な adjective`,
  `の adjective`, `godan/ichidan/する verb`, `transitive`/`intransitive`, noun, adverb, pronoun.
  Three match paths: JMdict `seq` (the 8,500 derived words), (form, reading) (the hand-authored
  N5/N4 ones), and `X + する` looked up as the base noun (50 words). The 37 residue — て-form
  auxiliaries (教えてもらう), potential/passive/causative (書ける), set phrases (どうしましたか) —
  gets **no** entry rather than a guess. Transitivity is dropped where no conjugation class sits
  beside it, so 勉強 the noun is not labelled a transitive verb.
  Carried through `generate.py` → `word_type` on `vocabItem` → an `items.word_type` column →
  `CurriculumItemDetail.wordType` → a "Word type" row on `VocabularyDetail`, under the reading.
- **The prose is cut to WaniKani length.** The meaning mnemonic goes from ~180–330 characters and
  two-to-four sentences to **one or two sentences, ~70–200** — the same cut Rev 8 made to kanji, one
  layer up. Enforced on the fresh-draft lane by `VOCAB_MEANING_MAX_SENTENCES = 2` and
  `VOCAB_MEANING_FRESH_BOUNDS`, with the `LEN_BOUNDS` floor dropped 140 → 60 and the 450 ceiling
  kept so no stored Rev 4 draft is requeued for length. A word that simply **is** its kanji (年 the
  kanji / 年 the word, 白 / 白い) is detected mechanically by `mnemonic_context.identical_kanji` and
  gets the one-line form at 40–200, exactly as `identical_radical` does a layer down.
- **Both mnemonics now tag the word's own meaning.** The old output never marked it: `keizai` left
  "the economy" as plain text and `iken` left "opinion" plain, so the learner saw component kanji
  highlighted and the thing being taught not. A fourth highlight tag, `<vocabulary>`, is required
  once in each mnemonic on fresh drafts — the word-layer twin of the `<kanji>` self-tag — and
  renders in the vocabulary accent in `AnnotatedText`.
- **The reading note says what a course would say** — *superseded by Rev 6, below, on the same day
  and before any word was generated under Rev 5.* `reading_regularity` gained `pattern`
  (jukugo / on / kun / mixed) and `sound_changes` (rendaku, handakuon, gemination, each with the
  kana it came from), and the Rev 5 prompt asked the model to spell them out in the reading
  mnemonic. Rev 6 keeps the computation and drops the prose. A modern ぢ→じ / づ→ず spelling
  variant was added here so 年中 ねんじゅう derives instead of falling to "irregular"; the N5/N4
  branch counts are unchanged by it (538 / 459 / 207 / 43), so no existing word changed lane.
- `PROMPT_VERSION["vocab"]` 4 → 5. Here the staleness is the point: all 718 N5 words are correctly
  re-selected, because Rev 5 is a rewrite rather than a retag. Nothing is deleted — stale prose
  keeps shipping until a run replaces it — so N4's 493 unwritten words go first and N5 follows.
  Re-validating the 858 stored drafts on the stored lane produces **zero** new length or tag
  failures (the 11 that remain are the pre-existing untagged-component ones).
- **Leftover:** re-run `import/build_vocab_word_types.py` after `build_vocab_skeleton.py` or any
  hand edit to the N5/N4 word lists; a word added since the last run ships with no word type.

### Kanji decomposition switched from KRADFILE to KanjiVG (2026-09-01)
- `curriculum/_build/import/build_decomposition.py` → `_build/decomposition.json` is now the
  **single source** for every radical → kanji `builds_on` edge. `generate.py`,
  `generate_deps.py` and `reports/kanji_bands.py` all read it. KRADFILE survives only as the
  fallback for the 13 kanji KanjiVG has no entry for.
- Why: KRADFILE is a flat search index, so it listed every search radical at any depth and
  double-counted regions — 便 shipped as 人一ノ｜日田 and 休 as 人亻木. KanjiVG's stroke groups
  nest by component, so the top level is the split a human would draw: 便 = 亻+更, 映 = 日+央,
  輸 = 車+兪. 1,649 of 2,000 kanji now land on exactly two components; 33 on four or more,
  down from 609.
- Radicals grew **238 → 798** (N5 115→134, N4 46→99). 22 old radicals are no longer a
  component anywhere and were dropped, 8 of them carrying reviewed prose (面 買 初 世 無 麦 and
  the stroke-level ノ ｜, which were the point of the change). Their sidecar entries are left
  in place, unused.
- **Leftover:** 513 radicals at N3+ have no `mnemonic_text`. Harmless today — those levels ship
  no kanji prose either — but they are the queue if N3 content starts.
- **Leftover:** `N5_DECOMPOSITION` / `N4_DECOMPOSITION` in `generate_deps.py` (~200 lines of
  curated data) are now dead and were deliberately left in place, not deleted.

### Kanji meaning mnemonics restyled to one logical sentence (2026-09-01)
- The Rev 6 "two or three sentences, one causal chain" form produced a scene the components took
  turns acting in, with the meaning bolted on at the end. Rev 8 is **one sentence that reads as a
  reason**: 員 went from 216 characters of gatekeeper-and-badge to "An employee is just one more
  mouth the company has to feed with its own money."
- Enforced by `MEANING_MAX_SENTENCES = 1` in `validate_mnemonics.py` (fresh-draft lane only) and a
  `LEN_BOUNDS` floor drop 100 → 60. The meaning may now sit **anywhere** in the sentence, not only
  at the end.
- 266 kanji rewritten and ingested; 108 new N5/N4 radicals authored. Prompts updated:
  `prompts/kanji-mnemonic.md`, `prompts/vocab-mnemonic.md` (logic rule only — vocab keeps its own
  length).
- **The one-off tooling is gone.** `restyle_drafts.py` and `curriculum/_build/restyle/` (batch
  briefs, `BRIEF.md`, `check.py`, `patch.py`, `ingest_radicals.py`, the `out/` rewrites) were
  deleted on 2026-09-08. Recover them from git history if a pass like this is ever wanted again.
- **Leftover:** **50 stored kanji mnemonics are `flagged_for_rewrite`** (count as of 2026-09-08;
  112 when this entry was written) — they name components their kanji no longer has after the
  KanjiVG switch. They must be rewritten before those kanji ship. Regenerate them with
  `generate_content/generate_mnemonics.py --type kanji --level <lvl> --slugs …`. Note the flag
  lives only in `kanji/mnemonics/*.json`; no item in the shipped `kanji/<level>.json` carries it,
  so `compile-curriculum` does not warn on them.

### Decomposition holes closed: every split now accounts for every stroke (2026-09-01)
- KanjiVG labels the stroke groups it has names for and leaves the rest as bare strokes, and the
  walk in `build_decomposition.py` could only hoist *labelled* children out of an unnamed region.
  A region with no labelled child had its strokes dropped: **229 kanji shipped a component list
  with a hole in it** — 前 as 八+月+刂 with no ground, 右 as a mouth with no hand, 白 as 日 alone,
  先 as 儿 alone, 鳥 as 灬 alone, and 54 kanji (大 日 月 金 口 …) with no components at all.
- Every split is now checked against the glyph's own stroke count and a short one is not used:
  - `KANJI_OVERRIDES` (121 entries) states the components by hand where the missing region has a
    name — 前 = 丷+一+月+刂, 右 = 𠂇+口, 左 = 𠂇+工, 電 = 雨+电, 直 = 十+目+乚.
  - Where it has none, the kanji is taught as **its own single radical** (140 kanji: 七 大 北 白
    立 鳥 馬 …), which is the pairing 長/長 has always shipped and what KRADFILE says about most
    of them.
  - `HAND_STROKES` + the stroke-sum audit at the end of the run keep the hand table honest; it
    prints any entry whose components do not add up.
- "horns" moved from 䒑 to **丷**, with 一 as its own chip (`FORM_EXPANSIONS`, `SLUG_MOVES`), so
  the slug and its prose carry over. Its sidecar text was reworded — the bar it described is gone.
- Radicals 798 → 817. **N5 134 → 148, N4 99 → 107**, because a radical files at the level of the
  first kanji that needs it and identity edges pull 北 右 左 七 今 … forward to N5. 面 世 無 西 came
  back from the dropped set and recovered their prose. 10 new N5/N4 radicals were authored
  (五 万 西 北 今 电 飛 乚 以 民); no N5/N4 radical is prose-less.
- Kanji bands did not move (`bands.json` kanji section is byte-identical), so only the radical
  level files were rewritten.
- **Leftover:** **169 stored kanji mnemonics fail the gate and are all now
  `flagged_for_rewrite`** (N5 67, N4 65, N3 28, N2 5, N1 4). 69 were newly marked in this pass:
  64 were `draft`, 5 were `reviewed` (行 生 自 夫 夜 — flipped deliberately, on request, because
  their decomposition moved under them). 168 of the 169 name components their kanji no longer has,
  or are now identity items still carrying an invented scene where the contract wants one sentence
  ("the <radical>big</radical> radical and the <kanji>big</kanji> kanji are the same"); the odd one
  out is 重, whose description names 日 as a look-alike it does not have. No prose was edited.
- 12 items that were already flagged now *pass* the gate (口 立 羊 糸 竹 矢 角 肉 戸 羽 鳥 谷 — all
  became identity items and their stored prose happens to fit). They were left flagged, so the
  regeneration list is 181 unless they are dropped by hand.
- The flags were propagated into the shipped `curriculum/kanji/<level>.json` by hand (68 items:
  N5 36, N4 21, N3 8, N1 3). `generate.py` normally does that — it takes the *least* reviewed
  status of the mnemonic and example sidecars — but it cannot run here without `fugashi`, and the
  level files were otherwise already in sync with the sidecar prose. `compile-curriculum` only
  warns on a non-reviewed status, so nothing is withheld from the app by this.
- Regenerate with `generate_content/generate_mnemonics.py --type kanji --level <lvl> --slugs …`.
- **Gate gap:** 79 kanji are identity items with stored prose, and the 30 that pass the gate are
  all still multi-sentence scenes rather than the Rev 7 one-sentence "the radical and the kanji
  are the same". The gate cannot see it: when the radical meaning *is* the kanji meaning, any
  story that names it satisfies the component check, and `MEANING_MAX_SENTENCES` only runs on the
  fresh-draft lane. 12 of the 30 are flagged for other reasons; the other 18 (雨 力 入 川 子 耳 木
  二 女 水 手 夕 米 石 王 刀 弓 毛, 6 of them `reviewed`) are not flagged. Applying the
  one-sentence rule to identity items on the stored lane would catch the class mechanically.
- **Leftover:** `generate.py --bands` was not run end to end (no `fugashi` on this machine, and
  PyPI is unreachable from here). The radical level files were written through `generate.py`'s own
  `_write_banded`; the kanji files need no rewrite. `npm run compile-curriculum` still pending.

### Dead code to remove (not missing features)
- `claimStreakCelebration` + migration 014 (`src/data/user/streakRepository.ts`) — Plan 05 §5.2's data path. PRD decision R2 removed streaks from Home, so this has no UI and no callers by design. Do not build onto it.
