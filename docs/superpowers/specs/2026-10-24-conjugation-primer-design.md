# Conjugation primer — one read-once lesson card + a conjugation table on every word page

**Date:** 2026-10-24
**Status:** Design — not built
**Scope:** (A) One new N5 grammar lesson card that explains word groups and conjugation, read once, never reviewed. (B) A full conjugation table on the details page of every verb and adjective. No change to how other grammar or vocabulary is reviewed.

---

## 1. Problem and intent

The learner's words:

> I want to let the user know the rules of the godan verb, ichidan verb, い adjective, and な adjective, and how they conjugate when converting to past, present, or future tenses. This specific rule, I think, is not explained anywhere in the app.

> I'm thinking the conjugation rule should be included as a grammar lesson, like a card. It would be a one-off thing before actual grammar comes in, where conjugation is required. This particular card won't have a review per se.

> … how to identify the type of word the vocabulary is and how to conjugate it with the data of the vocabulary in the app itself in the details page.

What the app has today (checked in the code):

- Each form lesson teaches only its own rule: `masu`, `nai-form` (incl. なかった), `ta-form`, `adj-i-conjugation`, `adj-na-conjugation`. The rules are spread over many lessons.
- No lesson introduces the word groups together, and no lesson tells the learner **how to identify** a verb's group. The trap verbs (知る, 帰る, 入る, 走る, 切る, 要る — all N5, all `godan` in the data) look ichidan but are godan. 知る → 知らない / 知らなかった is the case that started this.
- Naming is not consistent: `te-form` says godan / ichidan; `masu`, `nai-form` and others say ru-verb / u-verb.
- The vocabulary details page has a "Conjugated forms" section (`mobile/src/components/learn/ConjugatedFormsSection.tsx`). It lists only the forms that appear in that word's example sentences, in 4 categories (ます / て / ない / た). It is not a table.
- Word type (`word_type`, e.g. `godan verb, transitive verb`) is in the data and shows on the details page (`VocabularyDetail.tsx`), not in the lesson.
- Conjugation reviews start at the `masu` grammar item (N5 sort_order 4): the Build card shows the words in dictionary form (飲む) and the learner types the sentence (水を飲みます).

**Intent:** before the learner is ever asked to conjugate in a review, they read one card with the whole picture. Afterwards, any word page shows exactly how that word conjugates.

**Success:**
- A fresh learner meets card A in the lesson flow directly before the `masu` lesson, reads it once, and it never shows up in reviews.
- Every verb and adjective details page shows a correct 8-form table. 知る shows 知らない / 知らなかった and is flagged as a look-alike exception.

## 2. Goals, non-goals, anti-goals

**Goals**
- A: one read-once grammar card, "How words change", placed directly before `masu`.
- B: an 8-form conjugation table + word-group tag on the details page of every verb and adjective; a "how to tell" line on look-alike exceptions (§4).

**Non-goals**
- No review card, quiz or SRS entry for A.
- B does not cover て-form, potential, passive, causative, volitional, conditional, etc. Only the 8 forms in §4.
- No table for nouns, adverbs, pronouns, の-adjectives, expressions, counters, etc.
- No change to the Read / Build grammar review cards or to vocabulary reviews.
- No rewrite of the existing form lessons (`masu`, `nai-form`, …).

**Anti-goals (a failure even if it works)**
- A wrong form in the table. A reference table that is sometimes wrong is worse than no table. Irregulars must be right.
- Card A shows up in reviews, in the review count, or in the goal ring as "due".
- Card A lands after the first conjugation review (i.e. after `masu`).

## 3. Card A — "How words change"

**Placement (decided by the learner):** an N5 grammar item placed directly **before `masu`** in curriculum order. It goes through the normal lesson flow like any grammar item.

> Note: the `desu` reviews (sort_order 2) already contain でした. The learner was told this and still chose "just before ます", because ます is where the learner must conjugate a word themselves.

**Learners already past `masu` (decided by the learner):** do not show card A to a learner who has already started the `masu` lesson, or who started at N4 from the placement step. It never enters their lesson queue. It is still readable from Browse like any other item (my call: "don't show" means not in lessons).

**Read once, no review (decided by the learner):** finishing the lesson marks it done. It is never queued for review, never counted as due, and never appears as an apprentice/guru item. It stays readable later from Browse like any other item.

**Content (approved from the mockup):**
1. **Only two tenses.** Past and non-past. Non-past also covers the future (食べます = "I eat" and "I will eat").
2. **The word groups**, each with a one-line rule and an example from the app's N5 vocabulary:
   - Ichidan verb — e/i sound + る; drop る. 食べる → 食べない · 食べた
   - Godan verb — the last sound shifts. 飲む → 飲まない · 飲んだ
   - Irregular — する and 来る (and every する-verb such as 勉強する follows する) *(added as my call, approved)*
   - い adjective — drop い, add the ending. 高い → 高くない · 高かった
   - な adjective — the word stays; the helper changes. 静かだ → 静かじゃない · 静かだった
