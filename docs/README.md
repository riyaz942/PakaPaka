# Docs

Working docs for the Japanese learning app. Historical BMAD planning (PRD, architecture, epics) lives in `_bmad-output/` — reference only.

For detailed done / not-done status, see [working-history.md](./working-history.md).

## Active work

| Doc | Notes |
| --- | --- |
| [app-overview.md](./app-overview.md) | What the app is, the learner flow, and what each screen does |
| [known-issues.md](./known-issues.md) | Confirmed open defects found outside their discovering story's scope |
| [content/content-pipeline-plan.md](./content/content-pipeline-plan.md) | Master content-quality plan (grammar depth, mnemonics, attribution) |
| [workflows/](./workflows/) | No-API generation runbooks: web-chat + browser automation prompts, and subagent automation prompts |
| [design/redesign-v2/](./design/redesign-v2/README.md) | Design System v2 restyle — **done** (Sessions 1–8). Spec + decisions/deviations log. |

## Maintainer runbooks

| Doc | Notes |
| --- | --- |
| [content/radical-mnemonic-images.md](./content/radical-mnemonic-images.md) | Radical mnemonic images in-repo → bundled in app build |
| [content/phase-4-reading-passage-tooling.md](./content/phase-4-reading-passage-tooling.md) | Reading-passage generation (N5): seeds, tone mix, closed-loop gate — tooling built, run not done |
| [content/furigana-support-plan.md](./content/furigana-support-plan.md) | Furigana schema / pipeline / UI (shipped; reference) |

## Feedback plans

Playtest and grammar-review follow-ups: [feedback/](./feedback/) (plans 01–10). Most core work is done; remaining content authoring is tracked in plan 09.

## Design notes

| Doc | Notes |
| --- | --- |
| [design/ai-reading-and-community-contribution-design-note.md](./design/ai-reading-and-community-contribution-design-note.md) | Post-MVP Epic 8 scoping (no app work by design) |

## Archive

Closed investigations and historical notes:

| Doc | Notes |
| --- | --- |
| [archive/bunpro-import-investigation.md](./archive/bunpro-import-investigation.md) | Bunpro API limits; best-effort import shipped |
