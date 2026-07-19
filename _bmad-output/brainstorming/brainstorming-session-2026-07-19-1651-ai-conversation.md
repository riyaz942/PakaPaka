---
stepsCompleted: [1, 2, 3, 4]
session_active: false
workflow_completed: true
inputDocuments:
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-19-1322-learn-page.md'
session_topic: 'AI Conversation tab — BYOK chat + push-to-talk conversation practice grounded in the user''s own SRS progress'
session_goals: 'A spec-able design for a page that does not exist yet: session list UX, session-start flow, chat vs conversation modes, BYOK provider config, local TTS, and integration with existing curriculum/SRS data'
selected_approach: ''
techniques_used: []
ideas_generated: []
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Riyaz
**Date:** 2026-07-19

> Fourth in the page-by-page series, and the first for a page that **does not exist
> yet**. Prior sessions: item details (`...-1322.md`), learn page
> (`...-1322-learn-page.md`), review page (`...-1628.md`, running in parallel).

## Session Overview

**Topic:** A new **AI Conversation** tab — converse with an LLM in Japanese, grounded
in what the user has actually learned, with bring-your-own-key providers and local TTS.

**Goals:** Land on a spec-able design. Because nothing ships today, this session must
also decide what is v1 and what is later — the other sessions ranked existing work,
this one has to draw a boundary.

### Session Setup

Initial thinking brought to the session:

1. **Converse with AI based on what you are learning/learned** — or pick the grammar
   you want to practise.
2. **Bring your own key** — OpenRouter, Anthropic, OpenAI, or Hugging Face.
3. **Local TTS, not AI TTS** — a natural-sounding open-source/on-device voice, so the
   key is spent on text conversation only. Primary cost-saving lever.
4. **Integrated with app data** — long-press a vocabulary word the AI used to jump to
   its details page (carried over from an earlier session).
5. **ChatGPT-style shell** — a list of past sessions, "new session" button top-right
   (UX placement open).
6. **Session start flow** — offer "you recently finished this grammar, practise it?",
   or pick grammar manually, or role-play a scenario (list or random).
7. **Two modes** — *chat* (typed) and *conversation* (push-to-talk, Gemini-Live-like,
   chat UI hidden). Exiting conversation mode drops the user back into chat with the
   full transcript of what was just spoken.

### Codebase Reality Check (verified before ideating)

| Thing this feature needs | Status today |
| --- | --- |
| **Secure key storage** | **Ships.** `data/user/credentialStore.ts` wraps `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` and returns `Result`. Keyed off `IMPORT_CREDENTIAL_KEYS` (wanikani/bunpro/anki) — needs a parallel key set for LLM providers, not a new mechanism. |
| **Streaming HTTP** | **Available, unused.** Expo SDK ~55 / RN 0.83 → `expo/fetch` supports streaming responses (SSE), which RN's default XHR-backed `fetch` does not. No streaming code exists in the app yet. |
| **TTS / audio** | **Nothing.** No `expo-speech`, no `expo-audio`/`expo-av`, zero audio code in `mobile/src`. Both TTS *and* mic capture are new dependencies. |
| **Mic / speech-to-text** | **Nothing.** Push-to-talk implies STT, which the initial thinking does not name a source for — open question, and the biggest hidden cost in the proposal. |
| **Long-press interaction** | **Zero `onLongPress` handlers in the entire app.** This is a brand-new interaction idiom (and a discoverability + a11y question — `eslint-plugin-react-native-a11y` is enforced in CI). |
| **"What the user has learned"** | **Ships.** `item_study_status(item_id, status, updated_at)` and `srs_states(item_id, …, updated_at, srs_stage_label)` both carry timestamps → "recently finished X" is derivable. |
| **"Recently finished this grammar"** | **Derivable, but not from the obvious place.** `daily_lesson_log` stores only `(date, items_started)` — a count, no item ids. The recency signal must come from `item_study_status.updated_at` / `srs_states.updated_at`. |
| **Grammar content for prompting** | **Rich.** Each grammar item ships `primary_form`, `meaning`, `structure`, `conjugation_rules`, `accepted_forms`, and `example_sentences` with `furigana` + `vocabulary_slugs`. Excellent raw material for a system prompt. |
| **Chat persistence** | **None.** Sessions/messages need new `user.db` tables. Migrations run to **014**; note the learn-page session already earmarked `015_furigana_overrides`. |
| **Tabs** | Home, Learn, Read, Stats, Settings (`app/(tabs)/`). A sixth tab is a shell decision, not just a new route. |

