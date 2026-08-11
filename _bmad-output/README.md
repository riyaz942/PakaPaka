# _bmad-output

BMAD planning and story artifacts. **Reference and tracking, not a feature backlog** — a gap here
does not mean work is missing. Check [`docs/feedback/`](../docs/feedback/README.md) first.

For done / not-done status of anything in here, see
[`docs/working-history.md`](../docs/working-history.md).

## What's in each folder

| Folder | Contents |
| --- | --- |
| `planning-artifacts/` | PRD, architecture, epics, UX spec, product brief, readiness reports, market research |
| `implementation-artifacts/` | Story files, specs, `sprint-status.yaml` (the live tracker), `deferred-work.md` |
| `brainstorming/` | Raw brainstorm session transcripts — inputs to the plans, superseded by them |

## Two generations of story files share one folder

`implementation-artifacts/` holds stories from two different epic sets, which is the main source of
confusion when reading it:

- **Wave 1 — MVP epics** (story files dated May–early July 2026, e.g. `1-1-bootstrap-expo-sdk-55…`,
  `3-4-local-anki-apkg-import`). These came from an epics document that
  `planning-artifacts/epics.md` has since **replaced**, so their epic numbers no longer match
  anything. 40 files, all `done` except `3-3-bunpro-import-or-documented-fallback` (`review`).
  Treat them as a shipped-work archive.
- **Wave 2 — current epics** (dated 2026-07-17 onward, e.g. `1-1-two-card-kanji-grading`,
  `9-1-backup-format-and-export`). These match `planning-artifacts/epics.md` and are the ones
  `sprint-status.yaml` tracks.

Both waves reuse numbers like `1-1` and `3-2`, so **always match by the full slug**, never by number
alone.

## Authority order

1. `implementation-artifacts/sprint-status.yaml` — per-story status, updated by the BMAD workflows.
2. `docs/working-history.md` — everything else, verified against the codebase.
3. `planning-artifacts/epics.md` — intent for wave 2; not a status record.

Story files themselves also carry a `Status:` line, which is what `sprint-status.yaml` mirrors.
