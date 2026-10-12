#!/usr/bin/env sh
# Mories Deo Hutapea,S.E.,S.Kom

set -eu

repository_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
run_logs_directory="$repository_root/run-logs"

skills_directory="${1:-$HOME/.claude/skills}"

if ! command -v skillspector >/dev/null 2>&1; then
  echo "skillspector is not installed. Install it first:" >&2
  echo "  uv tool install --force 'skillspector[mcp] @ git+https://github.com/NVIDIA/skillspector.git'" >&2
  exit 1
fi

if [ ! -d "$skills_directory" ]; then
  echo "Skills directory not found: $skills_directory" >&2
  echo "Usage: $0 [path-to-skills-directory]" >&2
  exit 1
fi

mkdir -p "$run_logs_directory"

timestamp=$(date +%Y%m%d-%H%M%S)
report_file="$run_logs_directory/skillspector-scan-$timestamp.sarif"

echo "Scanning $skills_directory with skillspector..."
skillspector scan "$skills_directory" --no-llm --format sarif --output "$report_file"
echo "Report written to $report_file"
