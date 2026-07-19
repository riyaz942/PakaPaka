---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
lastStep: 8
status: 'complete'
revision: 'v2-prd-resync'
revisionStartedAt: '2026-07-20'
completedAt: '2026-07-20'
priorCompletedAt: '2026-05-03'
inputDocuments:
  - "planning-artifacts/product-brief-japanese-learning-2026-04-12.md"
  - "planning-artifacts/prd.md"
  - "planning-artifacts/.decision-log.md"
  - "planning-artifacts/ux-design-specification.md"
  - "planning-artifacts/ux-design-directions.html"
  - "planning-artifacts/research/market-open-source-local-first-japanese-learning-learners-research-2026-03-21.md"
  - "brainstorming/brainstorming-session-2026-07-18-2244.md"
  - "brainstorming/brainstorming-session-2026-07-18-2354.md"
  - "brainstorming/brainstorming-session-2026-07-19-1322.md"
  - "brainstorming/brainstorming-session-2026-07-19-1322-learn-page.md"
  - "brainstorming/brainstorming-session-2026-07-19-1628.md"
  - "brainstorming/brainstorming-session-2026-07-19-1651-ai-conversation.md"
workflowType: 'architecture'
project_name: 'japanese-learning'
user_name: 'Riyaz'
date: '2026-05-02'
lastRevised: '2026-07-20'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements:**

~108 FRs spanning the original v1 domains plus five v2 surfaces. Architecturally they cluster into **seven** subsystems (was five):

1. **Content & Curriculum Engine** (FR1–FR8c, amended FR8b/FR8c): Strict dependency graph (radical→kanji→vocab), JLPT-organized content, structured grammar schemas, reading passages. Passages are no longer a separate Read-tab domain — they are first-class discovery rows with bilingual summaries, ≥90% Guru+ unlock gating, and authored word-boundary `item_id`s for long-press lookup. Pipeline must emit searchable passage summaries and word spans.

2. **SRS & Review Engine** (FR9–FR14, FR29–FR33, FR81–FR86; amended FR5/FR9/FR11): FSRS scheduling, weakness biasing, unified mixer. v2 adds a **two-card kanji model** (meaning + labeled on'yomi; kun'yomi via vocabulary), `wrong_reading_type` non-terminal state, **worst-of-both** single SRS update per item/session, Return-to-advance pacing (800ms auto-advance opt-in), card-based progress counter, inline `AnswerReveal`, and details routes mounted under `review/` so the session survives. Review loop remains the <100ms critical path.

3. **Engagement & Home Intelligence** (FR15–FR17 amended → FR55–FR61, FR12/FR12b, FR33b–FR33c): Cognitive-load **ring reframed as an adaptive goal** (lessons + reviews, overshoot past 100%, no ceiling, weekly ratchet-up only, never auto-drops). Home is permanent sections + designed empty states + conditional triage (at-risk refresher, welcome-back, curriculum banner). **Daily streak removed** from Home; "days studied this month" lives in Stats. Time compression and visible reinforcement remain.

4. **Unified Browse / Search** (FR62–FR70): Single virtualized, paginated discovery list replacing per-level Learn screens and the Read tab. Faceted multi-select filters with live Apply counts; fan-out search (EN/romaji/kana/kanji, ~200ms debounce). Kanji/vocab/grammar always viewable; "locked" applies to passages only. Architecturally: UNION query over `items` + `reading_passages`, filter index strategy, and separation of **view permission** vs **lesson eligibility**.

5. **Item Details & Lesson Composition** (FR71–FR80): Split lesson (3-section paged) from details (vertical scroll). Type-appropriate cross-refs from dependency edges; `SectionHeading` + info sheets; on'yomi/kun'yomi primer gate; personal mnemonic as content; non-blocking study-status banner; vocabulary-keyed furigana auto-hide + Settings overrides (independent of SRS); comparison view via answer-collision / route params.

6. **Import & Onboarding** (FR21–FR26, FR33d–FR33h): Unchanged in intent — WaniKani/Bunpro/Anki mapping + FSRS conversion, bulk marking, intensity. Still zero accounts.

7. **AI Conversation** (FR87–FR100) — **new MVP-scope subsystem:** Fifth tab (replaces Read). BYOK with two adapters (OpenAI-compatible + Anthropic); chat-default + mid-session push-to-talk; curriculum furigana-bracket replies; local unknown-word flagging (no direct SRS injection); turn budget (formula OA4 open); end-of-session summary (on-demand, cached); in-band control markers (no tool-calling layer); on-device TTS/STT via executorch (Supertonic + Whisper). Requires network; exempt from offline-first (NFR24).

**Content Pipeline & Distribution** (FR34–FR37b, FR46–FR51) remains the distribution backbone; v2 adds passage word-boundary authorship and bilingual summaries into the compile contract.

Post-MVP (FR38–FR45 -PM) still includes shadow mode, AI stories, community PRs. Note: PRD Phase 3 still lists "AI conversation practice" historically — **v2 pulled a scoped AI Conversation into current requirements**; architecture must treat FR87–FR100 as in-scope, not Phase 3.

**Non-Functional Requirements:**

Architecture-shaping NFRs (v1 retained + v2 additions):

