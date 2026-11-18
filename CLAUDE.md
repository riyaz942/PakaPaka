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

## 5. Communication style
Use ASD-STE-100 when you speak to the operator.

---

## Project overview

Offline-first Expo (React Native) Japanese learning app for Android & iOS. Free, open-source, no subscriptions. Optional Google sign-in for sync (no account needed). Local-first: all progress on-device.

Prefer `docs/README.md` for working docs; `_bmad-output/` holds PRD / architecture / sprint artifacts (reference + tracking, not a feature backlog — check `docs/feedback/` before assuming a gap is intentional).

**Done / not-done status for every plan lives in one place: `docs/working-history.md`.** Read it before assuming something is unbuilt, and update it when a plan's status changes. `_bmad-output/implementation-artifacts/sprint-status.yaml` is authoritative for per-story BMAD status; `_bmad-output/README.md` explains why two generations of story files share that folder.

- Content: radical → kanji → vocabulary dependency graph + structured grammar + reading passages
- SRS: FSRS with weakness biasing (`0.7 × fsrs + 0.3 × weakness`); unified interleaved review
- Engagement: **goal ring** = today's lesson allowance + today's reviews (done + still due), may overshoot 100%; no stored goal, no weekly ratchet. Intensity preset = new lesson items/day; reviews are never capped. No Home streak; days-studied lives in Stats
- Discovery: single **Browse** surface (search + filters); passages unlock at ≥90% Guru+ coverage — no separate Read tab
- Review: **two-card kanji** (meaning + on'yomi; kun'yomi via vocab); worst-of-both SRS grade; Return-to-advance
- AI Conversation (Talk tab): BYOK (OpenAI-compatible + Anthropic); curriculum furigana-bracket replies; unknown words flagged only (no direct SRS injection). **Network-required** (NFR24); sign-in and sync (web + mobile) also use the network, and are optional. Voice (on-device TTS/STT) is in scope
- Sync (optional, signed-in only): built (not deployed yet; see docs/working-history.md). One progress file per user (the backup format, no conversations); three-way merge on the device; one conflict dialog when both devices changed the same row
- Platform floor: **iOS 17 / Android 13 (API 33)** + New Architecture

## Hard conventions

- **Result type** — Fallible ops return `Result<T, AppError>` (`src/types/result.types.ts`). Do not throw across async boundaries.
- **Dual DB** — `curriculum.db` read-only content; `user.db` mutable state. Never write to `curriculum.db`. Schema changes via numbered migrations in `src/data/migrations/`.
- **Offline-first** — Everything works offline except AI Conversation, optional sign-in/sync (and optional cloud STT). Do not imply the rest of the app is degraded when offline.
- **Server boundary** — The server never receives BYOK keys or AI conversations. The server never stores, logs or uses your email. On mobile, the Google sign-in token can contain it; the server reads only the account ID (`sub`). Web sign-in asks only for `openid`. Never log tokens, ID tokens, request bodies or auth headers.
- **BYOK boundary** — Provider keys in secure storage; sent only to user-configured HTTPS endpoints. Conversations stay local; do not inject off-curriculum words into SRS.
- **Styling** — Semantic NativeWind tokens (`bg-background`, `text-primary`, SRS/content accents, etc.). No deprecated `Colors` in `src/constants/theme.ts`; no raw hex in new code.
- **Sync** — merge decisions use row content, never `updatedAt`; sync code uses the async SQLite API (`src/data/sync/`), merge rules are pure functions in `src/core/sync/`; a new `user.db` table must be added to `BackupData` and `SYNC_TABLES` or named as device-only; sign-out syncs, then erases the device; a session that ends elsewhere erases only when nothing is unsynced, else asks.
- **Path alias** — `@/*` → `mobile/src/*`; `@/assets/*` → `mobile/assets/*`.

## Commands

```bash
# Repo root — curriculum pipeline
npm ci && npm run validate-schema && npm run compile-curriculum
# COMPILE_OUTPUT_PATH overrides output (CI uses dist/curriculum.db)

# backend/ — Cloudflare Worker (web host, /api/*, /auth/*)
cd backend && npm test && npm run typecheck
```

## Architecture crux

**Dual SQLite** (`src/data/database.ts`): `curriculum.db` (bundled seed + OTA swap) and `user.db`, distributed via `DatabaseProvider`. Curriculum is `ATTACH`ed to the user handle for review/Browse joins. OTA: manifest semver → download → SHA-256 → atomic replace (`curriculumUpdate.ts`).

**Sync base:** `sync_base` (one row in `user.db`) holds the last synced file, its revision and the keys of base rows that `user.db` does not hold yet (carried keys); the three-way merge compares local and remote against it.

**Shell tabs:** Home · Browse · Talk (converse) · Stats · Settings. Lesson and review are full-screen stacks (not tabs). Legacy `learn` / `read` routes may remain with `href: null` for deep links.

**Review engine:** Queue in `src/core/srs/` + `useReviewQueue`; session in `ReviewSessionProvider`; answers in `src/core/answer/`. Furigana auto-hide keys on **vocabulary** mastery (not component kanji); persistent overrides in Settings / `user.db`.

## Testing / ops

- Co-located `*.test.ts(x)` and `mobile/__tests__/`; Expo modules mocked under `mobile/__mocks__/`.
- `curriculum.db` is Git LFS — `git lfs install && git lfs pull` after clone.
- CI: `npm run check-contrast` (WCAG AA tokens) at repo root; `npm run lint` in `mobile/` (a11y rules block merge unless suppressed with a one-line rationale).
