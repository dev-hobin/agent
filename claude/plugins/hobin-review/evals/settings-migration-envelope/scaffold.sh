#!/bin/bash
# Seed the workspace with the scenario: base with change.patch applied, plus CHANGE.diff.
# The macOS eval sandbox cannot run /usr/bin/git, so the run gets the change as a file.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cp -R "$here/base/." .
git init -q
git -c user.name=eval -c user.email=eval@example.invalid add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m base
git apply "$here/change.patch"
git add -A
git diff --cached > CHANGE.diff
rm -rf .git
