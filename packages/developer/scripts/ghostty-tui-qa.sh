#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
FIXTURE="$REPO_ROOT/packages/developer/tests/fixtures/tui-visual.ts"
SELF="$SCRIPT_DIR/ghostty-tui-qa.sh"
PI_BIN="$(command -v pi || true)"

if [[ -z "$PI_BIN" ]]; then
	printf 'pi is not available on PATH.\n' >&2
	exit 1
fi

run_qa() {
	cd "$REPO_ROOT"
	exec "$PI_BIN" \
		--no-session \
		--no-extensions \
		--no-skills \
		--no-prompt-templates \
		--no-context-files \
		--no-tools \
		--offline \
		--extension "$FIXTURE" \
		"/developer-tui-qa"
}

if [[ "${TERM_PROGRAM:-}" == "ghostty" && -t 0 && -t 1 ]]; then
	run_qa
fi

if [[ "$(uname -s)" != "Darwin" ]]; then
	printf 'Open this script from Ghostty: %s\n' "$0" >&2
	exit 1
fi

if [[ ! -d "/Applications/Ghostty.app" ]]; then
	printf 'Ghostty.app was not found in /Applications.\n' >&2
	exit 1
fi

open -na Ghostty.app --args --working-directory="$REPO_ROOT" -e "$SELF"
printf 'Opened Developer TUI visual QA in a new Ghostty window.\n'