**Headline:** the opposite shape to every prior session. Those found *shipping data with
no UI*; this one is **all new surface, new dependencies, and the first place the app
talks to a third party at runtime, costs the user money, and can be wrong.**

## Technique Selection

**Approach:** AI-Recommended

- **Role Playing** (collaborative) — worked well in the details-page session and fits
  here: the design lives or dies on two moments (first open, and the first thing the
  AI says). Play them rather than specify them.
- **Competitor Teardown** — ChatGPT, Gemini Live, and Duolingo Max have already solved
  the session-list shell and the push-to-talk affordance. Steal the solved parts;
  spend the thinking on what is unique to this app.
- **Solution Matrix** (structured) — the v1 boundary is the real deliverable. Grid the
  parts against new-dependency cost vs learner value so push-to-talk gets an honest
  verdict instead of riding along with the cheap stuff.

**Explicitly not Question Storming** — failed twice with this user on 2026-07-19; he
builds on concrete proposals rather than opening question space.

## Phase 1 — Role Playing

### Scenario 1 — first open, three weeks in

_Setup: N5 learner, ~40 kanji and ~12 grammar points at apprentice/guru. Taps the new
tab for the first time._

#### Friction 1 — three screens before a single word of Japanese

The proposed flow is session list → new session → pick a start → pick a mode → talk.
ChatGPT is one tap; Duolingo Max drops straight into the scene.

**[Decided 1.1] — the empty state *is* the picker.** No empty session list. Opening the
tab asks how you want to start (recent grammar / choose grammar / role-play / random).
History moves to a **top-corner entry point** that opens the list of past conversations,
revisitable. The list is a secondary surface, not the front door.

**[Idea 1.2] — mode leaves the start flow.** Chat is the default; a mic button in the
composer promotes to conversation mode at any time. Removes a whole screen and makes
push-to-talk a mid-session gear change rather than an up-front commitment.

**[Idea 1.3] — the top row of the start picker is a live suggestion**, sourced from
`item_study_status.updated_at` / `srs_states.updated_at`: "You finished ～てもいい
yesterday — practise it?" One tap from open to talking.

#### Friction 2 — the beginner lexicon problem

A stock LLM told "converse at N5" produces fluent, plausible Japanese full of words this
user has never seen. Every reply is a wall of unknowns — the failure mode that makes
general AI chat useless for beginners. This app is unusual in knowing *exactly* which 40
kanji and which 12 grammar points the user holds.

LLMs are unreliable at hard lexical constraints — they drift by turn four on any
provider. So the design question is what happens **when** it breaks, not whether.

| Posture | Behaviour | Verdict |
| --- | --- | --- |
| Enforce | Detect out-of-lexicon words, regenerate | Rejected — doubles tokens, slow, flattens range |
| **Flag** | Let it drift, mark unknown words visually | **Chosen** |
| Exploit | Flagged words become "add to lessons" — conversation feeds the SRS | Live extension of Flag |

**[Decided 1.4] — Flag.** Cheap (local lookup against the vocabulary table, zero token
cost) and it **solves the long-press discoverability problem for free**: today nothing
on screen would tell a user that long-press does anything. A marked word is a visible
affordance.

**[Decided 1.5] — turn budget instead of a hard lexical limit (user-originated).**
The system prompt carries a target length — "wrap up this role-play in ~40–50 turns" —
rather than a hard constraint. Dynamic, scaled to the user's level and how much
vocabulary/grammar they have completed.

_Why this is stronger than it first looks_: it does three jobs at once — gives a
role-play narrative shape and an actual ending, bounds the context window (so token cost
per session stays roughly predictable), and gives BYOK users a **cost ceiling they can
reason about**, which is the single biggest anxiety of a bring-your-own-key feature.

