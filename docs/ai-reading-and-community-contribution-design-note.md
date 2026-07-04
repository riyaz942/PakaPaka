# AI-generated reading and community contribution — design note

## Summary

Discovery note for two post-MVP directions tracked in Epic 8 (Story 8.2): **AI-generated reading stories** (FR38-PM–FR40-PM) and **community curriculum contribution via GitHub** (FR41-PM–FR45-PM). This is a scoping document only — it exists so engineering can estimate future work without silently dropping `-PM` requirements. **No app code changes result from this story**, and nothing in the shipped MVP depends on either feature being enabled.

## AI-generated reading stories

### API key storage risks

| Risk | Detail | Mitigation direction |
| --- | --- | --- |
| At-rest exposure | A leaked key (device compromise, backup extraction) lets an attacker spend the learner's AI credits | Store in `expo-secure-store` (iOS Keychain / Android Keystore) using the same **mechanism** as WaniKani/Bunpro import keys in `mobile/src/data/user/credentialStore.ts` — not the same data model: import keys use fixed per-source key names (`wanikani` \| `bunpro`); AI keys need separate SecureStore entries per provider (e.g. `ai_credential_openai`). Never write keys to `user.db` or logs. |
| Transmission | Reading-generation requests go directly from the device to the provider (OpenAI, Anthropic, OpenRouter). This is the first **learner-initiated, per-use third-party API** feature — not the first network access outside import. Curriculum OTA checks (`curriculumUpdate.ts`), mnemonic image loads, and import flows already use network. AI reading is still a real tension with FR47's "fully offline after initial content download" pillar for **reading features** and should be called out explicitly to whoever scopes the implementation story, not waved past | HTTPS only; no custom analytics/logging of request bodies; provider binding encoded in the SecureStore key name (or a separate preference row) so requests never go to the wrong provider; validate key format per provider before send; UI must make clear this specific feature needs connectivity at generation time while the rest of the app does not |
| Multi-provider key confusion | FR39-PM requires supporting OpenAI, Anthropic, and OpenRouter — a key entered for one provider must never be sent to another | Key records need a provider tag (`{provider, key}` pair), not a single global key. This is a **design requirement for future work**, not existing code — `credentialStore.ts` stores one opaque string per fixed import source with no in-band provider metadata |
| OpenRouter credit-purchase path | FR40-PM's "obtain a key via OpenRouter" path means the app opens an OpenRouter-hosted purchase flow (likely a web view or external browser handoff) — the app itself must not handle payment card data | Use OpenRouter's own hosted checkout/redirect; the app only ever receives back an API key, never payment details. The redirect handoff itself is a risk vector (custom URL scheme / deep-link interception by a malicious app registering the same scheme) — use universal links or a verified redirect callback where possible, and never log the returned key |
| Cost runaway | A buggy retry loop or malformed prompt could burn a learner's credits quickly | Client-side rate limiting / a visible "story generated" confirmation before any retry; surface provider error codes (quota exceeded, invalid key) distinctly per NFR-style error handling used elsewhere in the app. Client-side limits are bypassable on a compromised device — also document reliance on provider-side spend caps / per-key quota limits where available |

### Provider integration constraints

- Each provider has a different request/response shape and error model — this needs a thin adapter per provider (mirrors the existing `src/core/import/` mapper pattern: pure functions converting external formats to one internal shape).
- Generated stories must be tagged as AI-generated content so they're visually distinguishable from curated curriculum reading passages. FR45-PM's provenance model for community contributions is the **conceptual precedent**; a shared provenance schema across both features is future work, not something that exists today.
- **FR47 compliance:** FR47 covers pre-seeded `curriculum.db` reading passages. AI-generated stories require network at generation time but must be **persisted locally in `user.db`** after creation so they remain readable offline — they cannot be written to the read-only on-device `curriculum.db`.

## Community curriculum contribution (GitHub-backed)

### OAuth scope minimization

