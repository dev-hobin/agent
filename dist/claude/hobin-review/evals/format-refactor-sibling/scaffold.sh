#!/bin/bash
# Seed the workspace with the contract fixture.
set -euo pipefail
cp -R "$(cd "$(dirname "$0")" && pwd)/workspace/." .