#### Segmentation — how do you flag a word when Japanese has no spaces?

私は学生です is five tokens with no delimiters, and nothing in the app segments Japanese
today (`wanakana` converts kana only; it does not tokenize).

| Option | Verdict |
| --- | --- |
| (a) Dictionary longest-match against the shipped vocabulary table | **Rejected as a fallback** — see 1.7 |
| (b) `kuromoji.js` morphological analyzer | Rejected — ~20MB dictionary in an RN bundle |
| **(c) The AI emits pre-segmented text** | **Chosen** |

**[Decided 1.6] — the AI replies in the curriculum's own furigana bracket format.**
`私[わたし]は学[がく]生[せい]です。` is already what `curriculum/grammar/*.json` ships and
already what `FuriganaText` renders.

_Why this is the breakthrough of the phase_: one format choice collapses four problems.
Segmentation, readings, furigana display, and tap-to-toggle all arrive free, rendered by
a component that already exists — and the AI's Japanese then obeys the furigana model
the learn-page session just settled (keys on vocabulary, hides at guru+). **AI output
becomes a first-class citizen of the app rather than foreign text in a bubble.**

**[Decided 1.7] — no fallback. If the format parse fails, it fails.** The facilitator
proposed dictionary longest-match as a safety net; Riyaz rejected it. Consistent with
this user's pattern across all four sessions — the corrections are always
simplifications. One code path, one format, no second-guessing layer whose failure modes
nobody can reason about.

_Open_: "fails" still needs a defined user-visible behaviour — most likely render the
reply as plain text with no flags and no furigana, rather than showing an error.

#### The ending

**[Decided 1.8] — the turn budget is a *steer*, not a stop.** Around turn ~50 the AI
starts winding the scene down and says its goodbyes naturally. No hard cutoff, no
"session limit reached" wall.

**[Idea 1.9] — end-of-session summary.** The payoff screen, and the bridge back into the
SRS.

**[Decided 1.10] — the AI never corrects mid-conversation; correction is deferred to the
summary.** Every language app breaks the scene to explain a particle, which is what makes
them feel like a test. Never correcting is worse — a beginner reinforces mistakes for 50
turns. The summary resolves it: the AI stays in character for the entire scene, then
takes the costume off at the end. Flow preserved, feedback delivered, and it costs one
extra call at session end instead of bloating every turn.

**[Decided 1.11] — summary contents**, in priority order:

1. **Mistakes worth fixing** — 3–5 maximum, role dropped
2. **Words you met** — split by curriculum membership (see 1.12)
3. **The grammar you were practising** — did you actually use it, and how often

**[Idea 1.12] — out-of-lexicon words split two ways, and the split is the feature.**

| Word the AI used | Meaning | Summary offers |
| --- | --- | --- |
| **In curriculum, not yet studied** | Real item with an `item_id`, mnemonic, examples — user just hasn't reached it | Tap through to its details page |
| **Not in curriculum at all** | Off-syllabus, no id, no content | Show and translate; nothing more |

_Why row 1 matters_: the AI drifting slightly ahead of the user's level becomes a
feature — "you met 帰る today, you'll learn it in a few lessons" links into content that
already ships. Comprehensible input feeding the **existing** curriculum graph.

**[Constraint 1.13] — AI-encountered words can never enter the SRS directly.** Every SRS
row is keyed to a curriculum `item_id`. User-generated items would fork the content model
the whole app rests on. Row 2 above is a display-only dead end by design.

#### How a session ends (decided)

**[Decided 1.14]** Three exits, two outcomes:

| Exit | Trigger | Summary? |
| --- | --- | --- |
| **AI-initiated** | The model signals "I'm wrapping up" → app catches it and shows a popup containing an **End session** button | Yes |
| **User-initiated** | **End session** button, always present in the header | Yes |
| **Abandoned** | User navigates away from the screen | **No** — session closes silently |

_Note the consequence_: an abandoned session is persisted but un-summarised.

