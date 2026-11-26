#!/usr/bin/env bash
# Runs one single-session content workflow level by level. Each session is a
# new `claude -p` process; this script only starts it, waits, and checks git.
# See "Unattended runner" in docs/workflows/README.md.
set -euo pipefail

usage() {
  cat <<'EOF'
Usage: scripts/run-content-lane.sh --workflow <name> --levels <N|A-B>
         [--type <type>] [--prompt "<values>"] [--model <model>] [--effort <level>]

  --workflow  radical-kanji-vocab-mnemonic | grammar-pool | build-answers |
              reading-passages | example-sentences
              (docs/workflows/<name>-single-session-workflow-automation-prompt.md)
  --levels    one level (6) or a range (1-20)
  --type      radical | kanji | vocab | grammar (required for the mnemonic lane)
  --prompt    other values for the workflow, comma-separated,
              e.g. "slug-count = 5" or "type = radical, slug-count = 5"
  --model     claude --model (default: the CLI default)
  --effort    claude --effort: low | medium | high | xhigh | max

Before each session, the script counts the items left at the level
(generate_content/lane_remaining.py) and skips the level when there are none.
The batch size (slug-count, point-count or seed-count; from --prompt, else the
prompt's example value) is a target. The script splits the items left into
equal sessions near that size. A remainder of up to 3 items (and at most half
the batch size) goes into the other sessions, not into a session of its own.
With point-count = 6: 7 or 9 items left -> 1 session; 10 -> 5 + 5; 13 -> 7 + 6.
Each session commits its own work and ends with "LEVEL_STATUS: done" or
"LEVEL_STATUS: more". The script stops when a session fails, leaves
uncommitted changes, gives no status line, or says "more" with no new commit.
EOF
}

workflow="" levels="" kind="" extra="" model="" effort=""
while [ $# -gt 0 ]; do
  case "$1" in
    --workflow) workflow="${2:-}"; shift 2 ;;
    --levels)   levels="${2:-}";   shift 2 ;;
    --type)     kind="${2:-}";     shift 2 ;;
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

# The batch-size value of the prompt, for example `<point-count = 6>`.
count_default="$(grep -m1 -oE '<[a-z]+-count = [0-9]+>' "$prompt_file" || true)"
[[ "$count_default" =~ ^\<([a-z]+-count)\ =\ ([0-9]+)\>$ ]] \
  || { echo "No <...-count = N> value in $prompt_file" >&2; exit 2; }
count_key="${BASH_REMATCH[1]}" size="${BASH_REMATCH[2]}"

# Split --prompt into its values. The script sets the batch-size value for each
# session, so take it out of the others.
other_values=""
while IFS= read -r pair; do
  [[ "$pair" =~ ^[[:space:]]*(.*[^[:space:]])[[:space:]]*$ ]] || continue
  pair="${BASH_REMATCH[1]}"
  if [[ "$pair" =~ ^${count_key}[[:space:]]*=[[:space:]]*(.*)$ ]]; then
    size="${BASH_REMATCH[1]}"
  else
    other_values+="- $pair"$'\n'
  fi
done < <(printf '%s\n' "$extra" | tr ',' '\n')
[[ "$size" =~ ^[1-9][0-9]*$ ]] || { echo "$count_key must be a positive number, got: $size" >&2; exit 2; }

# Sessions for $1 items at $size items per session. A remainder of up to 3
# items, and at most half of $size, goes into the other sessions.
sessions_for() {
  local sessions=$(( ($1 + size - 1) / size )) rest=$(( $1 % size )) slack=$(( size / 2 ))
  [ "$slack" -le 3 ] || slack=3
  if [ "$sessions" -gt 1 ] && [ "$rest" -gt 0 ] && [ "$rest" -le "$slack" ]; then
    sessions=$((sessions - 1))
  fi
  echo "$sessions"
}

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

# A prompt names its level value `levels` (a range) or `level`. The run value
# must use the same name, or the session keeps the example value in the prompt.
if grep -q '<levels = ' "$prompt_file"; then level_key=levels; else level_key=level; fi

echo "Workflow: $workflow | levels $first-$last | $count_key $size | branch $(git branch --show-current)"
echo "Logs: $run_dir"

# Items still to do at a level, from the same selection as the lane's Step 1.
remaining() {
  (cd curriculum/_build && .venv/bin/python -m generate_content.lane_remaining \
     --workflow "$workflow" --level "$1" ${kind:+--type "$kind"})
}

for ((level = first; level <= last; level++)); do
  left="$(remaining "$level")" || stop "could not count the items left at level $level (see the error above)"
  if [ "$left" = 0 ]; then
    echo; echo "== Level $level: nothing left, skipped"
    continue
  fi
  echo; echo "== Level $level: $left item(s) left, $(sessions_for "$left") session(s) planned"
  session=0
  while :; do
    session=$((session + 1))
    sessions="$(sessions_for "$left")"
    batch=$(( (left + sessions - 1) / sessions ))
    name="level-$(printf %02d "$level")-session-$session"
    prompt_path="$run_dir/$name.prompt.md"
    log="$run_dir/$name.json"

    {
      cat "$prompt_file"
      printf '\n---\n\nValues for this run. They replace the example values in angle brackets above.\n\n'
      printf -- '- %s = %s\n' "$level_key" "$level"
      [ -z "$kind" ] || printf -- '- type = %s\n' "$kind"
      printf -- '- %s = %s\n' "$count_key" "$batch"
      printf '%s' "$other_values"
      printf '\nThis run is unattended. Nobody can answer a question, so do not ask one.\n'
      printf 'Do the whole workflow, then its last step: commit, then LEVEL_STATUS.\n'
    } > "$prompt_path"

    head_before="$(git rev-parse HEAD)"
    echo "-- level $level, session $session: $batch of $left item(s), running..."
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
              || stop "level $level session $session said more but made no commit. Read $log"
            left="$(remaining "$level")" || stop "could not count the items left at level $level (see the error above)"
            [ "$left" != 0 ] \
              || stop "level $level session $session said more, but lane_remaining.py counts 0 items left. They must use the same selection" ;;
      *)    stop "level $level session $session gave no LEVEL_STATUS line. Read $log" ;;
    esac
  done
done

echo
echo "All levels done: $first-$last. Total cost: \$$total_cost"
