# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes, plus project-specific context for this repo.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Communicate Crisp and Clear

**Summarize. Don't dump. Write for a technical manager, not a code dump.**

Default responses should be short and scannable — the core message intact, not a wall of text. Prefer:

- **Done** — what changed / what you found (1–3 bullets or short sentences)
- **Next** — the immediate next step (if any)
- **Need from you** — decisions, approvals, or inputs required (only when relevant)

Tone: plain language a manager with some technical background can follow. Use product and outcome wording first; name files, APIs, or implementation detail only when they matter for the decision or next step. Avoid jargon-heavy walkthroughs, long paste-backs of logs/diffs, and step-by-step narration of exploration unless asked.

Expand only when asked (deep dive, full diff walkthrough, debugging transcript). For long answers, lead with the verdict in 1–2 sentences.

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes, and replies stay short enough to skim without losing the decision points.

---

## Project overview

Offline-first Expo (React Native) Japanese learning app for Android & iOS. Free, open-source, no accounts, no subscriptions. Local-first: all progress on-device.

Prefer `docs/README.md` for working docs; `_bmad-output/` holds PRD / architecture / sprint artifacts (reference + tracking, not a feature backlog — check `docs/feedback/` before assuming a gap is intentional).

- Content: radical → kanji → vocabulary dependency graph + structured grammar + reading passages
- SRS: FSRS with weakness biasing (`0.7 × fsrs + 0.3 × weakness`); unified interleaved review
- Engagement: adaptive **goal ring** (lessons + reviews, may overshoot 100%, weekly ratchet up only — not a capacity ceiling). No Home streak; days-studied lives in Stats
- Discovery: single **Browse** surface (search + filters); passages unlock at ≥90% Guru+ coverage — no separate Read tab
- Review: **two-card kanji** (meaning + on'yomi; kun'yomi via vocab); worst-of-both SRS grade; Return-to-advance
- AI Conversation (Talk tab): BYOK (OpenAI-compatible + Anthropic); curriculum furigana-bracket replies; unknown words flagged only (no direct SRS injection). **Only network-required feature** (NFR24). Voice (on-device TTS/STT) is in scope
- Platform floor: **iOS 17 / Android 13 (API 33)** + New Architecture

## Hard conventions

- **Result type** — Fallible ops return `Result<T, AppError>` (`src/types/result.types.ts`). Do not throw across async boundaries.
- **Dual DB** — `curriculum.db` read-only content; `user.db` mutable state. Never write to `curriculum.db`. Schema changes via numbered migrations in `src/data/migrations/`.
- **Offline-first** — Everything works offline except AI Conversation (and optional cloud STT). Do not imply the rest of the app is degraded when offline.
- **BYOK boundary** — Provider keys in secure storage; sent only to user-configured HTTPS endpoints. Conversations stay local; do not inject off-curriculum words into SRS.
- **Styling** — Semantic NativeWind tokens (`bg-background`, `text-primary`, SRS/content accents, etc.). No deprecated `Colors` in `src/constants/theme.ts`; no raw hex in new code.
- **Path alias** — `@/*` → `mobile/src/*`; `@/assets/*` → `mobile/assets/*`.

## Repository layout

```
curriculum/   # JSON source → compiled SQLite
scripts/      # validate-schema, compile-curriculum
mobile/       # Expo app (all app code)
  src/app/          # Expo Router routes
  src/components/   # UI by feature
  src/core/         # Pure logic (answer eval, FSRS, import mappers)
  src/data/         # Repos, hooks, migrations, DB init
  src/providers/    # React contexts (DB, sessions, etc.)
docs/         # Working docs — see docs/README.md
_bmad-output/ # PRD, architecture, epics, sprint-status
```

## Commands

```bash
# Repo root — curriculum pipeline
npm ci && npm run validate-schema && npm run compile-curriculum
# COMPILE_OUTPUT_PATH overrides output (CI uses dist/curriculum.db)

# mobile/
npm install
npm run lint && npm run typecheck && npm test
npm start
npx expo run:ios | npx expo run:android
npx jest src/path/to/file.test.ts
```

## Architecture crux

**Dual SQLite** (`src/data/database.ts`): `curriculum.db` (bundled seed + OTA swap) and `user.db`, distributed via `DatabaseProvider`. Curriculum is `ATTACH`ed to the user handle for review/Browse joins. OTA: manifest semver → download → SHA-256 → atomic replace (`curriculumUpdate.ts`).

**Shell tabs:** Home · Browse · Talk (converse) · Stats · Settings. Lesson and review are full-screen stacks (not tabs). Legacy `learn` / `read` routes may remain with `href: null` for deep links.

**Data access:** Curriculum reads under `src/data/curriculum/`; user writes under `src/data/user/`; hooks in `src/data/hooks/`. Import mappers in `src/core/import/`; network/FS clients in `src/data/import/`.

**Review engine:** Queue in `src/core/srs/` + `useReviewQueue`; session in `ReviewSessionProvider`; answers in `src/core/answer/`. Furigana auto-hide keys on **vocabulary** mastery (not component kanji); persistent overrides in Settings / `user.db`.

## Testing / ops

- Co-located `*.test.ts(x)` and `mobile/__tests__/`; Expo modules mocked under `mobile/__mocks__/`.
- `curriculum.db` is Git LFS — `git lfs install && git lfs pull` after clone.
- CI: `npm run check-contrast` (WCAG AA tokens) at repo root; `npm run lint` in `mobile/` (a11y rules block merge unless suppressed with a one-line rationale).
