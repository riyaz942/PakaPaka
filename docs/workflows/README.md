# Generation workflow runbooks

Maintainer runbooks for generating curriculum content **without API credentials**. These are tooling,
not app features — each is backed by real CLIs under `curriculum/_build/generate_content/`.

Three lanes, and most content types have more than one:

- **Web-chat lane** — the agent drives a browser chat (Gemini web) end to end. Two files per lane: the
  human-readable `…-workflow.md` (what the process is) and the `…-automation-prompt.md` (the prompt
  that runs it).
- **Subagent lane** — no browser; a Claude Code subagent generates against the same gates.
- **Single-session lane** — no browser and no subagent; the session itself writes the content, one
  small batch per session. Same auto-select, same gates, same repair budget as the subagent lane.

| Content | Web-chat lane | Subagent lane | Single-session lane |
| --- | --- | --- | --- |
| Grammar lessons | [workflow](./grammar-web-chat-workflow.md) · [automation](./grammar-web-chat-workflow-automation-prompt.md) | [automation](./grammar-subagent-workflow-automation-prompt.md) | — |
| Radical / kanji / vocab mnemonics | [workflow](./radical-kanji-vocab-mnemonic-web-chat-workflow.md) · [automation](./radical-kanji-vocab-mnemonic-web-chat-workflow-automation-prompt.md) | [automation](./radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md) | [automation](./radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md) |
| Example sentences | [workflow](./example-sentences-web-chat-workflow.md) · [automation](./example-sentences-web-chat-workflow-automation-prompt.md) | [automation](./example-sentences-subagent-workflow-automation-prompt.md) | — |
| Radical mnemonic art | [workflow](./radical-art-web-chat-workflow.md) · [automation](./radical-art-web-chat-workflow-automation-prompt.md) | — | — |
| Reading passages | — | [automation](./reading-passages-subagent-workflow-automation-prompt.md) | [automation](./reading-passages-single-session-workflow-automation-prompt.md) |
| Reading passage naturalness review | — | [automation](./reading-passage-naturalness-subagent-workflow-automation-prompt.md) | — |

The naturalness review is built into **both** reading-passage generation lanes —
Step 4 of the subagent lane, Step 5 of the single-session lane — so a passage
leaves either run having been read for naturalness, not only gated for mechanics.
It is the one place the single-session lane spawns a subagent, because the
session that wrote a passage is exactly the model that must not review it. The
review's own runbook is for the other job: backfilling a level, or re-reviewing
after `REVIEW_VERSION` changes.
| Semantic content audit (Tier 2) | — | [automation](./semantic-audit-subagent-workflow-automation-prompt.md) | — |

Which of these have actually been *run* is tracked in
[../working-history.md](../working-history.md) — the runbook existing does not mean the content exists.

Curriculum Studio's **Guide** tab (`npm run studio` → <http://localhost:4701/guide>) is the
interactive index over this folder: the same stages and commands, with live gap counts per level
and links from every completeness percentage and audit finding into the step that fixes it. These
files stay the full detail; the Guide is the summary you work from.