- **NFR1–NFR2, NFR5b**: <100ms review feedback / SQLite; zero review-loop animations — still bind the review renderer and queue builder
- **NFR3**: <3s cold start — now shares init budget with optional large on-device model downloads that must **not** block usability (NFR25)
- **NFR6–NFR9**: Local-first privacy; API keys in secure storage — extended to BYOK provider keys (never sent except to user-configured HTTPS endpoints)
- **NFR10 + NFR28**: User progress survives updates; new numbered migrations (`015_furigana_overrides`, `016+` AI sessions/messages)
- **NFR11–NFR12**: Atomic curriculum DB swap
- **NFR14–NFR17 + NFR29**: WCAG 2.1 AA; first `onLongPress` surfaces need non-gesture alternatives
- **NFR21–NFR22**: N5→N1 scale without curriculum schema break; 10k+ item query performance — Browse virtualization + filter indexes become first-class
- **NFR23**: Platform floor raised to **iOS 17 / Android 13 (API 33)** + New Architecture (executorch) — whole-app launch constraint; v1 Android 10 / iOS 15 retired
- **NFR24**: AI Conversation network-exempt; all other features remain fully offline
- **NFR25–NFR27**: Explicit large model downloads; BYOK cost legibility; SSE streaming via `expo/fetch` with graceful partial-failure
- **NFR30**: Pinned executorch **nightly** — accepted maintenance cost (manual upgrade + re-verify)

**Scale & Complexity:**

- Primary domain: Cross-platform mobile (React Native / Expo)
- Complexity level: **High** (was Medium-High) — driven by on-device ML voice stack, BYOK multi-provider adapters, and Browse/search query surface
- Estimated architectural components: ~16–19 major modules (prior set + browse/search query layer, goal-ring calculator, lesson/details composition split, AI conversation adapters, session/summary store, on-device STT/TTS runtime, furigana override store)

### Technical Constraints & Dependencies

**Platform constraints:**
- React Native (Expo) — Android & iOS; **min iOS 17 / Android 13**; New Architecture required for executorch
- Dual SQLite: read-only `curriculum.db` + mutable `user.db` (ATTACH for review joins) — unchanged contract
- Offline-first **with one explicit exemption**: AI Conversation (and optional cloud STT opt-in)
- Portrait-locked phones; tablet landscape still post-MVP
- No accounts / no backend user store

**External dependencies (delta from v1 architecture):**
- Retained: `ts-fsrs`, `wanakana`, `expo-sqlite`, NativeWind v4+, Expo secure-store / file-system / haptics / notifications / updates, Cloudflare R2, GitHub Actions + Git LFS
- **New:** executorch (pinned nightly) + Supertonic Japanese TTS + Whisper Japanese STT models
- **New:** `expo/fetch` SSE for streaming chat completions
- **New:** OpenAI-compatible + Anthropic HTTP adapters (user-configured base URL / keys)
- Content pipeline must author passage word boundaries linking vocabulary `item_id`s and bilingual one-line summaries

**Known risk areas:**
- Bunpro API/export uncertainty (unchanged)
- Grammar parser coverage (unchanged)
- **executorch nightly pin** — semver-free; upgrade tax (NFR30)
- **Large on-device model downloads** (~0.5–1.1 GB) vs store/user expectations — must remain optional and non-blocking
- **Offline-first narrative tension** with always-visible AI tab that needs network (accepted in PRD)
- Two-card review roughly doubles session card count — progress UX and deferred-grade flush must stay correct under indefinite wait (FR84)
- Browse UNION + faceted filters at 10k+ rows — virtualization and index plan required to hold NFR1/NFR22
- Open items deferred: OA4 turn-budget formula, OA5 role-play library, OA6 furigana parse-failure (PRD already specifies plain-text fallback), OA7 long-press a11y

### Cross-Cutting Concerns Identified

1. **Offline-first with explicit exemptions**: Default remains "no network required." AI Conversation (and opt-in cloud STT) are the only runtime network features; UI must never imply the rest of the app is degraded when offline.

2. **SRS state lifecycle + multi-card grading**: Shared FSRS + weakness model across types; kanji now produces two cards → one worst-of-both grade. Answer evaluation gains `wrong_reading_type` alongside `wrong_script`. No double FSRS write.

3. **Content relationship graph**: Still drives lessons, reinforcement, and now Browse cross-refs, passage unlock (≥90% Guru+), reading-readiness meter, and AI unknown-word deep-links. Precomputed, indexed graph remains mandatory.

4. **Queue / session orchestration**: Queue builder still FSRS × weakness × interleave × load; session provider must support nested details under `review/`, deferred-grade flush when advance wait is indefinite, and card-based progress.

5. **Japanese text & furigana model**: WanaKana + Levenshtein + grammar parser retained. Furigana `auto` keys on **vocabulary mastery**, not component kanji; persistent overrides live in Settings/`user.db`, independent of study status. AI replies reuse curriculum bracket format → same renderer.

6. **Curriculum vs user data separation**: Unchanged dual-DB rule; new user tables via numbered migrations only. Curriculum compile gains passage spans/summaries without touching user data.

7. **Import mapping layer**: Unchanged three-source mapping abstraction.

8. **Goal-ring vs cognitive-load semantics**: Ring is a **goal** (ratchet up, overshoot, user-configurable), not a capacity clamp. Daily load accounting must include **lesson** contributions (known bug BUG2). Forecast "wall" annotation is presentation over existing due-load data.

9. **Discovery query surface**: One virtualized list UNION-ing items + passages; fan-out search; faceted filters with live counts — first major non-review performance surface besides queue build.

10. **BYOK AI boundary**: Keys only to user-configured endpoints; no learning data to vendor backends we control; conversations/summaries local; SRS injection forbidden for off-curriculum words; in-band markers instead of tool-calling for provider portability.

