# Grammar SRS — Read + Build cards

**Date:** 2026-10-13
**Status:** Plan 1 (pipeline) done; Plans 2–3 not started
**Replaces (review side):** Plans 07, 08 and 10 in `docs/feedback/` (cloze contract, MC → type-in ladder, hint ladder). Plan 09 content (cloze variants) is reused as sentence source.

---

## 1. Problem and intent

The learner uses the app daily. Radicals, kanji and vocabulary reviews work. Grammar reviews do not:

- **Guessing, not knowing.** The cloze card (`今日は寒い＿＿＿。` → `から`) can be passed from sentence context or from the 4 MC options without recall.
- **Can't read it.** No card shows a full sentence and asks what the grammar means.
- **Can't use it.** No card makes the learner build a sentence from an idea.

**Success:** grammar reviews test (1) recall of what a grammar point means inside a real sentence and (2) producing a full sentence with it — both auto-graded offline, with no multiple choice and no hints to lean on.

**Constraints:** offline-first (no AI grading); `Result<T, AppError>` for fallible ops; no writes to `curriculum.db` at runtime; lesson order of words does **not** change.

---

## 2. Decisions (locked in brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| D1 | Card structure | Two cards per grammar point (Read + Build), one SRS record, worst-of-both grade — same as kanji |
| D2 | Read card answer | Type the English meaning of the **highlighted grammar only**; auto-graded vs accepted meanings + user synonyms |
| D3 | Build card answer | Type the **full Japanese sentence** — kana, kanji, or a mix: each furigana-annotated word accepts its kanji or its reading; vocabulary list (dictionary form) + polite/plain tag always shown |
| D4 | Wrong-but-valid Build answer | "My answer is correct too" saves the answer for that sentence and regrades to correct |
| D5 | Hints | **None** on either grammar card |
| D6 | Other same-family grammar on Build | Non-terminal retry nudge, no penalty, does not name the target |
| D7 | Cards per stage | Both cards at every stage; MC, cloze display and the English gate at Enlightened are removed |
| D8 | Sentence pool | ≥ 8 sentences per grammar point; every sentence valid for both cards |
| D9 | Repeats | The two cards in one review use different sentences; no sentence from the previous review is reused |
| D10 | Vocab range (authoring) | The existing pipeline rule `generate_content/context.allowed_vocab_for`: all lower-level words + same-level words up to a proportional cutoff + the point's own linked words + `CORE_SEED_SLUGS` (~85 survival words). A simulated lesson position was rejected: earlier pipeline work found it leaves the first point 1 word and ~100 of 161 points before their own linked words |
| D11 | Word links | Per-word linked renderer (tap → detail page, long-press → furigana toggle, per-word mastery furigana) on both cards |
| D12 | Link timing | Read card: every vocab word tappable at all times; grammar span locked until answered. Build card: words the learner has **started** link only after answering; words **not started** link before answering, with no grade penalty |

---

## 3. What the learner sees

### 3.1 Read card

- One Japanese sentence. The grammar span is highlighted (grammar accent token) and not pressable until the card is answered.
- Every vocabulary word is a linked span (D11). Furigana is per word, keyed on that word's mastery.
- Prompt: "What does the highlighted grammar mean?" English text input.
- Grading: existing meaning evaluator — accepted meanings (curriculum `accepted_answers` rows + `deriveMeaningCandidates(displayMeaning)`) + user synonyms, with the existing typo tolerance.
- Wrong: reveal shows the English sentence, the grammar meaning and structure. The existing **Add as synonym** button saves the rejected answer as a synonym on the grammar item (works for every sentence of that point).
- Mode label: `Grammar · Read`.

### 3.2 Build card

- English sentence, a vocabulary list of the sentence's words in dictionary form (e.g. `寒い・コート・着る`), and a `polite` / `plain` tag.
- Vocabulary list renders per-word furigana by mastery, so a not-yet-learned word always shows its reading.
- Links per D12. Before answering, a word the learner has started is plain text; a word not started is a link.
- Existing `WanaKanaInput` (romaji → kana; kanji typed with the system Japanese keyboard passes through unchanged). Return / **Check** submits.
- Grading (see §5.2): correct, `other_grammar` nudge (non-terminal), or incorrect. No typo tolerance.
- Wrong: the correct sentence (kanji + furigana, linked renderer) under the learner's answer, then the normal incorrect flow. Button **My answer is correct too** saves the answer and regrades the card to correct.
- After any terminal result, every word in the list and the revealed sentence is a link.
- Mode label: `Grammar · Build`.

### 3.3 Both cards

- Pair handling as kanji: per-card retry on wrong; one FSRS write with `combinePairGrades` when both cards are terminal.
- No hint control on grammar cards. Grammar grades are Again or Good only.
- Opening a detail page pushes the existing detail route on top of the review stack. Back returns to the same card with typed text intact.