| Concern | Detail | Direction |
| --- | --- | --- |
| Scope creep | A mobile app requesting broad GitHub scopes (`repo`, `admin:org`) is a disproportionate ask for "edit a kanji description" | Target the narrowest **GitHub App installation permissions** on the single curriculum repo: Contents (Read and write) + Pull requests (Read and write). These are **not** classic OAuth App scope strings — classic OAuth uses `repo` / `public_repo`, and `public_repo` grants write to all public repos the user can access, failing the least-privilege goal. A GitHub App installation token is the likely mechanism; user-minted fine-grained PATs conflict with FR42-PM's "without requiring git knowledge" goal — this trade-off is open for the implementation story to resolve, not decided here |
| Client secret custody | Standard GitHub OAuth Apps require a client secret to exchange the authorization code for a token; a secret embedded in a distributed mobile binary is not a secret | A flow with **no client secret in the client** (e.g. device flow, or a GitHub App backed by a short-lived installation token minted server-side) avoids shipping any credential that could be extracted from the app package. A server-side token broker would be the app's first backend component — an implementation-time fork (pure-client device flow vs. minimal broker holding the GitHub App private key), not fixed by this note |
| Token lifetime | Contribution is occasional, not continuous | GitHub token used only between OAuth callback and PR submit; not required for general app usage (FR43-PM). Store via `expo-secure-store`, delete on submit success/failure or session abandon — **not** the same lifecycle as import keys (discarded after confirm) or AI keys (persist until learner removes) |
| Core app independence | The no-accounts, no-login model must hold everywhere except this flow | OAuth prompt must only ever appear when the learner explicitly starts a contribution; must never gate any core learning/review feature |

### PR automation constraints

- The app cannot use `git` directly on-device against a live clone — it must call the GitHub REST/GraphQL API to: read the current file blob, construct a commit with the edit, create or update a branch, and open a pull request. This is a sequence of API calls, not a local git operation, and needs careful handling of the "branch already exists from a prior contribution" case and **stale base SHA** when the curriculum repo advanced while edits were queued locally.
- Batch submission (FR44-PM) implies edits accumulate locally in `user.db` (as a queue of proposed changes with `{item_id, json_file_path, field, old_hash, new_value, provenance}`) before a single commit/PR is created. PRs must target **`curriculum/**/*.json` in the source repo**, not on-device SQLite rows — the compile pipeline (JSON → CI → `curriculum.db` LFS) is the path merged content takes to reach learners via OTA (FR48).
- Rate limiting and abuse: an unauthenticated-feeling mobile client opening PRs at will is a spam vector for a public repo. No merge-gating policy exists yet — the implementation story needs to decide whether PRs require manual maintainer review before merge (recommended, given no automated content-quality check exists) and/or a submission cap per contributor per time window.
- Provenance tagging (FR45-PM) must distinguish human-authored edits from AI-generated content (the reading-story feature above) at the data level, not just in PR description text, so downstream tooling/reviewers can filter by origin reliably. For merged curriculum content, provenance flows through the compile pipeline into build-time metadata — not direct runtime mutation of `curriculum.db` on device.

## Cross-cutting notes

- Both directions reuse the project's existing secure-storage **mechanism** (`expo-secure-store`) rather than introducing a new storage technology — consistent with architecture's "no accounts, no server-side key storage" constraint. Credential **lifetimes** differ:

  | Credential type | Lifetime | Storage |
  | --- | --- | --- |
  | Import (WaniKani/Bunpro) | Ephemeral — discarded after successful import confirm; may persist if user cancels before confirm | `expo-secure-store`, fixed key per source |
  | AI provider (BYO) | Persistent — retained until learner removes in settings | `expo-secure-store`, one key per provider |
  | GitHub OAuth | Session-scoped — discarded after submit or abandon | `expo-secure-store`, discard on completion |

- No MVP schema change is required now. When implementation stories are scoped, expect **additive `user.db` migrations only** (e.g. `contribution_queue`, `ai_reading_stories`, provenance columns) — `curriculum.db` schema stays unchanged; new curriculum content arrives via the compile pipeline and OTA update.
- This note does not commit to a provider list, GitHub App vs. classic OAuth App choice, or a specific rate-limit number — those are implementation-time decisions for the future stories this note is meant to inform.

## References

- PRD FR38-PM–FR40-PM (AI-generated reading), FR41-PM–FR45-PM (community contribution) — `_bmad-output/planning-artifacts/prd.md`
- Architecture "Authentication & Security" and "Deferred Decisions (Post-MVP)" — `_bmad-output/planning-artifacts/architecture.md`
- Existing secure-storage precedent: `mobile/src/data/user/credentialStore.ts` (WaniKani/Bunpro API key handling via `expo-secure-store`)
- Existing non-import network precedent: `mobile/src/data/curriculum/curriculumUpdate.ts` (Wi‑Fi-gated curriculum OTA)