**[Idea 1.15] — the summary is a generated-on-demand artifact of any session.** The
transcript persists either way and history is browsable, so an abandoned session can be
opened later and summarised then. Generate once, cache in `user.db`, never regenerate.
Settles automatic-vs-on-demand: it is **always** on demand, so the user never pays for a
summary they didn't ask for, and abandoning becomes "not yet summarised" rather than lost.

## Phase 2 — Provider abstraction (BYOK)

### 2.1 The wrapper normalises transport, not capability

**[Decided 2.1]** A provider wrapper is unavoidable. What it must normalise:

| Concern | Why it differs |
| --- | --- |
| Auth | `x-api-key` vs `Authorization: Bearer` |
| System prompt | Anthropic takes a top-level `system` field; OpenAI takes a `system` role message |
| Streaming events | All SSE-flavoured, different event shapes and delta keys |
| Errors / rate limits | Different status codes and body shapes |
| Usage accounting | Different field names — required for the cost ceiling (1.5) |

All transport. Returns `Result<T, AppError>` per the project convention.

### 2.2 Tool calling rejected in favour of a text sentinel

**[Decided 2.2] — no normalised tool-call layer.** Tool support is a *capability*, not
transport, and it is not reliable across the target providers: Anthropic and OpenAI have
it; OpenRouter depends entirely on which model the user routed to; Hugging Face endpoints
frequently don't. Since the **user** picks provider *and* model, normalising it means
shipping two code paths where the one that executes depends on a choice the developer
never sees. Same shape as the segmentation fallback rejected in 1.7.

**The specific argument:** tool calling earns its complexity on a *round trip* — call,
get a value, continue. Ending a scene is one-way. No round trip, no gain. Meanwhile a
sentinel joins the parser already being written for the furigana brackets and arrives in
the same text stream.

**[Decided 2.3] — hidden structured responses as the general protocol.** The AI emits
in-band markers the app catches, acts on, and **strips before rendering**. The scene
ending is the first use: the model signals it is wrapping up, the app treats the session
as finished and raises the end-of-session popup. Three tokens, works on every provider
including a raw completion endpoint.

**[Deferred boundary 2.4]** If the AI later needs to *look up* a vocabulary item or read
live SRS state mid-conversation, those are genuine round trips and tool use would earn
its keep. Not v1.

### 2.3 Four providers are really two wire formats

**[Decided 2.5] — two adapters, not four.**

| Adapter | Covers |
| --- | --- |
| **OpenAI-compatible, user-editable base URL** | OpenAI, OpenRouter, Hugging Face TGI — and for free, LM Studio / Ollama running locally |
| **Anthropic** | The only genuinely different wire format |

_Why this is more than a saving_: the editable base URL lets users point at providers
that don't exist yet without shipping code, and "point it at your own local model" fits
this app's offline-first, no-accounts, no-subscriptions posture unusually well.

## Phase 3 — Push-to-talk, TTS and STT

### 3.1 Conversation mode needs two new capabilities, not one

The initial thinking names **TTS** and costs it correctly (local voice, key spent on text
only). It never names a source for **STT**, which is the expensive half:

- **Cloud STT** (Whisper via the user's key) reintroduces exactly the cost that avoiding
  AI TTS removed — audio in is typically pricier than text.
- **On-device STT** is free but inherits whatever the platform gives you.

**[Risk 3.1] — recognisers are trained on native speakers.** A three-week learner has
wrong pitch accent and vowel length. The recogniser returns *confident, fluent-looking
Japanese that isn't what they said*, the AI replies to a sentence never uttered, and the
learner cannot tell whether the fault was their pronunciation or the machine's. Worst for
exactly the users who need it most. No amount of UI fixes this — but it can be made
honest (3.2).

**[Decided 3.2] — transcription lands in the composer, not straight into the wire.**
Release push-to-talk → recognised text appears → user confirms, edits, or clears and
retries → then it sends. Less magical than Gemini Live, but the user always knows what
the machine heard.

_Second benefit_: it makes exiting conversation mode trivial. Every spoken turn was
already confirmed text, so the chat log is exact — no reconciliation between "what was
said" and "what was logged". **Conversation mode is the same data structure with a mic on
the composer**, not a separate universe.

**[Decided 3.3] — conversation-mode layout: one exchange, not a transcript.**
Full screen, chat history hidden. On screen: the AI's latest line (readable, since the
user may not catch it spoken) + the user's latest transcription, push-to-talk below.
Send, edit as text, or clear and retry. Everything accumulates into the chat log revealed
on exit.