11. **Accessibility for new gestures**: Long-press (passages, AI flags) requires non-gesture alternatives under CI a11y rules (NFR29 / OA7).

## Starter Template Evaluation

### Primary Technology Domain

Cross-platform mobile application using **React Native / Expo** — confirmed by PRD classification, shipped codebase (`mobile/`), and UX platform strategy. This is a **brownfield reaffirmation**, not a new greenfield starter selection.

### Starter Options Considered

**Option A: Retain Expo managed + Expo Router foundation (Selected — already shipped)**

The v1 architecture chose `create-expo-app` default@sdk-55. The live app is on **Expo SDK 55** (React Native 0.83.6 / React 19.2.0) with Expo Router, TypeScript, NativeWind v4, `expo-sqlite`, and `expo-dev-client`. That choice still holds for PRD v2.

Current upstream: Expo **SDK 57** is latest (`npx create-expo-app@latest --template default@sdk-57`). An SDK bump is **not required to start v2 work** on the existing app; treat SDK 56/57 as a separate upgrade story unless an executorch pin forces it.

**Option B: Re-init on SDK 57 default template**

Would discard the existing dual-DB, review session, NativeWind token system, and curriculum pipeline integration for no architectural gain. Rejected for this re-sync.

**Option C: Third-party boilerplates (Ignite, etc.) / bare RN without Expo**

Still wrong for a local-first SQLite app. Rejected (same rationale as v1). Flutter/other stacks remain out of scope.

### Selected Starter: Expo SDK 55 foundation (retain); evolve in place for v2

**Rationale for Selection:**

1. **Already the production codebase** — dual DB, FSRS, review loop, import, and NativeWind tokens are built on this foundation.
2. **Expo Router** still matches the 5-tab shell; only the fifth tab slot changes (Read → AI Conversation).
3. **`expo-dev-client` is already present** — required for executorch (Expo Go cannot host the voice stack).
4. **Official Expo path** still covers EAS Build, Expo Updates (JS OTA), and config plugins needed for New Architecture + min OS floors.
5. **Minimal opinions** still fit local-first: no remote API client layer, no auth scaffolding.

**Initialization Command (historical — do not re-run on this repo):**

```bash
npx create-expo-app@latest japanese-learning --template default@sdk-55
```

For a hypothetical greenfield today: `npx create-expo-app@latest japanese-learning --template default@sdk-57`.

**Architectural Decisions Provided by Starter (still in force):**

**Language & Runtime:**
- TypeScript + React 19.2 + React Native 0.83 (SDK 55)
- Expo managed workflow with custom native modules via config plugins / prebuild

**Routing & Navigation:**
- Expo Router (file-based); bottom tabs; stacks for drill-down; full-screen review/lesson sessions

**Build Tooling:**
- Metro; EAS Build; Expo Updates for JS OTA; curriculum DB updates remain a separate atomic file swap

**Project Structure:**
- `mobile/src/app/` routes, `components/`, `core/`, `data/`, `providers/` — feature layout already established

**Development Experience:**
- Custom dev client (not Expo Go for v2 voice work); Jest + RNTL; `expo lint` + a11y plugin

**v2 Foundation Deltas (required on top of the starter — not optional):**

| Concern | Decision |
| --- | --- |
| New Architecture | **Required** (executorch). Enable via `expo-build-properties` (`newArchEnabled: true` iOS + Android). Not yet set in `app.json` — implementation story. |
| Min OS | **iOS 17.0 / Android API 33** (NFR23) via `expo-build-properties` deploymentTarget / minSdkVersion |
| Voice / on-device ML | `react-native-executorch` (pinned nightly per NFR30) + Expo resource fetcher; Supertonic TTS + Whisper STT; explicit user-initiated model downloads |
| Streaming chat | `expo/fetch` SSE to user-configured BYOK endpoints |
| Secure credentials | Extend `expo-secure-store` for provider API keys (same store as import keys) |
| Notifications | Drop streak-at-risk; keep optional review nudges only if still product-desired |
| Tab shell | Home · Browse/Learn · **AI Conversation** · Stats · Settings (Read removed) |
| SQLite | Keep `expo-sqlite`; no starter change. New user migrations for furigana overrides + AI sessions |

**SQLite Library Decision:** Unchanged — `expo-sqlite` remains default; `op-sqlite` only if queue/Browse benchmarks miss <100ms.

**Note:** Do **not** re-run create-expo-app on this repo. First implementation stories for the v2 delta are: raise platform floor + enable New Architecture, then add executorch + AI Conversation scaffolding on the existing app.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
1. Dual-database architecture (curriculum.db + user.db) — **retained**
2. State management (SQLite-first + React Context) — **retained**
3. Feature-first code organization with pure `core/` — **retained**
4. Content pipeline (JSON → SQLite → Git LFS → app) — **retained**; compile contract extended
5. **New:** Platform floor iOS 17 / Android 13 + New Architecture (executorch)
6. **New:** BYOK AI Conversation adapters + offline exemption boundary
7. **New:** Review two-card / worst-of-both grading model
8. **New:** Unified Browse UNION query + passage unlock (≥90% Guru+)

**Important Decisions (Shape Architecture):**
9. Testing strategy (Jest core + RNTL UI) — **retained**
10. Error handling (`Result<T, AppError>`, transactional SQLite) — **retained**; stream degradation for AI
11. Goal-ring semantics (adaptive goal, not capacity ceiling)
12. Furigana model (vocab-keyed auto + Settings overrides migration)
13. On-device TTS/STT via pinned executorch nightly (optional downloads)

