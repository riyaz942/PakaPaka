# Generation workflow runbooks

Maintainer runbooks for generating curriculum content **without API credentials**. These are tooling,
not app features — each is backed by real CLIs under `curriculum/_build/generate_content/`.

Two lanes, and most content types have both:

- **Web-chat lane** — the agent drives a browser chat (Gemini web) end to end. Two files per lane: the
  human-readable `…-workflow.md` (what the process is) and the `…-automation-prompt.md` (the prompt
  that runs it).
- **Subagent lane** — no browser; a Claude Code subagent generates against the same gates.

| Content | Web-chat lane | Subagent lane |
| --- | --- | --- |
| Grammar lessons | [workflow](./grammar-web-chat-workflow.md) · [automation](./grammar-web-chat-workflow-automation-prompt.md) | — |
| Radical / kanji / vocab mnemonics | [workflow](./radical-kanji-vocab-mnemonic-web-chat-workflow.md) · [automation](./radical-kanji-vocab-mnemonic-web-chat-workflow-automation-prompt.md) | [automation](./radical-kanji-vocab-mnemonic-subagent-workflow-automation-prompt.md) |
| Example sentences | [workflow](./example-sentences-web-chat-workflow.md) · [automation](./example-sentences-web-chat-workflow-automation-prompt.md) | [automation](./example-sentences-subagent-workflow-automation-prompt.md) |
| Radical mnemonic art | [workflow](./radical-art-web-chat-workflow.md) · [automation](./radical-art-web-chat-workflow-automation-prompt.md) | — |
| Reading passages | — | [automation](./reading-passages-subagent-workflow-automation-prompt.md) |
| Semantic content audit (Tier 2) | — | [automation](./semantic-audit-subagent-workflow-automation-prompt.md) |

Which of these have actually been *run* is tracked in
[../working-history.md](../working-history.md) — the runbook existing does not mean the content exists.