### 3.2 TTS/STT library options

| Option | Finding |
| --- | --- |
| `expo-speech` | System engine. Free, offline, one dependency. iOS Japanese decent; **Android is the risk** — quality varies by device and Japanese voice data may not be installed. |
| `react-native-tts` | Wraps the *same* OS engines (AVSpeechSynthesizer / Android TextToSpeech). Different API, **no quality gain**. |
| `@mhpdev/react-native-speech` | npm returned 403 during the session. Believed to be another system-engine wrapper — unverified. |
| **`react-native-executorch`** | The genuinely different one: on-device neural, Kokoro-82M, Apache 2.0, zero cost after model download. **Blocker: the SWM article never mentions Japanese, and RN exposes only 8 of 62 voices.** Kokoro's Japanese needs a Japanese phonemizer, the hard part to port. |

### 3.3 Investigation results — `react-native-executorch` (subagent, source-verified)

**[Finding 3.5] — Kokoro has no Japanese, and it is a compile-time block.**
`TextToSpeechLanguage` in v0.9.2 is a 9-language union (`en-us`, `en-gb`, `fr`, `es`,
`it`, `pt`, `de`, `pl`, `hi`) with no `'ja'`. The Kokoro HF repo ships exactly 9
phonemizer bundles and no `ja` one — Japanese is blocked on porting misaki/fugashi
(Python + MeCab) to C++, not on the acoustic model. No open issue even asks for it.

**[Finding 3.6] — but Supertonic 3 changes the answer.** A second TTS model with
`'ja'` in its language union exists on `main` (absent from the v0.9.2 tag). Landing in
**0.10.0**; a nightly dist-tag exists. **Riyaz listened to Supertonic's Japanese and
wants it** — this becomes the target rather than a maybe.

**[Finding 3.7] — Whisper STT does support `ja`**, via a multilingual variant with
`{ language: 'ja' }` and a streaming API around the 30s window. Model sizes are the tax
(Android builds are fp32, ~3× iOS):

| Model | Android | iOS |
| --- | --- | --- |
| whisper-tiny | 232.6 MB | 76.8 MB |
| whisper-base | 398.7 MB | 146.6 MB |
| whisper-small | 1128.7 MB | 485.3 MB |

Tiny's Japanese WER is poor — learner pronunciation needs `small`.

**[Finding 3.8] — the platform floor is the hidden cost.** executorch requires
**iOS 17 / Android 13 (API 33)** and New Architecture. RN 0.83 is supported; works with
dev-client/prebuild, never Expo Go; no Expo config plugin (autolinking + a manual
`metro.config.js` `assetExts` edit). Release iOS builds can't target the simulator.
v0.9.2, 1662 stars, 79 open issues, healthy cadence. **The Android 13 minimum deserves a
product decision of its own** — it conflicts with offline-first positioning independent
of this feature.

