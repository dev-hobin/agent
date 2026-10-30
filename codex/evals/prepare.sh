#!/bin/sh
# Build the workspace plugin-eval copies for a scenario: base with change.patch applied,
# plus CHANGE.diff. Usage: sh codex/evals/prepare.sh <plugin> <scenario> (from the repo root)
set -eu
dir="codex/evals/$1/$2"
rm -rf "$dir/workspace"
cp -R "$dir/base" "$dir/workspace"
cd "$dir/workspace"
# A scenario without a change is the base alone.
if [ -f ../change.patch ]; then
  git init -q
  git -c user.name=eval -c user.email=eval@example.invalid add -A
  git -c user.name=eval -c user.email=eval@example.invalid commit -q -m base
  git apply ../change.patch
  git add -A
  git diff --cached > CHANGE.diff
  rm -rf .git
fi