**Deferred Decisions (Post-MVP / open):**
- Community contribution pipeline (GitHub OAuth, PR generation)
- Cross-device sync; Desktop (Electron) adaptation
- OA4 turn-budget formula; OA5 role-play scenario library
- SDK 56/57 upgrade (unless executorch pin forces it)
- Remote crash/analytics backend

### Data Architecture

**Decision: Dual SQLite Database Architecture (retained + v2 schema deltas)**

| Aspect | Decision |
| --- | --- |
| Approach | Two DBs: `curriculum.db` (read-only, atomic replace) + `user.db` (mutable, numbered migrations) |
| Cross-DB | `ATTACH DATABASE` for review queue and Browse joins |
| Affects | All data access, OTA, review, Browse, import, AI persistence |

**`curriculum.db` (v2 additions):**
- Retained: items, readings, accepted answers, dependency graph, grammar associations, passages, mnemonic URLs, metadata
- **Add:** bilingual passage one-line summaries (searchable); authored word-boundary spans linking vocabulary `item_id`s

**`user.db` (v2 revisions):**
- Retained: SRS state, weakness stats, personal mnemonics, preferences, import metadata, passage practice results, app state
- **Revise:** cognitive-load → **goal-ring** fields (target, weekly ratchet state, achievement history; overshoot allowed); remove Home streak product surface (optional legacy columns may remain until cleaned)
- **Add:** `015_furigana_overrides`; `016+` AI sessions / messages / cached summaries
- Passage unlock derived from SRS coverage (≥90% linked vocab+grammar at Guru+), not a separate unlock table

**Migrations:** curriculum = replace-not-migrate; user = forward-only numbered migrations bundled with app binary.

**Caching:** mnemonic images via `expo-image`; STT/TTS model files downloaded explicitly to app storage (not inside either DB).

### Authentication & Security

**Decision: No Authentication + Local Credential Boundary (extended for BYOK)**

| Aspect | Decision |
| --- | --- |
| Core auth | None — no accounts |
| Import keys | `expo-secure-store` (discardable after import) |
| BYOK keys | Same secure store; transmitted only to user-configured HTTPS provider endpoints |
| Learning data | Local only; AI transcripts in `user.db`; no first-party analytics backend |
| Offline | All features offline except AI Conversation (+ optional cloud STT opt-in) |
| Post-MVP | GitHub OAuth for contributors only |

### API & Communication Patterns

**Decision: No first-party API; thin HTTPS clients + two BYOK adapters**

| Aspect | Decision |
| --- | --- |
| App backend | None |
| Import / curriculum / R2 | HTTPS → `Result<T, AppError>` |
| BYOK | OpenAI-compatible (editable base URL) + Anthropic adapters only |
| Streaming | `expo/fetch` SSE; partial failure must not corrupt transcript |
| Control signals | In-band structured markers stripped before render (no tool-calling layer) |
| SRS boundary | No SRS rows without curriculum `item_id` |

### Frontend Architecture

**Decision: Feature-first layers + v2 IA / review / Browse / AI surfaces**

| Aspect | Decision |
| --- | --- |
| Layers | `core/` → `data/` → `app/` + `components/` (retained) |
| State | SQLite-first; Context for review session, Browse filters, AI session |
| Tabs | Home · Browse · AI Conversation · Stats · Settings |
| Review | Two-card kanji; labeled on'yomi; `wrong_reading_type`; worst-of-both; Return-to-advance; card progress; `AnswerReveal`; details under `review/` |
| Home | Goal ring (lessons+reviews, overshoot, weekly ratchet-up); permanent sections + conditional triage; no streak |
| Browse | Virtualized UNION list; faceted filters; fan-out search; passages first-class; lock = passages only |
| Lesson/details | Split compositions; shared section authorship; comparison via answer-collision |
| Furigana | Vocab mastery auto-hide; Settings overrides; AI replies reuse bracket renderer |
| AI UI | Chat default; mid-session PTT; STT → composer confirm; long-press + non-gesture a11y |

**Route sketch (delta):**
```
(tabs)/ index | browse | converse | stats | settings
review/  (session + nested details)
lesson/
onboarding/
```

### Infrastructure & Deployment

**Decision: EAS + curriculum OTA + New Architecture / OS floor for executorch**

| Aspect | Decision |
| --- | --- |
| Build | EAS Build / Submit |
| JS OTA | Expo Updates |
| Curriculum OTA | Download → SHA-256 → atomic rename |
| Pipeline | GH Actions compile; emit summaries + word spans |
| New Arch | Required (`newArchEnabled`); custom dev client |
| Min OS | iOS 17.0 / Android API 33 via `expo-build-properties` |
| Voice | `react-native-executorch` (pinned nightly) + Expo resource fetcher |
| SDK | Remain on Expo 55 unless pin forces upgrade |
| Monitoring | No remote backend for MVP |

### Testing Strategy

| Layer | Framework | Scope (v2 adds) |
| --- | --- | --- |
| Core | Jest | + worst-of-both grading, `wrong_reading_type`, goal-ring ratchet, Browse filter/query builders, adapter marker parsing, turn-budget helpers |
| Data | Jest + SQLite | + furigana override migration, AI session repos, passage unlock coverage query |
| UI | RNTL | + AnswerReveal, Browse filters, goal ring overshoot, AI empty/key-setup states |
| E2E | Deferred | unchanged |

### Error Handling Patterns