---

## 4. Content

### 4.1 Sentence pool

Per grammar point, the pool is its `example_sentences` rows. Sources, in order:

1. Existing example sentences that pass §4.4.
2. Existing cloze variants with the blank filled (`jp_cloze` + `answer`), converted to example sentences, that pass §4.4.
3. New sentences written until the point has ≥ 8 passing sentences.

Because pool sentences are ordinary example sentences, lessons and Browse show them too.

### 4.2 Derived by the pipeline (no authoring)

| Field | Source |
|-------|--------|
| Word spans | `curriculum/_build/generate_content/spans.py`, plus **stem spans** on pool sentences (行き of 行きましょう, 早く): one token, same stem invariant, stored with `inflection = NULL` so the app shows "a conjugated form of 行く" |
| Grammar span (start/end) | Cloze-derived: blank position. Authored `form`: its position; anchor syntax `form="今日|は"` locates `今日は` and highlights only `は` (text before `|` is context only, and stays a normal word). Otherwise: longest match of an `accepted_forms` entry |
| Build answer | The sentence's `furigana` itself — the main accepted answer. No separate kana column |
| Vocabulary list | Dictionary forms of the sentence's span vocabulary, in sentence order |
| Register tag | `polite` when the main clause ends in a です/ます form, else `plain` |

### 4.3 Authored (Gemini web lane + validator)

- **Accepted meanings:** 3–6 English answers per grammar point (e.g. `because, since, so, as`; particles state function, e.g. `object marker`). Stored as `accepted_answers` rows, `answer_type = 'meaning'`.
- **Sentences:** new / replacement sentences with English and furigana until §4.4 passes.
- **Alternate Build answers** per sentence, authored as plain Japanese (e.g. `寒いですから、コートを着ます`) — the build adds the furigana notation — each tagged `valid` (other word order, dropped 私は, ですから for から…) or `other_grammar` (same meaning with another grammar point of the same `family`).

### 4.4 Validator rules (compile fails on any)

1. Every sentence has a grammar span.
2. Every token tagged noun, verb, adjective, na-adjective, adverb, pronoun or adnominal, outside the grammar span, lies inside a word span (a Build-card learner cannot write a word they are not shown).
3. No out-of-range content word: `level_check.find_violations(sentence, build_allowed_index(allowed_vocab_for(level, slug)), accepted_forms)` is empty.
4. A grammar point has ≥ 8 passing sentences.
5. Variety: no two sentences of a point share the same set of vocabulary; the point's sentences cover ≥ 2 of {statement, question, negative, past} where the grammar allows (exemptions listed per point in the pipeline).
6. Every alternate parses as furigana notation and contains every listed word **except pronouns** (代名詞 — 私, あなた, 彼…, which natural Japanese drops). Every `valid` alternate contains the grammar chunk. Every `other_grammar` alternate equals the main sentence or a `valid` alternate with the grammar chunk, **at the grammar position**, replaced by a same-family form (any level up to the current one).
7. Every grammar point has ≥ 3 accepted meanings.

---

## 5. App code

### 5.1 Data

**`curriculum.db`** (compile output; rebuilt, not migrated):

- `example_sentences` + nullable columns: `grammar_start`, `grammar_end`, `register` (`'polite' | 'plain'`). Set only on grammar rows. The existing `furigana` column is the main Build answer.
- New `grammar_sentence_answers (id, sentence_id → example_sentences, answer_furigana, kind CHECK(kind IN ('valid','other_grammar')))`.
- Grammar meanings in `accepted_answers`.
- `grammar_cloze_variants` dropped.

**`user.db`** — migration `021`:

- `user_grammar_answers (sentence_id INTEGER, answer_text TEXT, created_at TEXT, PRIMARY KEY (sentence_id, answer_text))` — stored as typed (kana and/or kanji), normalised as below.
- `grammar_sentence_history (item_id TEXT PRIMARY KEY, sentence_ids TEXT, updated_at TEXT)` — JSON array of the last review's two sentence ids.
- Both tables included in backup export / import / validator, like `user_synonyms`.
- Existing grammar `srs_states` rows untouched.

### 5.2 Core logic (pure, unit-tested)

- `core/grammar/sentencePicker.ts` — `pickGrammarSentences(pool, lastIds, rng) → { read, build }`: two distinct sentences, excluding `lastIds`. Precondition, guaranteed by validator rule 4: pool ≥ 8 and `lastIds` ≤ 2, so ≥ 6 candidates always remain. No fallback path.
- `core/grammar/buildEvaluator.ts` — `evaluateGrammarBuild(input, { answers, otherGrammarAnswers, userAnswers }) → 'correct' | 'other_grammar' | 'incorrect'`.
  - Normalise input and every expected text: katakana → hiragana, strip whitespace and punctuation (`、。！？!?,. ` and full-width space).
  - Curriculum answers (`answers`, `otherGrammarAnswers`) are furigana notation, parsed with the existing `parseFurigana`. Each annotated segment matches its base text **or** its reading; plain segments match their normalised text. Segments match independently, so kanji and kana can mix (`寒いから、コートをきます`). A different word (僕 for 私) does not match.
  - User answers match by exact normalised text.
