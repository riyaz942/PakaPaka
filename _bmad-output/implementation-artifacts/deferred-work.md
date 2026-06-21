# Deferred Work

## Deferred from: code review of 4-3-item-detail-screens-kanji-vocabulary-grammar (2026-06-21)

- **Vocabulary examples absent from bundled N5 curriculum** — `compile-curriculum.ts` only inserts `example_sentences` for grammar items; vocabulary detail UI is implemented but bundled seed has no vocab-keyed sentences. Address in curriculum compiler or data story.
- **Uncaught JSON.parse in getGrammarRule** — Spec assumes compile-time JSON validation; defensive parsing can be added if corrupt DB rows become a concern.
- **Number(itemId) coercion for non-numeric params** — Pre-existing repository pattern from Story 4.2; route param validation is a cross-cutting concern.