| Pattern | Application |
| --- | --- |
| Result type | All fallible async — including BYOK and model download |
| Transactional writes | SQLite state updates; AI message append atomic per turn |
| Stream degradation | Partial SSE → keep committed transcript; show recoverable error |
| Atomic curriculum update | Unchanged |
| Review write resilience | Unchanged — loop never blocks on write failure |
| Furigana parse failure (AI) | Plain text, no flags (OA6 / FR91) |

### Decision Impact Analysis

**Implementation Sequence (v2 delta-first on existing app):**
1. Platform floor + New Architecture verify (dev client rebuild)
2. User migrations: furigana overrides, goal-ring fields, AI tables
3. Review two-card / worst-of-both / Return-to-advance / card progress
4. Home goal-ring + streak removal + triage sections
5. Unified Browse + pipeline passage summaries/spans
6. Lesson/details split + comparison + furigana model fixes
7. BYOK adapters + chat UI + summary cache
8. executorch TTS/STT + explicit model downloads + conversation mode
9. A11y long-press alternatives; polish; store submission

**Cross-Component Dependencies:**
- Queue/session → FSRS + weakness + two-card grading + deferred flush
- Browse → curriculum UNION + user SRS for lock/performance filters
- Passage unlock → graph links + Guru+ coverage query
- AI flagging → local curriculum lookup; deep-link to details; never SRS-write
- Goal ring → lesson + review `addDailyLoad` call sites (fixes BUG2)

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical Conflict Points Identified:** ~36 areas (28 retained from v1 + ~8 v2 surfaces: two-card review, goal ring, Browse, furigana overrides, BYOK adapters, AI markers/streams, voice mode, long-press a11y).

### Naming Patterns

**Database Naming Conventions:**

| Element | Convention | Example |
| --- | --- | --- |
| Tables | `snake_case`, plural | `items`, `srs_states`, `weakness_stats`, `accepted_answers` |
| Columns | `snake_case` | `item_id`, `due_date`, `correct_count`, `jlpt_level` |
| Primary keys | `id` (integer, autoincrement) | `id INTEGER PRIMARY KEY AUTOINCREMENT` |
| Foreign keys | `{referenced_table_singular}_id` | `item_id`, `passage_id` |
| Indexes | `idx_{table}_{columns}` | `idx_items_jlpt_level`, `idx_srs_states_due_date` |
| Boolean columns | `is_` or `has_` prefix | `is_burned`, `has_mnemonic` |
| Timestamp columns | `_at` suffix | `created_at`, `updated_at`, `last_reviewed_at` |
| Enum-like columns | Store as TEXT, not integer codes | `item_type TEXT CHECK(item_type IN ('radical','kanji','vocabulary','grammar'))` |

**v2 table names (mandatory):**

| Table | Purpose |
| --- | --- |
| `furigana_overrides` | Per-word persistent show/hide (migration 015) |
| `ai_sessions` / `ai_messages` | Conversation persistence (016+) |
| `goal_ring_state` (or equivalent prefs columns) | Target, ratchet week, achievement — **not** a capacity ceiling |

**Code Naming Conventions:**

| Element | Convention | Example |
| --- | --- | --- |
| Files — components | `PascalCase.tsx` | `ReviewCard.tsx`, `GoalRing.tsx` |
| Files — logic/utils | `camelCase.ts` | `queueBuilder.ts`, `worstOfBoth.ts` |
| Files — types | `camelCase.types.ts` | `srs.types.ts`, `ai.types.ts` |
| Files — hooks | `use{Name}.ts` | `useReviewQueue.ts`, `useBrowseItems.ts` |
| Files — tests | `{filename}.test.ts(x)` (co-located) | `queueBuilder.test.ts` |
| Directories | `kebab-case` | `cognitive-load/`, `goal-ring/`, `ai/` |
| React components | `PascalCase` | `ReviewCard`, `AnswerReveal` |
| Functions | `camelCase` | `buildReviewQueue`, `stripAiMarkers` |
| Constants | `UPPER_SNAKE_CASE` | `MAX_PREFETCH_COUNT`, `WEAKNESS_WEIGHT` |
| Types/Interfaces | `PascalCase`, no `I` prefix | `SRSState`, `AiSession` |
| Enums | `PascalCase` name, `PascalCase` members | `enum ItemType { Radical, Kanji, Vocabulary, Grammar }` |
| Hook return values | Destructured object, not array | `const { queue, isLoading, refetch } = useReviewQueue()` |

**v2 naming adds:**

| Element | Convention | Example |
| --- | --- | --- |
| Review card unit | `card` not `item` in progress UI | `cardsCompleted` / `totalCards` |
| Answer feedback kinds | string literal union | `'correct' \| 'incorrect' \| 'wrong_script' \| 'wrong_reading_type' \| 'confused_with'` |
| BYOK adapters | `{Provider}Adapter` | `OpenAICompatibleAdapter`, `AnthropicAdapter` |
| In-band markers | shared parser only | `core/ai/markers.ts` |
| Primary tab routes | match IA | `browse.tsx`, `converse.tsx` — not `read.tsx` as a tab |

**NativeWind / Tailwind Conventions:**

| Pattern | Rule | Example |
| --- | --- | --- |
| Class ordering | Layout → Sizing → Spacing → Typography → Color → Effects | `className="flex-1 w-full px-4 py-2 text-lg text-primary bg-background rounded-md"` |
| Design tokens | Always use semantic tokens; never raw hex in new code | `text-primary` not `text-[#EEEEF0]` |
| Dark mode | Follow existing token scheme in `tailwind.config.js` | `bg-background`, `text-secondary` |
| Component variants | Use props + conditional classes via `cn()` | `className={cn("px-4 py-2", variant === "primary" && "bg-feedback-info")}` |

