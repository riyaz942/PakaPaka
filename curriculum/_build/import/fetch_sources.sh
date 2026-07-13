#!/bin/bash
# Downloads the open-licensed source datasets used by the Phase 1 fact audit
# (docs/content-pipeline-plan.md) into curriculum/_build/data/. Nothing here
# is committed; regenerate with this script. Licenses are recorded in the
# repo-root NOTICE file.
#
# Default: KANJIDIC2 + JMdict + KRADFILE (the audit sources).
#   --tatoeba  also fetch Tatoeba JP/EN sentence exports (Phase 2 style anchors)
#   --kanjivg  also fetch KanjiVG stroke-order SVGs (Phase 3 image cards)
#   --all      everything
set -euo pipefail

BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="$BUILD_DIR/data"
mkdir -p "$DATA_DIR"

FETCH_TATOEBA=0
FETCH_KANJIVG=0
for arg in "$@"; do
  case "$arg" in
    --tatoeba) FETCH_TATOEBA=1 ;;
    --kanjivg) FETCH_KANJIVG=1 ;;
    --all) FETCH_TATOEBA=1; FETCH_KANJIVG=1 ;;
    *) echo "unknown flag: $arg" >&2; exit 1 ;;
  esac
done

fetch() {
  local url="$1" out="$2"
  echo "Fetching $url"
  curl -fsSL "$url" -o "$out.tmp"
  mv "$out.tmp" "$out"
}

# --- EDRDG dictionary files (CC BY-SA 4.0, https://www.edrdg.org/edrdg/licence.html) ---
fetch "http://www.edrdg.org/kanjidic/kanjidic2.xml.gz" "$DATA_DIR/kanjidic2.xml.gz"
fetch "http://ftp.edrdg.org/pub/Nihongo/JMdict_e.gz" "$DATA_DIR/JMdict_e.gz"
fetch "http://ftp.edrdg.org/pub/Nihongo/kradfile.gz" "$DATA_DIR/kradfile.gz"

# --- Tatoeba sentence exports (CC BY 2.0 FR; style anchors only, never shipped) ---
if [ "$FETCH_TATOEBA" = 1 ]; then
  fetch "https://downloads.tatoeba.org/exports/per_language/jpn/jpn_sentences.tsv.bz2" "$DATA_DIR/jpn_sentences.tsv.bz2"
  fetch "https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2" "$DATA_DIR/eng_sentences.tsv.bz2"
  fetch "https://downloads.tatoeba.org/exports/per_language/jpn/jpn-eng_links.tsv.bz2" "$DATA_DIR/jpn-eng_links.tsv.bz2"
fi

# --- KanjiVG stroke-order SVGs (CC BY-SA 3.0) ---
if [ "$FETCH_KANJIVG" = 1 ]; then
  RELEASE_URL="https://api.github.com/repos/KanjiVG/kanjivg/releases/latest"
  ASSET_URL=$(curl -fsSL "$RELEASE_URL" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for asset in data['assets']:
    if asset['name'].endswith('-main.zip'):
        print(asset['browser_download_url'])
        break
")
  if [ -z "$ASSET_URL" ]; then
    echo "Could not resolve KanjiVG -main.zip download URL from latest release." >&2
    exit 1
  fi
  fetch "$ASSET_URL" "$DATA_DIR/kanjivg-main.zip"
fi

ls -lh "$DATA_DIR"
