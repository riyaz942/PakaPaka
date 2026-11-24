#!/usr/bin/env bash
# Runs one single-session content workflow level by level. Each session is a
# new `claude -p` process; this script only starts it, waits, and checks git.
# See "Unattended runner" in docs/workflows/README.md.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/run-content-lane.sh --workflow <name> --levels <N|A-B>
         [--prompt "<values>"] [--model <model>] [--effort <level>]

  --workflow  radical-kanji-vocab-mnemonic | grammar-pool | build-answers |
              reading-passages | example-sentences
              (docs/workflows/<name>-single-session-workflow-automation-prompt.md)
  --levels    one level (6) or a range (1-20)
  --prompt    other values for the workflow, e.g. "type = radical, slug-count = 5"
  --model     claude --model (default: the CLI default)
  --effort    claude --effort: low | medium | high | xhigh | max

Each session commits its own work and ends with "LEVEL_STATUS: done" or
"LEVEL_STATUS: more". The script stops when a session fails, leaves
uncommitted changes, gives no status line, or says "more" with no new commit.
EOF
}

workflow="" levels="" extra="" model="" effort=""
while [ $# -gt 0 ]; do
  case "$1" in
    --workflow) workflow="${2:-}"; shift 2 ;;
    --levels)   levels="${2:-}";   shift 2 ;;
    --prompt)   extra="${2:-}";    shift 2 ;;
    --model)    model="${2:-}";    shift 2 ;;
    --effort)   effort="${2:-}";   shift 2 ;;
    -h|--help)  usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; usage >&2; exit 2 ;;
  esac
done
[ -n "$workflow" ] && [ -n "$levels" ] || { usage >&2; exit 2; }

if [[ "$levels" =~ ^([0-9]+)-([0-9]+)$ ]]; then
  first="${BASH_REMATCH[1]}" last="${BASH_REMATCH[2]}"
elif [[ "$levels" =~ ^[0-9]+$ ]]; then
  first="$levels" last="$levels"
else
  echo "--levels must be N or A-B, got: $levels" >&2; exit 2
fi

cd "$(git rev-parse --show-toplevel)"
prompt_file="docs/workflows/${workflow}-single-session-workflow-automation-prompt.md"
[ -f "$prompt_file" ] || { echo "No workflow prompt: $prompt_file" >&2; exit 2; }
command -v jq >/dev/null || { echo "jq is required" >&2; exit 2; }

# Finder rewrites .DS_Store at any time, so it does not count as a change.
dirty() { git status --porcelain | grep -v '\.DS_Store$' || true; }
stop() { echo; echo "STOPPED: $*" >&2; echo "Total cost so far: \$$total_cost" >&2; exit 1; }

total_cost=0
[ -z "$(dirty)" ] || stop "the working tree has uncommitted changes. Commit or stash them first."

run_dir=".content-runs/$(date +%Y%m%d-%H%M%S)-$workflow"
mkdir -p "$run_dir"

# The workflows use no MCP server and no skill, so leave both out of each
# session. That makes the start of every session smaller.
claude_args=(-p --output-format json --permission-mode auto --permission-prompts none
             --strict-mcp-config --disable-slash-commands)
[ -z "$model" ]  || claude_args+=(--model "$model")
[ -z "$effort" ] || claude_args+=(--effort "$effort")

echo "Workflow: $workflow | levels $first-$last | branch $(git branch --show-current)"
echo "Logs: $run_dir"

for ((level = first; level <= last; level++)); do
  session=0
  while :; do
    session=$((session + 1))
    name="level-$(printf %02d "$level")-session-$session"
    prompt_path="$run_dir/$name.prompt.md"
    log="$run_dir/$name.json"

    {
      cat "$prompt_file"
      printf '\n---\n\nValues for this run. They replace the example values in angle brackets above.\n\n'
      printf -- '- level = %s (a workflow that takes <levels> uses levels = %s)\n' "$level" "$level"
      [ -z "$extra" ] || printf -- '- %s\n' "$extra"
      printf '\nThis run is unattended. Nobody can answer a question, so do not ask one.\n'
      printf 'Do the whole workflow, then its last step: commit, then LEVEL_STATUS.\n'
    } > "$prompt_path"

    head_before="$(git rev-parse HEAD)"
    echo
    echo "== Level $level, session $session: running..."
    claude_ok=1
    claude "${claude_args[@]}" < "$prompt_path" > "$log" || claude_ok=0

    cost="$(jq -r '.total_cost_usd // 0' "$log" 2>/dev/null || echo 0)"
    total_cost="$(awk -v a="$total_cost" -v b="$cost" 'BEGIN { printf "%.4f", a + b }')"
    status="$(jq -r '.result // ""' "$log" 2>/dev/null \
      | grep -oE 'LEVEL_STATUS: (done|more)' | tail -1 | sed 's/LEVEL_STATUS: //' || true)"
    echo "   status: ${status:-none} | cost: \$$cost | log: $log"

    [ "$claude_ok" = 1 ] || stop "claude exited with an error. Read $log"
    [ "$(jq -r '.is_error // false' "$log")" = false ] || stop "the session ended with an error. Read $log"
    [ -z "$(dirty)" ] || stop "level $level session $session left uncommitted changes (it found issues). Run git status and read $log"

    case "$status" in
      done) echo "   level $level is done"; break ;;
      more) [ "$head_before" != "$(git rev-parse HEAD)" ] \
              || stop "level $level session $session said more but made no commit. Read $log" ;;
      *)    stop "level $level session $session gave no LEVEL_STATUS line. Read $log" ;;
    esac
  done
done

echo
echo "All levels done: $first-$last. Total cost: \$$total_cost"