3. **How to tell the group.** Every word page shows its group as a tag. The trap: some verbs look ichidan but are godan — 知る → 知らない (not 知ない). Others: 帰る, 入る, 走る.
4. **The full grid** (non-past / past × positive / negative × casual / polite) for 食べる, with a line: "Each form gets its own full lesson later."

Examples are fixed, authored N5 words (my call), not personalised to what this learner has studied.

The mockup was a throwaway browser page (`.superpowers/brainstorm/`, not committed); everything approved in it is written in this section. Card A has no mnemonic, no example sentences and no review pool (my call); it needs only the fields the lesson screen must render.

## 4. Table B — conjugation table on the word details page

**Where:** the vocabulary details page (`VocabularyDetail`), which is the page used from Browse, lesson item detail and review item detail.

**Which words (my call, approved):** every item whose `word_type` contains a verb group (`godan verb`, `ichidan verb`, `する verb`, and 来る) or `い adjective` / `な adjective`. No table for any other word type.

**All levels (my call):** every verb and adjective in `curriculum.db` (N5–N1), because the learner asked for "every other vocabulary". The verification test covers all levels.

**When `word_type` is wrong (my call):** `word_type` comes from the first JMdict sense, and it is wrong for a few words (e.g. いい tagged `adverb`; たくさん / たいてい tagged `な adjective`; 心配する / 失礼する tagged both `な adjective` and `する verb`). A small, reviewed override list in the pipeline is allowed: it corrects a word's group or excludes a word from the table. This is not a per-word table — the forms are still generated. いい gets a table (よくない / よかった). The honorific godan verbs (いらっしゃる, おっしゃる, なさる, 下さる, ござる) get their real ます-forms (いらっしゃいます). A wrong form is never acceptable: when in doubt, exclude the word, and list the exclusions in the pipeline report.

**Header:** word-group tag (e.g. "Godan verb") on every word with a table. The "exception" tag and one-line "How to tell" note show **only on look-alike exceptions** (my call; §2 "how to tell" means this):
- a `godan` verb whose dictionary form ends in e/i-sound + る (知る: "It ends in い-sound + る, so it looks ichidan. But 知る is godan. る → ら for ない.");
- a `な adjective` that ends in い (きれい, 嫌い: "It ends in い, but it is a な adjective. きれいじゃない, not きれくない."). The な-adjective lesson already calls these traps.

**The 8 forms, all shown from the start (decided by the learner):**

|            | Non-past   | Past             |
|------------|------------|------------------|
| + casual   | 知る       | 知った            |
| − casual   | 知らない    | 知らなかった       |
| + polite   | 知ります    | 知りました         |
| − polite   | 知りません  | 知りませんでした    |

For adjectives the polite rows follow the app's existing lessons: い-adjective + です (高いです / 高くないです / 高かったです / 高くなかったです); な-adjective uses です / ではありません / でした / ではありませんでした, casual だ / じゃない / だった / じゃなかった.

**"Same pattern as"** line: 2–3 other app words of the same group (for exceptions: other look-alike godan verbs).

**Must be right for the known irregulars**, at minimum: する and every する-verb, 来る (くる/こない/きた), 行く (行った, not 行いた), ある (negative ない, not あらない), いい (よくない / よかった), and godan う-verbs (買う → 買わない).

## 5. Constraints

- Hard conventions in `CLAUDE.md`: `Result<T, AppError>`, never write to `curriculum.db`, semantic NativeWind tokens, no raw hex.
- The table is generated from data the app already has (`primary_form`, `furigana`, `word_type`), plus the small override list in §4. No hand-authored per-word tables.
- Offline. No network.
- Content pipeline rules: grammar items are defined in `curriculum/_build/n5_grammar.py`, essay in `curriculum/grammar/lessons/<slug>.md`, compiled via `npm run compile-curriculum`. Card A has no review sentence pool; the compile/validate steps must accept that for this one item.
- `docs/working-history.md` gets a line for this plan when its status changes.

## 6. Left to the builder

- How "read once, no review" is modelled (item flag, new item kind, or lesson-complete → done state) — as long as §2 anti-goals hold.
- How card A is ordered before `masu` (sort_order shift or explicit placement), and how it interacts with grammar pacing in the not-yet-built lesson-mix design (`2026-10-24-lesson-mix-design.md`). Default: it uses the normal grammar lesson slot.
- Where the conjugator lives (compile-time in the pipeline vs runtime in `mobile/src/core/content/`) and the table component design. Note `inflection_stem()` in `curriculum/_build/generate_content/spans.py` is mirrored in `scripts/compile-curriculum.ts`.
- What happens to the existing "Conjugated forms" section once the table exists (replace for verbs/adjectives, or keep). Suggested: the table replaces it for words that get a table.
- Furigana on table cells: follow the page's existing furigana behaviour.
- Verification: a unit test that runs the conjugator over every verb and adjective at every level; cross-check against the conjugated surfaces already present in compiled example spans; explicit cases for every irregular in §4.
