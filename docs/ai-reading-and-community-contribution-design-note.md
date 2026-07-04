# AI-generated reading and community contribution — design note

## Summary

Discovery note for two post-MVP directions tracked in Epic 8 (Story 8.2): **AI-generated reading stories** (FR38-PM–FR40-PM) and **community curriculum contribution via GitHub** (FR41-PM–FR45-PM). This is a scoping document only — it exists so engineering can estimate future work without silently dropping `-PM` requirements. **No app code changes result from this story**, and nothing in the shipped MVP depends on either feature being enabled.

## AI-generated reading stories

### API key storage risks

| Risk | Detail | Mitigation direction |
| --- | --- | --- |
| At-rest exposure | A leaked key (device compromise, backup extraction) lets an attacker spend the learner's AI credits | Store in `expo-secure-store` (iOS Keychain / Android Keystore) — same pattern already used for WaniKani/Bunpro import keys in `mobile/src/data/user/credentialStore.ts`. Never write to `user.db` or logs. |
| Transmission | Reading-generation requests go directly from the device to the provider (OpenAI, Anthropic, OpenRouter) — this is the first feature in the app that requires network access outside the one-time import flow, which is a real departure from the "fully offline after initial content download" pillar (FR47) and should be called out explicitly to whoever scopes the implementation story, not waved past | HTTPS only; no custom analytics/logging of request bodies; provider selection stored alongside the key so requests never go to the wrong provider with the wrong key; UI must make clear this specific feature needs connectivity while the rest of the app does not. |
| Multi-provider key confusion | FR39-PM requires supporting OpenAI, Anthropic, and OpenRouter — a key entered for one provider must never be sent to another | Key records need a provider tag (`{provider, key}` pair), not a single global key. |
| OpenRouter credit-purchase path | FR40-PM's "obtain a key via OpenRouter" path means the app opens an OpenRouter-hosted purchase flow (likely a web view or external browser handoff) — the app itself must not handle payment card data | Use OpenRouter's own hosted checkout/redirect; the app only ever receives back an API key, never payment details. |
| Cost runaway | A buggy retry loop or malformed prompt could burn a learner's credits quickly | Client-side rate limiting / a visible "story generated" confirmation before any retry; surface provider error codes (quota exceeded, invalid key) distinctly per NFR-style error handling used elsewhere in the app. |

### Provider integration constraints

- Each provider has a different request/response shape and error model — this needs a thin adapter per provider (mirrors the existing `src/core/import/` mapper pattern: pure functions converting external formats to one internal shape).
- Generated stories must be tagged as AI-generated content (reuses the provenance tagging FR45-PM already requires for community contributions) so they're visually distinguishable from curated curriculum reading passages.

## Community curriculum contribution (GitHub-backed)

### OAuth scope minimization

| Concern | Detail | Direction |
| --- | --- | --- |
| Scope creep | A mobile app requesting broad GitHub scopes (`repo`, `admin:org`) is a disproportionate ask for "edit a kanji description" | Request the narrowest scope that can open a PR against the single curriculum repo — scoped to `contents: write` + `pull_requests: write` on this repo only, not classic OAuth `repo` scope. A candidate mechanism is a GitHub App installation token rather than a personal access token, but a fine-grained PAT conflicts with FR42-PM's "without requiring git knowledge" goal (minting a PAT is itself non-trivial GitHub literacy) — this trade-off is open for the implementation story to resolve, not decided here. |
| Client secret custody | Standard GitHub OAuth Apps require a client secret to exchange the authorization code for a token; a secret embedded in a distributed mobile binary is not a secret | A flow with **no client secret in the client** (e.g. device flow, or a GitHub App backed by a short-lived installation token minted server-side) avoids shipping any credential that could be extracted from the app package — the exact mechanism is an implementation-time choice, not fixed by this note. |
| Token lifetime | Contribution is occasional, not continuous | Token used only at submit time; not required for general app usage (FR43-PM already states this). Store via `expo-secure-store` and treat as discardable, same posture as import keys — do not persist longer than needed for the current contribution session. |
| Core app independence | The no-accounts, no-login model must hold everywhere except this flow | OAuth prompt must only ever appear when the learner explicitly starts a contribution; must never gate any core learning/review feature. |

### PR automation constraints

- The app cannot use `git` directly on-device against a live clone — it must call the GitHub REST/GraphQL API to: read the current file blob, construct a commit with the edit, create or update a branch, and open a pull request. This is a sequence of API calls, not a local git operation, and needs careful handling of the "branch already exists from a prior contribution" case.
- Batch submission (FR44-PM) implies edits accumulate locally (in `user.db`, as a queue of proposed changes) before a single commit/PR is created — this avoids one PR per edit and matches how a real contributor would work.
- Rate limiting and abuse: an unauthenticated-feeling mobile client opening PRs at will is a spam vector for a public repo. No merge-gating policy exists yet — the implementation story needs to decide whether PRs require manual maintainer review before merge (recommended, given no automated content-quality check exists) and/or a submission cap per contributor per time window.
- Provenance tagging (FR45-PM) must distinguish human-authored edits from AI-generated content (the reading-story feature above) at the data level, not just in PR description text, so downstream tooling/reviewers can filter by origin reliably.

## Cross-cutting notes

- Both directions reuse the project's existing secure-credential pattern (`expo-secure-store`) rather than introducing a new storage mechanism — consistent with architecture's "no accounts, no server-side key storage" constraint.
- Neither feature requires a schema change today; when implementation stories are scoped, the data model (curriculum provenance tags, a local contribution-edit queue table in `user.db`) should be additive, not a breaking migration.
- This note does not commit to a provider list, GitHub App vs. classic OAuth App choice, or a specific rate-limit number — those are implementation-time decisions for the future stories this note is meant to inform.

## References

- PRD FR38-PM–FR40-PM (AI-generated reading), FR41-PM–FR45-PM (community contribution) — `_bmad-output/planning-artifacts/prd.md`
- Architecture "Authentication & Security" and "Deferred Decisions (Post-MVP)" — `_bmad-output/planning-artifacts/architecture.md`
- Existing secure-storage precedent: `mobile/src/data/user/credentialStore.ts` (WaniKani/Bunpro API key handling via `expo-secure-store`)
