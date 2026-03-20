#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 2 ]; then
  echo "Usage: $0 <from_tag> <to_tag>" >&2
  exit 1
fi

from_tag="$1"
to_tag="$2"

if ! git rev-parse "$from_tag" >/dev/null 2>&1; then
  echo "Unknown tag or ref: $from_tag" >&2
  exit 1
fi

if ! git rev-parse "$to_tag" >/dev/null 2>&1; then
  echo "Unknown tag or ref: $to_tag" >&2
  exit 1
fi

remote_url="$(git remote get-url origin 2>/dev/null || true)"
repo_path=""
if [[ "$remote_url" =~ github.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
  repo_path="${BASH_REMATCH[1]}"
fi

diff_url=""
if [ -n "$repo_path" ]; then
  diff_url="https://github.com/${repo_path}/compare/${from_tag}...${to_tag}"
fi

commits="$(git log --no-merges --pretty=format:'- %s (%h)' "${from_tag}..${to_tag}")"
if [ -z "$commits" ]; then
  commits="- No commits found in this range."
fi

cat <<EOF2
## Summary
This release includes updates between \`${from_tag}\` and \`${to_tag}\`.

## What's Changed
${commits}

## Compatibility
- No compatibility statement provided yet.

## Upgrade Notes
- Add user-facing upgrade steps if needed.

## Full Diff
${diff_url:-https://github.com/<owner>/<repo>/compare/${from_tag}...${to_tag}}
EOF2
