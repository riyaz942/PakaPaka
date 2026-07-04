# Epic 8 Context: Post-MVP expansion (shadow mode, AI stories, community curriculum)

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Track three deferred, post-MVP product directions — shadow mode (trial-alongside-existing-tools positioning), AI-generated reading stories, and a community curriculum contribution pipeline — so that these features are not silently dropped from scope, while making explicit that no MVP epic depends on them. This epic exists mainly to preserve requirements traceability and to capture early design/risk notes; it has no MVP engineering dependency, and the data model must not preclude these features later.

## Stories

- Story 8.1: Shadow mode (positioning, stats, switch prompts)
- Story 8.2: AI-generated reading and community contribution backlog (discovery/design-note story, not full implementation)

## Requirements & Constraints

**Shadow mode:**
- Gated behind a feature flag, off by default; when enabled, UI copy must position the app as a parallel/trial tool ("try before you commit"), not a replacement — this is a positioning/copy concern, not a scheduling change.
- Shadow mode must not alter or break FSRS scheduling assumptions — reviews continue to be scheduled normally.
- Post-session stats in shadow mode add comparison metrics (retention rate, items covered across domains, total time) on top of the standard session summary, shown only when the underlying data exists.
- After sustained use (spec: 1–2 weeks; story AC uses ≥14 days), show a non-blocking, dismissible/snoozable prompt asking if the learner is ready to switch fully. No forced migration path — the learner can decline indefinitely.
- Depends on import already having happened (shadow mode is for learners who imported progress from an existing tool).

**AI-generated reading stories:**
- Learners supply an AI API key — either bring-your-own or obtained by purchasing credits via OpenRouter — to generate reading stories built from their currently-active kanji, vocabulary, and grammar (narrative reinforcement of in-progress material).
- Must support multiple AI providers (OpenAI, Anthropic, OpenRouter) behind a stored key, with error handling per provider.

**Community contribution pipeline:**
- Contributors propose edits to curriculum content (kanji descriptions, readings, grammar details, synonyms, example sentences) via an in-app flow.
- The system generates a GitHub branch and PR from those edits without requiring the contributor to know git.
- GitHub OAuth is used only for this contribution flow, not for core app usage (core app remains fully accountless).
- Contributors can accumulate multiple local edits and batch-submit as one contribution.
- All contributed content must be tagged with provenance (human-authored vs. AI-generated) so reviewers/users can distinguish origin.

**Cross-cutting constraint for this epic:** no MVP code path may depend on any Epic 8 feature being enabled. Story 8.2 in particular is a discovery/scoping deliverable (a short design note covering API key storage risk, OAuth scope minimization, and PR-automation constraints), not a full feature build.

## Technical Decisions

- Community contribution pipeline architecture (GitHub OAuth flow, PR generation mechanics) and AI provider integration patterns (BYO-key vs. OpenRouter credit purchase) are explicitly deferred architectural decisions — not yet designed in detail, intentionally scoped out of MVP architecture.
- API keys (for AI providers, same pattern as WaniKani/Bunpro import) should follow the existing secure-storage convention: `expo-secure-store` (iOS Keychain / Android Keystore), discardable after use. No accounts or server-side key storage.
- GitHub OAuth, when built, is scoped narrowly to the contribution flow and must not introduce any auth requirement for core app usage — the app's no-accounts, no-login model is a hard constraint everywhere else.
- Post-MVP features must not shape MVP architecture, but the `curriculum.db` / `user.db` data model must remain compatible with them — e.g., schema should be able to later accommodate contribution provenance tagging and AI-story-specific content without a breaking redesign.
- No new cross-database join patterns or schema changes are introduced by this epic now; this is a scope-preservation and discovery epic.

## Cross-Story Dependencies

- Epic 8 has no MVP engineering dependency and no other epic depends on it.
- Shadow mode (8.1) implicitly depends on the Import epic (Epic 3) having already run, since it targets learners who imported progress from an existing tool.
- Story 8.2's output (design note on API key storage, OAuth scoping, PR automation) is meant to inform future, separately-scoped implementation stories for AI reading and community contribution — it does not itself implement those features.