### Structure Patterns

**Project Organization Rules:**

| Rule | Convention |
| --- | --- |
| Test location | Co-located with source: `queueBuilder.ts` → `queueBuilder.test.ts` |
| Component structure | One component per file. Named export matching filename. No default exports. |
| Index files | Only in `components/` subdirectories to re-export public components. Never in `core/` or `data/`. |
| Barrel exports | Forbidden in `core/` — import directly from the file. |
| Type definitions | Co-located `.types.ts` per module. Shared types in `src/types/`. |
| Constants | Module-specific in module; app-wide in `src/constants/` / `src/config/`. |

**v2 placement rules:**

| Concern | Location |
| --- | --- |
| Two-card / worst-of-both | `core/answer/` + `core/srs/` — pure; UI only renders |
| Goal ring calculator | `core/cognitive-load/` or `core/goal-ring/` — never clamp as ceiling |
| Browse query builder | `data/curriculum/` + hooks — UNION + filters not in JSX |
| BYOK adapters | `core/ai/adapters/` + thin `data/ai/` for keys + `expo/fetch` |
| Marker strip/parse | `core/ai/markers.ts` — single module |
| Furigana resolution | shared helper: Settings override → SRS default → global pref |
| Voice (STT/TTS) | `data/ai/voice/` wrapping executorch — not inside review components |
| Lesson vs details sections | shared under `components/learn/` / `components/lesson/`; compositions differ by route |

### Format Patterns

**TypeScript / Result / dates:** unchanged from v1 — `Result<T, AppError>` for all fallible async including BYOK, model download, SSE finalize. SQLite ISO UTC; display relative/local.

**v2 data formats:**

| Concern | Rule |
| --- | --- |
| Kanji grade | Two card results → **one** FSRS update = worst-of-both |
| Progress counter | Count **cards**, not items |
| AI reply text | Furigana brackets preferred; parse fail → plain text, no error toast |
| AI summary | On demand once; cache on session; never regenerate |
| Cloud STT | Only if `cloudSttOptIn === true` |
| Secure keys | Namespaced `expo-secure-store` keys e.g. `byok.openai`, `byok.anthropic` |

### Communication Patterns

**React Context Pattern:**

| Context | Scope |
| --- | --- |
| `ReviewSessionContext` | Queue, **card** index, deferred grade flush, nested details survival |
| `DatabaseContext` | Dual DB handles |
| `PreferencesContext` | Intensity, theme, auto-advance opt-in, furigana global, cloud STT, BYOK base URL (non-secret) |
| Browse filters | Local state or dedicated context — not ReviewSession |
| `AiConversationContext` | Session id, stream buffer, mode (chat vs PTT) |

**Event/Callback Naming:** `on{Event}` props / `handle{Event}` handlers; typed callbacks only.

### Process Patterns

**Error Handling:**

| Layer | Pattern |
| --- | --- |
| `core/` | Return `Result`. Never throw. |
| `data/` | Catch SQLite/network, wrap in `Result`. |
| `components/` | Error boundaries for crashes; inline `Result` for expected failures |
| AI stream | Commit completed assistant turns only; recoverable banner; never wipe transcript |
| Review loop | Never interrupt on write failure |

**Loading State Pattern:**

| Surface | Rule |
| --- | --- |
| Review | No between-card loaders; Return-to-advance |
| Browse | Virtualized list; skeleton rows OK; live count on Apply |
| AI first open | Key-setup if unconfigured; never block other tabs |
| Model download | Explicit size + progress; app usable without voice |

**Long-press:** Every `onLongPress` needs a visible non-gesture alternative for CI a11y.

### Enforcement Guidelines

**All AI Agents MUST:**

1. Run `npx tsc --noEmit` before considering implementation complete.
2. Follow naming conventions exactly (DB snake_case / TS camelCase / components PascalCase).
3. Never import from `core/` via index barrels — direct file imports only.
4. Never throw across async in `core/` or `data/` — always `Result<T, AppError>`.
5. Never add UI animations inside the review loop; no default 800ms auto-advance.
6. Always use NativeWind semantic tokens — never raw hex / deprecated `Colors` in new code.
7. Co-locate tests; named exports only; keep `core/` React-free.
8. Wrap multi-table SQLite writes in transactions.
9. **Never** create SRS rows from AI/off-curriculum words.
10. **Never** double-update FSRS for a two-card kanji item.
11. **Never** treat the goal ring as a hard capacity ceiling.
12. Strip AI in-band markers in the shared parser before render.
13. Provide non-gesture alternatives for long-press targets.

**Anti-Patterns (Agents MUST NOT):**

| Anti-Pattern | Correct Pattern |
| --- | --- |
| `export default function ReviewCard` | `export function ReviewCard` |
| `style={{ backgroundColor: '#0A0A0F' }}` | `className="bg-background"` |
| `throw new Error('DB failed')` in data layer | `return { ok: false, error: { code: 'DB_WRITE_ERROR', ... } }` |
| Accept any kanji reading on reading card | Labeled on'yomi only; `wrong_reading_type` otherwise |
| Progress by items under two-card model | Progress by cards |
| `getKnownKanjiCharacters()` for furigana auto | Vocabulary item mastery |
| Tool-calling for BYOK control | In-band markers |
| Silent cloud STT fallback | Opt-in setting only |
| Lock kanji/vocab rows in Browse | Lock passages only |
| Auto-start session from Home | CTAs only — user chooses |

