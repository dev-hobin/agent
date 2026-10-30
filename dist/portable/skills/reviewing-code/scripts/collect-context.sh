#!/bin/sh
# Print review context for the current branch: range, changed files, diff, nearby tests,
# and project instruction files. Read-only; uses git only.
# Usage: collect-context.sh [base]
set -eu

base=${1:-}
if [ -z "$base" ]; then
	base=$(git rev-parse --abbrev-ref --symbolic-full-name '@{upstream}' 2>/dev/null || true)
	if [ -z "$base" ]; then
		for candidate in main master develop; do
			if git rev-parse --verify --quiet "$candidate" >/dev/null; then base=$candidate; break; fi
		done
	fi
fi
[ -n "$base" ] || { echo "No base branch found; pass one explicitly." >&2; exit 2; }
merge_base=$(git merge-base "$base" HEAD)

echo "## Range"
echo "base: $base ($merge_base)"
echo "head: $(git rev-parse --abbrev-ref HEAD) ($(git rev-parse HEAD))"
git log --oneline "$merge_base..HEAD"

echo
echo "## Changed files"
git diff --stat "$merge_base"
git status --short

echo
echo "## Tests near the changed files"
git diff --name-only "$merge_base" | while read -r file; do
	dir=$(dirname "$file")
	stem=$(basename "$file" | sed 's/\.[^.]*$//')
	git ls-files "$dir" | grep -E "(^|/)(test|tests|__tests__|spec)/|[._-](test|spec)\." | grep -F "$stem" || true
done | sort -u

echo
echo "## Project instruction files"
git ls-files | grep -E '(^|/)(AGENTS|CLAUDE|CONTRIBUTING)\.md$' || echo "(none)"

echo
echo "## Diff"
git diff "$merge_base"
