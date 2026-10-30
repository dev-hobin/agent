#!/bin/bash
# Seed the workspace with the fixture. Runs outside the agent sandbox, before the run.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cp -R "$here/fixture/workspace/." .
