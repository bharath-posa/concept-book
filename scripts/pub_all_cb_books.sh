#!/usr/bin/env bash
# Run `npm run deploy` in every cb-*/ sibling repo to rebuild dist/ and push
# it to the gh-pages branch (static GitHub Pages site).
#
# Usage:
#     bash pub_all_cb_books.sh
#     EXCLUDE="cb-zinets" bash pub_all_cb_books.sh     # skip repos (space-separated)
#     ROOT=/other/path bash pub_all_cb_books.sh
#
# NOTE: this publishes publicly. Generated content must already be saved in
# each repo's public/domains/ (and committed if your deploy flow needs it).
# A failure in one repo does not stop the run; failures are listed at the end
# and the exit status is non-zero if any failed.

set -u

ROOT="${ROOT:-/home/papagame/projects/digital-duck}"
read -r -a EXCLUDE <<< "${EXCLUDE:-}"

is_excluded() {
    local name="$1" e
    for e in "${EXCLUDE[@]+"${EXCLUDE[@]}"}"; do
        [[ "$name" == "$e" ]] && return 0
    done
    return 1
}

repos=()
for repo in "$ROOT"/cb-*/; do
    is_excluded "$(basename "$repo")" && continue
    repos+=("$repo")
done
total=${#repos[@]}
idx=0
failed=()

for repo in "${repos[@]}"; do
    name="$(basename "$repo")"
    idx=$((idx + 1))
    echo
    echo "======================================================================"
    echo "[repo $idx/$total] $name  ($(date '+%F %T'))"
    echo "======================================================================"
    if [[ ! -f "$repo/package.json" ]]; then
        echo "[skip] $name: no package.json"
        continue
    fi
    if ! (cd "$repo" && npm run deploy); then
        echo "[FAIL] $name" >&2
        failed+=("$name")
    fi
done

echo
if ((${#failed[@]})); then
    echo "Completed with failures: ${failed[*]}" >&2
    exit 1
fi
echo "All $total repos deployed."