**[Finding 3.9] — `expo-speech` on Android fails silently.** iOS `ja-JP` (Kyoko) is
built in and reliable. On Android, Japanese voice data is user-downloadable and if absent
`Speech.speak` **produces no sound and does not throw** ([expo/expo#7260]). Worse than an
error — the user concludes the app is broken. Any use requires
`getAvailableVoicesAsync()` filtering plus an explicit install prompt.

**[Finding 3.10] — `@jamsch/expo-speech-recognition`** wraps the platform recognisers,
has a real Expo config plugin, `supportsOnDeviceRecognition()` and
`androidTriggerOfflineModelDownload()`, and adds ~0 MB. Same iOS 17 / Android 13 floor
for *on-device*, but falls back to cloud recognition on older devices. `ja-JP` support is
a runtime `getSupportedLocales()` query — unverified.

### 3.4 Decisions

**[Decided 3.11] — push-to-talk is out of v1.** Both halves depend on unshipped or
expensive dependencies.

**[Decided 3.12] — Supertonic 3 is the TTS target, gated on executorch 0.10.0.**
Not Kokoro, not `expo-speech`.

**[Decided 3.13] — no interim `expo-speech`.** Consistent with 1.7: shipping the system
voice now means adopting the Android silent-failure trap and then ripping it out when
Supertonic lands. Since TTS is only genuinely needed for conversation mode — which is out
of v1 — **v1 ships with no audio at all.**

**[Decided 3.14] — STT rides on the same dependency.** Once executorch is in the app for
Supertonic, the Android 13 floor is already paid, so Whisper STT costs one dep instead of
two. Riyaz accepts a one-time `whisper-small` download. `@jamsch/expo-speech-recognition`
stays the alternative if Whisper underperforms on learner pronunciation.

**[Decided 3.15] — cloud Whisper is a user-visible setting, not a hidden fallback.**
If on-device accuracy disappoints, the user may opt into cloud STT via their key. An
explicit choice with a known cost — not an automatic code path (see 1.7).

## Phase 4 — Shell, key setup, v1 boundary

**[Decided 4.1] — the tab is always visible, key or no key.** Discoverability is the
point: the user should see the app has an AI feature. Unconfigured, the tab opens a setup
screen instead of the start picker.

**[Decided 4.2] — key entry lives in both places.** First-run setup inside the
Conversation tab; ongoing management in Settings, alongside the existing import
credentials. Storage extends `credentialStore.ts` with an LLM provider key set.

**[Context 4.3] — the Read tab is being removed**, so this is a swap, not a sixth tab.
The shell stays at five.

## Idea Organization and Prioritization

### Themes

**Theme 1 — Make the AI's Japanese a first-class citizen of the app.**
1.4, 1.6, 1.12, 1.13. The AI replies in the curriculum's own furigana bracket format, so
its output renders through `FuriganaText`, obeys the vocabulary-keyed furigana model, and
its words resolve against real `item_id`s. The AI is not a chatbot bolted onto a learning
app — it emits app content. This is the spine of the whole design.

**Theme 2 — One code path, no hidden fallbacks.**
1.7, 2.2, 2.3, 3.13, 3.15. Rejected in this session: a segmentation fallback, a
normalised tool-call layer, an interim TTS engine, an automatic cloud-STT switch. The
consistent rule that emerged — **a second path whose selection depends on something the
developer can't see is a path that never gets tested.** Where a choice is genuinely
needed, it becomes a visible user setting instead.

**Theme 3 — Cost is a design material, not an implementation detail.**
1.5, 1.15, 2.5, 3.12. BYOK means the user pays per token, so cost shapes the product: the
turn budget is a ceiling, the summary is on-demand so nobody pays for one they didn't
want, local TTS keeps the key for text only, and the editable base URL lets a user point
at a free local model.

**Theme 4 — Defer everything that needs a dependency you don't have.**
3.11–3.14. Chat needs `expo/fetch` (already there) and new tables. Voice needs an
unreleased model, a 1.1 GB download, and an iOS 17 / Android 13 floor. The v1 line falls
exactly where the dependency graph says it should.

### Breakthrough concepts

**B1 — The AI speaks the curriculum's furigana format (1.6).**
One format choice collapses four problems: Japanese word segmentation (no spaces, no
tokenizer in the app), reading annotation, furigana display, and tap-to-toggle. All of it
falls out of a component that already ships. It replaced a choice between a 20 MB
morphological analyzer and a lossy dictionary matcher with a prompt instruction.

**B2 — Drifting slightly ahead of the learner is a feature, not a bug (1.12).**
Constraining an LLM's vocabulary is unreliable, so the design stops fighting it. Unknown
words get flagged, and the ones that exist in the curriculum become links into content
that already ships — "you met 帰る today, you'll learn it soon." Comprehensible input
feeding the existing dependency graph. It also solves long-press discoverability for
free, in an app with zero `onLongPress` handlers today.

**B3 — Correction deferred to the summary (1.10).**
Every language app breaks the scene to explain a particle, which is what makes them feel
like a test. Staying in character for the whole scene and taking the costume off at the
end preserves immersion *and* delivers feedback — for one extra API call instead of
bloating every turn.

**B4 — Four providers are two wire formats (2.5).**
OpenRouter and Hugging Face TGI are OpenAI-compatible, so an OpenAI adapter with an
editable base URL covers three of the four named providers plus Ollama and LM Studio.
Fewer adapters *and* more providers — including ones that don't exist yet.

### v1 boundary

> **Superseded in part** — see *Post-session revision* at the end of this document.
> Audio and conversation mode were pulled into v1 after Supertonic Japanese was
> confirmed in the executorch nightly.

| In v1 | Out of v1 |
| --- | --- |
| Chat mode, streaming via `expo/fetch` | ~~Conversation mode / push-to-talk (3.11)~~ **revised — now in v1** |
| Two adapters: OpenAI-compatible + Anthropic (2.5) | ~~All audio (3.13)~~ **revised — now in v1** |
| Key setup in-tab + Settings (4.2) | Tool-use round trips (2.4) |
| Start picker as the empty state; history in the top corner (1.1) | |
| Recent-grammar suggestion row (1.3) | |
| Furigana-format replies + unknown-word flagging (1.4, 1.6) | |
| Turn budget + in-band end signal + popup (1.5, 1.8, 1.14, 2.3) | |
| On-demand cached summary (1.11, 1.15) | |
| New `user.db` tables for sessions + messages | |

### Suggested build order

1. **Provider wrapper + key storage** — extends `credentialStore.ts`; nothing works
   without it, and it is testable with no UI.
2. **Session/message schema** — migration 016+ (015 is claimed by
   `furigana_overrides` in the learn-page session).
3. **Chat surface + streaming** — first end-to-end path.
4. **Furigana-format prompt + parser** — the spine (B1). Ship after chat works, so
   format failures are diagnosable against a known-good baseline.
5. **Unknown-word flagging + long-press to details** — depends on 4.
6. **Start picker, suggestion row, history list.**
7. **Turn budget, end signal, summary.**
8. **Later:** Supertonic 3 TTS on executorch 0.10.0 → Whisper STT → conversation mode.

### Open items

- **`react-native-executorch` 0.10.0 is unreleased.** Supertonic Japanese exists on
  `main` only. Re-check before planning voice work; audio quality confirmed by ear from
  the vendor demo, not on-device.
- **iOS 17 / Android 13 floor** — a product decision beyond this feature, in tension with
  offline-first positioning. Owned separately.
- **Parse-failure behaviour (1.7)** — "it fails" still needs a defined user-visible
  outcome. Most likely: render plain text, no flags, no furigana.
- **Turn-budget formula** — "dynamic, based on level and completion" is agreed in
  principle; the actual function is unspecified.
- **Scenario library** — role-play scenarios were agreed as a start option but never
  enumerated. New content work, unsized.
- **Whisper Japanese accuracy on learner pronunciation** — unverified, and it decides
  whether STT is executorch or `@jamsch/expo-speech-recognition`.
- **Long-press a11y** — the app's first `onLongPress`, and `eslint-plugin-react-native-a11y`
  is CI-enforced. Needs a non-gesture alternative.

## Session Summary and Insights

**Key achievements**

- A page that didn't exist has a v1 boundary drawn by dependency reality rather than
  ambition, and every deferred item has a named unblocking condition.
- The session's hardest technical problem — segmenting spaceless Japanese to flag
  unknown words — was solved by reusing a format the curriculum already ships (B1).
- A subagent investigation overturned the plan mid-session with source-level evidence:
  Kokoro has no Japanese and it's a compile-time block, but Supertonic 3 does, unreleased.
  The decision moved from "probably system TTS" to "wait for 0.10.0, ship no audio."
- Two silent-failure traps caught before they were designed in: `expo-speech` producing
  no sound on Android with no error, and tool-calling breaking invisibly for whichever
  provider a user happened to pick.

**Session reflections**

- **The no-fallback instinct held across four separate decisions** (1.7, 2.2, 3.13, 3.15)
  and proved to be a coherent principle rather than four preferences. It is now the
  session's most reusable output.
- **Checking before ideating changed the conclusion again**, as in all three prior
  sessions — this time the check was external rather than in the codebase, and it was the
  single highest-value action taken.
- **The user's corrections continue to be simplifications**, consistent with the
  details-page and learn-page sessions. Recommendation from those sessions — trust it
  earlier — was applied here and held.
- **This session inverted the series' usual finding.** The previous three found shipping
  data with no UI. This one is all new surface, and the discipline required was
  subtraction rather than discovery.


## Post-session revision — 2026-07-19

Riyaz reported Supertonic 3 as released. Verified during the session:

- **`'ja'` is present** in `TextToSpeechSupertonicLanguage` (`src/types/tts.ts:99`) in
  `react-native-executorch@0.10.0-nightly-a0bf85b-20260719`. The code is real.
- **npm `latest` is still 0.9.2.** There is no stable 0.10.0. The only route today is a
  pinned nightly, built daily off `main`.

### Revised decisions

**[Revised 3.11] — conversation mode / push-to-talk is IN v1.**
Supersedes the deferral.

**[Revised 3.12/3.13] — executorch enters v1 on a pinned nightly**, covering both halves:
Supertonic 3 for Japanese TTS and Whisper for Japanese STT. `expo-speech` is never
adopted, so the Android silent-failure trap (3.9) is avoided entirely rather than
mitigated — Supertonic ships its own model instead of depending on user-installed voice
data.

**[Unchanged]** 3.2 (transcription confirms in the composer before sending), 3.3
(one-exchange conversation layout), 3.15 (cloud STT stays an explicit user setting, never
an automatic fallback).

### Costs accepted with this reversal

| Cost | Detail |
| --- | --- |
| **Pinned nightly dependency** | A dated build off `main`, no semver guarantee, no release notes. Upgrades are manual and must be re-verified. |
| **iOS 17 / Android 13 floor lands in v1** | Previously deferrable; now a launch constraint. Still in tension with offline-first positioning (see Open items). |
| **whisper-small ≈ 1.1 GB on Android** (485 MB iOS) | One-time runtime download, accepted by Riyaz. Smaller variants have poor Japanese WER. |
| **Unverified STT accuracy on learner pronunciation** | Risk 3.1 is now a v1 risk rather than a future one. `@jamsch/expo-speech-recognition` remains the alternative; cloud Whisper the opt-in setting. |
| **No Expo Go** | dev-client/prebuild only, plus a manual `metro.config.js` `assetExts` edit. Already true for this project. |

### Revised build order

**[Revised again] — no intermediate audio step.** The facilitator proposed shipping
Supertonic TTS into chat mode first ("tap a message to hear it") as a way to prove the
native integration on a simpler surface. Riyaz rejected the staging: **v1 is the complete
two-mode feature**, not a partial one that grows.

Steps 1–7 of the original order are unchanged (chat is still the first end-to-end path,
and still the baseline against which format-parse failures are diagnosable). Step 8
becomes:

8. **executorch integration + conversation mode, as one unit** — pin the nightly, wire
   Supertonic TTS and Whisper STT together, and ship conversation mode complete.

_Consistent with the same instinct as 1.7, 2.2 and 3.13_: no half-state that exists only
to be replaced.

### Conversation mode — confirmed v1 scope

The full Gemini-Live-shaped experience, per 1.2 / 3.2 / 3.3:

- Entered from a **mic button in the chat composer** — a mid-session gear change, not an
  up-front mode choice (1.2).
- **Full screen; chat history hidden.** Only the current exchange is on screen: the AI's
  latest line, spoken aloud via Supertonic and shown as readable text (the learner may not
  catch it by ear), and the user's latest transcription (3.3).
- **Push-to-talk**, not open-mic. Release → Whisper transcription lands in the composer →
  the user confirms, edits, or clears and retries → then it sends (3.2).
- **Exit returns to chat** with the full transcript intact. Because every spoken turn was
  confirmed text before sending, the log is exact — no reconciliation between what was said
  and what was recorded. Conversation mode is the same data structure with a mic on the
  composer, not a separate universe.
