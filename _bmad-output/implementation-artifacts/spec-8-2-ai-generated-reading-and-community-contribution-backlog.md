---
title: 'AI-generated reading and community contribution — discovery design note'
type: 'chore'
created: '2026-07-04'
status: 'done'
route: 'one-shot'
---

# AI-generated reading and community contribution — discovery design note

## Intent

**Problem:** Story 8.2 requires a scoped discovery deliverable for two deferred post-MVP directions (AI-generated reading stories, GitHub-based community curriculum contribution) so engineering can estimate future work without silently dropping the `-PM` requirements — without building any of it now.

**Approach:** Wrote a single design note (`docs/ai-reading-and-community-contribution-design-note.md`) covering API key storage risks, OAuth scope minimization, and PR automation constraints for both directions, grounded in the app's actual existing secure-credential pattern and explicit that no MVP code path depends on either feature.

## Suggested Review Order

**AI-generated reading — API key risk**

- Entry point: the risk table this story exists to produce, checked against the real `credentialStore.ts` precedent rather than an assumed path.
  [`ai-reading-and-community-contribution-design-note.md:9`](../../docs/ai-reading-and-community-contribution-design-note.md#L9)

- Flags that AI reading is the first learner-initiated, per-use third-party API (curriculum OTA and import already use network), and the FR47 tension for reading features — including local persistence after generation so stories remain readable offline.
  [`ai-reading-and-community-contribution-design-note.md:14`](../../docs/ai-reading-and-community-contribution-design-note.md#L14)

**Community contribution — OAuth & PR automation**

- Scope-minimization table; explicitly leaves the PAT-vs-GitHub-App choice open rather than asserting a settled recommendation, since a PAT conflicts with FR42-PM's "no git knowledge" goal.
  [`ai-reading-and-community-contribution-design-note.md:30`](../../docs/ai-reading-and-community-contribution-design-note.md#L30)

- PR automation constraints: no local git on-device, batch submission via a local edit queue, and the still-open merge-gating question.
  [`ai-reading-and-community-contribution-design-note.md:37`](../../docs/ai-reading-and-community-contribution-design-note.md#L37)

**Peripherals**

- Compiled Epic 8 planning context (new — cached for future Epic 8 stories, regenerate if planning docs change).
  [`epic-8-context.md:1`](epic-8-context.md#L1)

- Sprint status: 8.2 moved backlog → review (no code path enabled, so no epic-level status change needed beyond the story itself).
  [`sprint-status.yaml:105`](sprint-status.yaml#L105)
