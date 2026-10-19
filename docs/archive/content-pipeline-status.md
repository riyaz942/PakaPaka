# Content pipeline — build status snapshot

Verified against the repo (item counts, `review_status` fields, existing tooling
files, `git log`) rather than trusting the plan doc's own prose, which lags
behind commits. See [content-pipeline-plan.md](../content/content-pipeline-plan.md) for
the full plan this snapshots.

Last checked: 2026-08-03. **Snapshot only — the counts below are out of date.** As of
2026-10-18 all N5 + N4 content is reviewed; current status is in
[working-history.md](../working-history.md).

## Revisions

**Top-level: Revision 1** (July 2026, whole-plan)
Changed the per-item content model after the first N5 drafts missed the
WaniKani bar: split kanji/vocab mnemonics into `meaning_mnemonic` /
`reading_mnemonic`, added `description` + `visually_similar_slugs`, dropped
grammar's one-line `mnemonic_text` in favor of the full lesson, added the
50–60% humor tone tag to passages, rewrote the cloze-nudge spec. This is what
execution-order steps `R1.1`–`R1.6` implement — it isn't a separate build
item, it's baked into the phase percentages below.

**Nested: three sub-revisions inside Phase 2b (kanji + radical mnemonics) only**

- **v1 (original)** — Kanji/radical mnemonics, 2–4 sentence cap. Superseded.
- **Rev 2** (`prompt_version 2`) — materialized Rev 1's bet: radicals lose
  their mnemonic for a long `description`; story-paragraph length; added the
  2d vocab generator. Built, partly reverted.
- **Rev 3 (current, live now)** — reverted the radical bet after reading
  generated output: radicals kept short `mnemonic_text` (~150–300 chars).
  `description` made optional everywhere (required only with look-alikes).
  Length bounds recalibrated from the reviewed N5 set. Added
  `<radical>`/`<kanji>`/`<reading>` highlight tags.
  `PROMPT_VERSION = {radical: 1, kanji: 4, vocab: 4}`.

Everything else in the plan (grammar, examples, passages) only went through
the one top-level Revision 1 — no sub-revisions.

---

## Phase-by-phase build status

### Phase 0 — Schema extensions — 100%
All fields (grammar lesson, split mnemonics, `description`,
`visually_similar_slugs`) shipped in schema/DDL/compiler.

### Phase 0.5 — Minimal lesson UI — 100%
`LessonMarkdown` renderer built and in use.

### Phase 0.6 — Item-detail surfacing — ~90%
Repos + detail/lesson UI done. Not covered: review-card mnemonic and
`PassageWordDetailSheet` still read the old `mnemonic_text` field.

### Phase 1 — Fact skeleton (importers, audit, look-alike pairs) — 100%
`import/` scripts + `reports/fact-audit.md`, `allowed-vocab-spotcheck.md`,
`visually_similar.py` (52 pairs) all present.

### Phase 2a — Grammar lessons — 43%
- N5: 74/74 written & reviewed
- N4: 0/97 — no lessons exist yet

### Phase 2b — Kanji + radical mnemonics — ~59%
- Kanji: N5 106/106 reviewed, N4 0/94
- Radicals: N5 76/76 reviewed, N4 0/33

### Phase 2c — Example sentences — ~41%
- Kanji: N5 106/106 reviewed
- Vocab: 491/1,245 total vocab generated — and those 491 are still `draft`,
  not reviewed

### Phase 2d — Vocabulary mnemonics — 57%
N5 716/716 reviewed. N4 vocab (529 words) untouched.

### Phase 2e — Cloze nudge rewrite — 43%
N5 essentially done (73/74 points have authored variants). N4 has none.

### Phase 3 — Radical images (Tier 1) — ~72%
N5 77/76 rendered, N4 1/33. This is Tier 1 (KanjiVG render) only — no sign
Tier 2 (curated AI art) has started.

### Phase 4 — Reading passages — tooling 100%, content ~5%
Full tooling shipped 2026-08-03 (`reading_seeds.py`, `reading_context.py`,
`prompts/reading-passage.md`, `validate_readings.py`, `generate_readings.py`,
fixtures, subagent workflow doc — see
[phase-4-reading-passage-tooling.md](../content/phase-4-reading-passage-tooling.md)).
Only 1 of 10 N5 seeds drafted so far (uncommitted, `review_status: draft`);
0/9 N4. Still owed: the other 9 N5 seeds, all N4 seeds, the Phase 5 read, and
the wire-in — the generated set retires all 10 hand-written N5 passages
(decided 2026-08-03).

### Phase 5 — Human review loop — 0% (tool)
The planned `npm run review-content` HTML review tool was never built —
recent review-status flips were done ad hoc, not through this tool.

---

## Bottom line

Everything is N5-only and generation-not-yet-reviewed for the newest batches
(2c / 2d / 4). N4 hasn't been touched for any content type. The review tool
(5) is the one piece with zero work started; passages (4) just went from zero
tooling to fully-tooled-but-barely-run in the latest commit.
