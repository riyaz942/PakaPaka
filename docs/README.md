# Docs

Working docs for the Japanese learning app.

**Looking for what's done and what's left? → [working-history.md](./working-history.md).** That is the
single status index for every plan in this repo, docs and BMAD alike. Nothing else tracks status.

## Start here

| Doc | What it is |
| --- | --- |
| [working-history.md](./working-history.md) | **Status index** — one status per plan, plus what's left |
| [app-overview.md](./app-overview.md) | What the app is, the learner flow, what each screen does |
| [srs-system-vs-wanikani.md](./srs-system-vs-wanikani.md) | How SRS stages work and what each stage gates |
| [../README.md](../README.md) | Setup, build, and run instructions |

## Plans by area

| Area | Contents |
| --- | --- |
| [feedback/](./feedback/README.md) | Playtest follow-ups, plans 01–06 and 11–15 — all done (07–10 archived) |
| [superpowers/](./superpowers/) | Recent design specs and implementation plans (grammar Read + Build, grammar pool, linked words, grammar mnemonics, reading mnemonics) |
| [content/](./content/) | Curriculum content quality: pipeline plan, audit plan, furigana, radical images, passages, kanji coverage |
| [design/](./design/) | Design System v2 restyle, Curriculum Studio, backup/web build, customizable Home, level-agnostic curriculum, schema migration, platform spikes |
| [workflows/](./workflows/README.md) | Maintainer generation runbooks (web-chat, subagent and single-session lanes) |

## Defects

| Log | What goes in it |
| --- | --- |
| [known-issues.md](./known-issues.md) | Confirmed open defects found outside their discovering story's scope |
| [codebase-issues.md](./codebase-issues.md) | Findings from the 2026-07-05 manual review of `mobile/src` and `scripts/` |
| [../_bmad-output/implementation-artifacts/deferred-work.md](../_bmad-output/implementation-artifacts/deferred-work.md) | Review findings consciously *not* fixed |

## Elsewhere in the repo

- [`_bmad-output/`](../_bmad-output/README.md) — PRD, architecture, epics, and story files. Reference and tracking, not a feature backlog.
- [`web/README.md`](../web/README.md) — Curriculum Studio, the local curriculum browser/editor (`npm run studio`).
- [`archive/`](./archive/README.md) — superseded plans (grammar cloze 07–10), stale snapshots, closed investigations. Do not plan from these.