## Project Structure & Boundaries

### Complete Project Directory Structure

Target tree after v2 (Δ = change / + = new; omit unchanged leaves for brevity). Grounded in the live `mobile/src/` layout.

```
japanese-learning/
├── package.json                      # root curriculum scripts
├── curriculum/                       # JSON source (+ passage summaries, word spans in compile)
├── scripts/                          # validate-schema, compile-curriculum
├── .github/workflows/                # curriculum CI
├── mobile/
│   ├── app.json                      # + newArchEnabled, expo-build-properties (iOS 17 / API 33)
│   ├── package.json                  # + react-native-executorch*, expo-build-properties
│   ├── assets/
│   │   ├── curriculum-seed/curriculum.db
│   │   └── curriculum-manifest/      # __DEV__ mock manifest
│   └── src/
│       ├── app/
│       │   ├── _layout.tsx
│       │   ├── (tabs)/
│       │   │   ├── _layout.tsx       # Δ tabs: Home, Browse, Converse, Stats, Settings
│       │   │   ├── index.tsx         # Δ goal ring Home (no streak CTA)
│       │   │   ├── browse/           # Δ replaces learn-as-tab + read-as-tab discovery
│       │   │   │   ├── index.tsx     # unified virtualized list + search/filters
│       │   │   │   ├── item/[id].tsx # details (from learn/item)
│       │   │   │   └── passage/[id].tsx  # reader (from read/[id])
│       │   │   ├── converse/         # + AI Conversation tab
│       │   │   │   ├── index.tsx     # chat / key-setup empty
│       │   │   │   ├── session/[id].tsx
│       │   │   │   └── summary/[id].tsx
│       │   │   ├── stats.tsx         # + days-studied-this-month
│       │   │   └── settings.tsx      # + BYOK, furigana overrides, cloud STT, auto-advance
│       │   ├── review/
│       │   │   ├── index.tsx         # Δ two-card / Return-advance / card progress
│       │   │   ├── summary.tsx
│       │   │   └── item/[id].tsx     # + nested details (session survives)
│       │   ├── lesson/               # Δ 3-section lesson composition
│       │   └── onboarding/           # retained
│       ├── components/
│       │   ├── review/               # + AnswerReveal; Δ SessionHeader cards
│       │   ├── engagement/           # Δ GoalRing; − StreakCounter from Home
│       │   ├── browse/               # + FilterDrawer, BrowseRow, PassageRow
│       │   ├── learn/ / lesson/      # Δ split details vs lesson sections; SectionHeading
│       │   ├── converse/             # + ChatBubble, Composer, PttOverlay, UnknownWordFlag
│       │   ├── common/ / import/
│       ├── core/
│       │   ├── srs/ answer/ content/ grammar/ import/ lesson/ markdown/
│       │   ├── cognitive-load/       # Δ goal-ring semantics (or rename goal-ring/)
│       │   └── ai/                   # + adapters/, markers.ts, turnBudget.ts, summaryPrompt.ts
│       ├── data/
│       │   ├── curriculum/           # + browseRepository (UNION), passageSpans
│       │   ├── user/                 # + furiganaOverrideRepository, aiSessionRepository, goalRing
│       │   ├── ai/                   # + secure key IO, expo/fetch client, voice/
│       │   ├── hooks/
│       │   ├── migrations/           # + 015_furigana_overrides, 016+_ai_*
│       │   └── database.ts
│       ├── providers/                # + AiConversationProvider (optional)
│       ├── constants/ config/ types/ utils/ lib/ hooks/
│       └── global.css
```

Migration note: temporary redirects from `learn/*` and `read/*` are allowed during rollout; remove once Browse/Converse ship.

### Architectural Boundaries

**API Boundaries:** No first-party REST. External only: WaniKani/Bunpro HTTPS, curriculum manifest + DB download, R2 images, user-configured BYOK endpoints, optional cloud STT.

**Component Boundaries:**
- Tabs never own review/lesson session state
- `ReviewSessionProvider` owns queue/cards/grades; nested `review/item/[id]` must not remount session
- Browse filters stay out of review context
- AI Conversation never writes SRS without curriculum `item_id`

**Data Boundaries:**
- `curriculum.db` read-only / replaceable
- `user.db` only mutable store (+ secure-store for secrets; model files on disk)
- Repositories are the only SQLite accessors; UI uses hooks

### Requirements to Structure Mapping

| FR cluster | Primary locations |
| --- | --- |
| FR1–8c content | `curriculum/`, `data/curriculum/`, `components/learn|lesson` |
| FR9–14, FR81–86 review | `core/srs`, `core/answer`, `app/review`, `components/review` |
| FR55–61 Home / goal | `core/cognitive-load|goal-ring`, `app/(tabs)/index`, `components/engagement` |
| FR62–70 Browse / passages | `app/(tabs)/browse`, `data/curriculum/browse*`, `components/browse` |
| FR71–80 details / lesson | `app/lesson`, `browse/item`, `components/learn|lesson` |
| FR21–26 import | `core/import`, `data/import`, `app/onboarding` |
| FR87–100 AI | `core/ai`, `data/ai`, `app/(tabs)/converse`, `components/converse` |
| FR34–51 pipeline | `scripts/`, `.github/workflows/`, `data/curriculum/curriculumUpdate*` |
| NFR23–30 platform/voice | `app.json`, `expo-build-properties`, `data/ai/voice` |

### Integration Points

