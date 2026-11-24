#!/usr/bin/env bash
# Run batch_generate.py (defaults: --domain all --level college
# --llm claude_cli:claude-sonnet-5-5 --n-targets 2) for English and Chinese
# across every cb-*/ sibling repo, except the EXCLUDE list below.
#
# Prerequisite: activate the spl123 conda env first (spl3, click, pyyaml):
#     conda activate spl123
#
# Usage:
#     bash run_all_cb_books.sh
#     ROOT=/other/path bash run_all_cb_books.sh
#
# If batch_generate.py reports an LLM session/rate limit (exit 75), the whole
# run stops immediately. A failure in one repo/language does not stop the run; a summary of failed
# runs is printed at the end and the exit status is non-zero if any failed.

set -u

ROOT="${ROOT:-/home/papagame/projects/digital-duck}"
EXCLUDE=(cb-zinets cb-college-physics)
LANGS=(en zh)
SESSION_LIMIT_RC=75   # batch_generate.py EXIT_SESSION_LIMIT

failed=()

is_excluded() {
    local name="$1" e
    for e in "${EXCLUDE[@]}"; do
        [[ "$name" == "$e" ]] && return 0
    done
    return 1
}

# Build the repo list up front so progress can show "[i/N]".
repos=()
for repo in "$ROOT"/cb-*/; do
    name="$(basename "$repo")"
    is_excluded "$name" && continue
    repos+=("$repo")
done
total=${#repos[@]}
idx=0

for repo in "${repos[@]}"; do
    name="$(basename "$repo")"
    idx=$((idx + 1))
    echo
    echo "======================================================================"
    echo "[repo $idx/$total] $name  ($(date '+%F %T'))"
    echo "======================================================================"
    if [[ ! -f "$repo/scripts/batch_generate.py" ]]; then
        echo "[skip] $name: no scripts/batch_generate.py"
        continue
    fi
    for lang in "${LANGS[@]}"; do
        echo "######################################################################"
        echo "# [repo $idx/$total] $name  --language $lang"
        echo "######################################################################"
        (cd "$repo/scripts" && python batch_generate.py --language "$lang")
        rc=$?
        if ((rc == SESSION_LIMIT_RC)); then
            echo "[STOP] $name ($lang): LLM session/rate limit hit — aborting the whole run." >&2
            echo "Re-run later; finished targets are skipped automatically." >&2
            exit "$SESSION_LIMIT_RC"
        elif ((rc != 0)); then
            echo "[FAIL] $name ($lang)" >&2
            failed+=("$name/$lang")
        fi
    done
done

echo
if ((${#failed[@]})); then
    echo "Completed with failures: ${failed[*]}" >&2
    exit 1
fi
echo "All runs completed."