- `core/srs/pairGrading.ts` — unchanged (`combinePairGrades`).
- `core/grammar/linkPolicy.ts` — `isWordLinked({ card, answered, wordStarted }) → boolean` (D12).

### 5.3 Queue and session

- `queueBuilder`: grammar items expand to a two-card pair — Read (`promptType: 'meaning'`) and Build (`promptType: 'production'`), `isTwoCardItem: true`. Pair truncation logic applies unchanged.
- `ReviewSessionProvider`: pair grade slots keyed by the card's `promptType` (`meaning` | `reading` | `production`) instead of the hard-coded `meaning` / `reading` pair; the pair is complete when two distinct prompt types are recorded. Kanji, vocabulary and grammar share one path. `peekStageTransition` follows.
- `useReviewQueue`: load the pool, history and user answers; call `pickGrammarSentences`; attach `grammarRead` / `grammarBuild` payloads (sentence, spans, grammar span, English, vocab list, register, answers) to the `ReviewItem`. Write `grammar_sentence_history` when the pair's FSRS write happens.
- `ReviewItem`: remove `clozePrompt`, `clozeAnswer`, `clozePromptFurigana`, `clozeNudge`, `clozeEnglish`, `inputMode`, `mcOptions`; add the two payloads.
- "My answer is correct too": insert into `user_grammar_answers`, then regrade the current card as correct (same forced path as Add as synonym).

### 5.4 UI

- Extract the linked-word renderer from `components/learn/ExampleSentencesSection.tsx` into `components/common/LinkedSentence.tsx` with props `grammarSpan?: { start; end; locked: boolean }` and `isLinked(vocabularyItemId) → boolean`. `ExampleSentencesSection` uses it unchanged in behaviour.
- New `components/review/GrammarReadCard.tsx`, `components/review/GrammarBuildCard.tsx`; `ReviewCard` routes grammar items to them.
- `IncorrectReveal`: Build variant with **My answer is correct too**; Read uses the existing synonym path.
- Semantic tokens only; a11y labels on every linked word and on the locked grammar span.

### 5.5 Removed

`core/grammar/inputMode.ts`, `core/grammar/distractors.ts`, `components/review/GrammarMcOptions.tsx`, the grammar branch of the hint ladder (`ProgressiveHint` / `hintLevels` grammar use), the cloze display path, and `clozeBuilder.ts` / `nearMiss.ts` once nothing imports them. Tests for removed code go with it.

---

## 6. Testing

- **Unit:** `evaluateGrammarBuild` (all-kana, all-kanji, mixed per segment, katakana ↔ hiragana, wrong kanji word rejected, valid alternates, `other_grammar`, user answers with kanji, punctuation), `pickGrammarSentences` (distinct, excludes last review), `isWordLinked` (all D12 cases), pair grading for a grammar pair (Read wrong + Build right → Again).
- **Component:** `GrammarReadCard` (locked grammar span, links, synonym), `GrammarBuildCard` (link timing before/after answer, nudge non-terminal, save-answer regrade), `ExampleSentencesSection` regression after extraction.
- **Migration:** `021` up on a populated `user.db`; backup round-trip with the two new tables.
- **Pipeline:** one test per validator rule in §4.4; derived-field tests (register, grammar span, vocabulary list).
- **Manual (simulator):** full grammar pair in a review session; word tap → detail → back with text intact; save-answer then same sentence later graded correct.

---

## 7. Out of scope

- Changing the lesson order of words or grammar (N5 grammar is taught before the basic verbs; handled here by the core set + links).
- A live per-user sentence filter by vocab progress.
- AI / network grading.
- Grammar-to-grammar confusion clusters beyond the `other_grammar` nudge.
- N3+ grammar (no grammar content exists).

---

## 8. Risks

- **Content volume:** 161 points × ≥ 8 sentences plus alternates. Many existing cloze sentences repeat one frame and will fail variety. Expect most points to need new sentences.
- **Wording-exact grading:** an answer correct in meaning but different in wording is marked wrong until saved. Mitigated by authored `valid` alternates and D4.
- **Range vs real progress:** the proportional cutoff allows more words than a learner has started (point 10 of 74 → ~97 words vs ~20 started). Covered at runtime by D12 (unstarted words show furigana and link before answering).