**Internal:** hooks ↔ repositories ↔ SQLite; providers for session/AI; Expo Router for navigation.

**External:** import APIs, curriculum OTA, R2, BYOK SSE, executorch models.

**Data flow (v2):** Home CTAs → lesson/review → goal ring updates; Browse → details/passage; Converse → local transcript → optional summary; never Converse → SRS insert for unknown words.

### Development Workflow Integration

- Dev: `mobile/` + custom **dev client** (required for executorch); Expo Go insufficient for voice
- Curriculum: root `npm run validate-schema` / `compile-curriculum`
- CI: lint, typecheck, jest, contrast check; a11y eslint
- Ship: EAS Build; Expo Updates for JS; curriculum DB atomic swap separate from JS OTA

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
Dual DB, SQLite-first state, Result type, and Expo managed workflow remain coherent. v2 adds New Architecture + iOS 17/Android 13 + executorch without contradicting local-first: AI Conversation is an explicit offline exemption (NFR24). BYOK adapters + in-band markers avoid a tool-calling layer that would fight provider diversity. Two-card / worst-of-both fits the existing single SRS row model (no schema fork).

**Pattern Consistency:**
Naming/structure/Result rules retained; v2 patterns close the new conflict points (card vs item progress, goal vs ceiling, Browse lock rules, AI→SRS boundary, long-press a11y).

**Structure Alignment:**
Target tree is a delta on the live `mobile/src/` layout (Browse/Converse modules, `core/ai`, migrations 015+). Boundaries prevent session remount and SRS injection from AI.

### Requirements Coverage Validation ✅

**Feature Coverage:** Seven subsystems cover v1 FRs plus Home/goal, Browse, details/lesson, review flow, and AI Conversation. Pipeline extended for passage summaries/spans.

**Functional Requirements:** FR1–FR54 (as amended) + FR55–FR100 architecturally supported. Post-MVP FR38–45 remain deferred without blocking the data model.

**Non-Functional Requirements:** NFR1–22 retained; NFR23–30 addressed (platform floor, offline exemption, model downloads, BYOK cost, SSE, migrations, a11y, nightly pin).

### Implementation Readiness Validation ✅

**Decision Completeness:** Critical path documented (dual DB, BYOK, two-card, Browse, New Arch/OS floor). Package versions: Expo 55 verified live; executorch pinned as nightly (exact digest is an implementation story per NFR30).

**Structure Completeness:** Target directories and FR→path mapping specified; rollout redirects from learn/read allowed temporarily.

**Pattern Completeness:** Enforcement list includes v2 must/must-not rules with anti-pattern table.

### Gap Analysis Results

**Critical Gaps:** None.

**Important Gaps (non-blocking):**
1. **OA4** — turn-budget formula still TBD (steer, not hard cutoff); implement behind a named pure function with placeholder constants.
2. **OA5** — role-play scenario library unsized content work; ship picker shells + stub scenarios.
3. **UX specification** — still partially v1 (Read tab / streak / capacity ring); PRD v2 + this architecture are source of truth until UX doc is revised.
4. **executorch pin** — lock to a concrete nightly commit/hash in `package.json` during the voice story; re-verify on upgrade (NFR30).

**Nice-to-Have:**
- Formal Browse query benchmark harness for NFR22
- Structured logging (still post-MVP)
- SDK 56/57 upgrade story when forced or convenient

### Validation Issues Addressed

- Import fetch vs pure mapper split (v1) remains valid.
- AI provider integration moved from “deferred post-MVP” to in-scope BYOK architecture.
- Streak/cognitive-load ceiling language removed from decisions/patterns/structure.

### Architecture Completeness Checklist

**Requirements Analysis**
- [x] Project context thoroughly analyzed
- [x] Scale and complexity assessed
- [x] Technical constraints identified
- [x] Cross-cutting concerns mapped

**Architectural Decisions**
- [x] Critical decisions documented with versions
- [x] Technology stack fully specified
- [x] Integration patterns defined
- [x] Performance considerations addressed

**Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Communication patterns specified
- [x] Process patterns documented

**Project Structure**
- [x] Complete directory structure defined
- [x] Component boundaries established
- [x] Integration points mapped
- [x] Requirements to structure mapping complete

### Architecture Readiness Assessment

**Overall Status:** READY WITH MINOR GAPS

**Confidence Level:** High for implementation of the v2 delta on the existing app; medium only where OA4/OA5 content formulas remain open.

**Key Strengths:**
1. Brownfield-safe — evolves shipped dual-DB / review / NativeWind stack
2. Clear offline exemption boundary for AI without weakening local-first core
3. Two-card grading without SRS schema churn
4. Agent conflict rules updated for the highest-risk v2 mistakes
5. FR→directory mapping for the new surfaces

**Areas for Future Enhancement:**
- UX spec alignment to PRD v2
- Turn-budget + role-play content
- Optional SDK upgrade; Browse perf harness

### Implementation Handoff

**AI Agent Guidelines:**
- Follow this document over stale UX copy where they conflict
- Respect layer boundaries (`core/` never imports React/`data/` UI)
- Enforcement rules in Implementation Patterns are authoritative
- Never invent a backend or auto-inject AI words into SRS

**First Implementation Priority (v2 delta — do not re-run create-expo-app):**
1. Raise platform floor + confirm New Architecture on custom dev client
2. Migrations `015_furigana_overrides` (+ goal-ring fields as needed)
3. Review two-card / worst-of-both / Return-to-advance / card progress
4. Then Home goal ring → Browse → AI Conversation / executorch
