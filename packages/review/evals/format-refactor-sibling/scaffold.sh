#!/bin/bash
# Seed the workspace with the fixture. Runs outside the agent sandbox, before the run.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cp -R "$here/fixture/workspace/." .
# The agent's sandbox cannot run git on every machine, so ship the change as a diff:
# the working tree is the feature branch and CHANGE.diff is its diff against main.
git init -q
git -c user.name=eval -c user.email=eval@example.invalid add -A
git -c user.name=eval -c user.email=eval@example.invalid commit -q -m base
git apply "$here/fixture/change.patch"
git add -A
git diff --cached > CHANGE.diff
rm -rf .git
