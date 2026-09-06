#!/usr/bin/env bash
#
# Runs the single-session radical/kanji/vocab mnemonic workflow repeatedly.
# Each iteration is a brand-new `claude -p` session (no subagents, no shared
# context) that executes the workflow prompt once and then exits. The next
# iteration starts a fresh session, which auto-selects the next batch of slugs
# from the checked-in sidecar — so running back-to-back just walks the layer
# forward, one session per batch.
#
# Usage:  ./scripts/run-mnemonic-workflow-loop.sh

set -uo pipefail

# ─────────────────────────────────────────────────────────────────────────────
# CHANGE THIS: how many Claude sessions to run back-to-back.
ITERATIONS=2
# ─────────────────────────────────────────────────────────────────────────────

# CHANGE THIS if you want a different drafting model. This value is also passed
# to the workflow's Step 4 ingest as --model, so keep it honest.
MODEL="claude-sonnet-5"

# CHANGE THIS to raise/lower reasoning effort per session: low, medium, high,
# xhigh, max. The workflow asks for "high effort" for the actual mnemonic prose;
# xhigh/max cost more but think harder.
EFFORT="high"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROMPT_FILE="$REPO_ROOT/docs/workflows/radical-kanji-vocab-mnemonic-single-session-workflow-automation-prompt.md"

if [[ ! -f "$PROMPT_FILE" ]]; then
  echo "Prompt file not found: $PROMPT_FILE" >&2
  exit 1
fi

cd "$REPO_ROOT"

for (( i=1; i<=ITERATIONS; i++ )); do
  echo "════════════════════════════════════════════════════════════════"
  echo "Session $i of $ITERATIONS  —  $(date '+%Y-%m-%d %H:%M:%S')"
  echo "════════════════════════════════════════════════════════════════"

  # Fresh session each time: `claude -p` with no --resume/--continue.
  # --dangerously-skip-permissions is required because the loop is unattended
  # and the workflow runs python/ingest/generate.py and edits reply files.
  claude -p \
    --model "$MODEL" \
    --effort "$EFFORT" \
    --dangerously-skip-permissions \
    < "$PROMPT_FILE"
  status=$?

  echo
  echo "Session $i finished (exit $status)  —  $(date '+%Y-%m-%d %H:%M:%S')"
  echo

  if [[ $status -ne 0 ]]; then
    echo "WARNING: session $i exited non-zero; continuing to next iteration." >&2
  fi
done

echo "All $ITERATIONS session(s) done."
echo "Remember: run 'npm run validate-schema' and 'npm run compile-curriculum'"
echo "from the repo root once, now that the batch is finished."
