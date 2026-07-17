#!/bin/bash
# Downloads the JmdictFurigana dataset (CC BY-SA, EDRDG-adjacent) used by
# curriculum/_build/furigana.py. Not committed to the repo — regenerate with
# this script, matching docs/content/furigana-support-plan.md ground rule 3.
set -euo pipefail

BUILD_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="$BUILD_DIR/data"
mkdir -p "$DATA_DIR"

RELEASE_URL="https://api.github.com/repos/Doublevil/JmdictFurigana/releases/latest"
ASSET_URL=$(curl -sL "$RELEASE_URL" | python3 -c "
import json, sys
data = json.load(sys.stdin)
for asset in data['assets']:
    if asset['name'] == 'JmdictFurigana.txt':
        print(asset['browser_download_url'])
        break
")

if [ -z "$ASSET_URL" ]; then
  echo "Could not resolve JmdictFurigana.txt download URL from latest release." >&2
  exit 1
fi

curl -sL "$ASSET_URL" -o "$DATA_DIR/JmdictFurigana.txt"
echo "Downloaded $(wc -l < "$DATA_DIR/JmdictFurigana.txt") entries to $DATA_DIR/JmdictFurigana.txt"
