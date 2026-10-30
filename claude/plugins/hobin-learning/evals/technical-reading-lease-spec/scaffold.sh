#!/bin/bash
# Seed the workspace with the scenario's base state.
set -euo pipefail
here=$(cd "$(dirname "$0")" && pwd)
cp -R "$here/base/." .
