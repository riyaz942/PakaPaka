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
ITERATIONS=5
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

# Timestamped log line to the terminal.
log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Human-readable duration from a second count.
fmt_dur() { printf '%dm%02ds' $(( $1 / 60 )) $(( $1 % 60 )); }

run_start=$(date +%s)
declare -a RESULTS=()

for (( i=1; i<=ITERATIONS; i++ )); do
  echo "════════════════════════════════════════════════════════════════"
  log "Session $i of $ITERATIONS — starting"
  echo "════════════════════════════════════════════════════════════════"

  s_start=$(date +%s)

  # Fresh session each time: `claude -p` with no --resume/--continue.
  # --verbose streams each turn + tool call to the terminal so you can watch
  #   the workflow progress instead of waiting for a silent final message.
  # --dangerously-skip-permissions is required because the loop is unattended
  #   and the workflow runs python/ingest/generate.py and edits reply files.
  claude -p \
    --model "$MODEL" \
    --effort "$EFFORT" \
    --verbose \
    --dangerously-skip-permissions \
    < "$PROMPT_FILE"
  status=$?

  s_end=$(date +%s)
  dur=$(fmt_dur $(( s_end - s_start )))

  echo
  if [[ $status -eq 0 ]]; then
    log "Session $i of $ITERATIONS — finished OK in $dur (exit 0)"
    RESULTS+=("session $i: OK    $dur")
  else
    log "Session $i of $ITERATIONS — FAILED in $dur (exit $status); continuing"
    RESULTS+=("session $i: FAIL  $dur  (exit $status)")
  fi
  echo
done

total=$(fmt_dur $(( $(date +%s) - run_start )))
echo "════════════════════════════════════════════════════════════════"
log "All $ITERATIONS session(s) done in $total"
for r in "${RESULTS[@]}"; do echo "  $r"; done
echo "════════════════════════════════════════════════════════════════"
echo "Remember: run 'npm run validate-schema' and 'npm run compile-curriculum'"
echo "from the repo root once, now that the batch is finished."

# peon-ping has no "fire one event" command; `preview` is its documented way to
# play a category's sound(s) from a script. task.complete = the "work complete"
# chime. Guarded so the loop still works if peon isn't installed / on PATH.
if command -v peon >/dev/null 2>&1; then
  peon notifications label "mnemonic workflow loop: all $ITERATIONS session(s) finished"
  peon preview task.complete
  peon notifications label reset
fi
