#!/usr/bin/env bash
# Deploy the commit on GitHub's main branch to Netlify production.
# Builds from a clean checkout of that exact commit, so the live site always
# matches the repository (uncommitted local changes never ship).
#   npm run deploy            # deploys origin/main
#   npm run deploy -- <sha>   # deploys a specific commit
set -euo pipefail
SITE_ID="3296ee8c-7b41-4cb5-b335-121f7acecf08"   # Netlify project "rennbros"
git fetch -q origin main
REF="${1:-origin/main}"
SHA="$(git rev-parse --short "$REF")"
if [ -z "${1:-}" ] && [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "Local HEAD differs from origin/main: push first (deploying origin/main $SHA)." >&2
fi
DIR="$(mktemp -d)/rennbros-$SHA"
git worktree add -q --detach "$DIR" "$SHA"
trap 'git worktree remove --force "$DIR" >/dev/null 2>&1 || true' EXIT
( cd "$DIR" && npm ci --no-audit --no-fund >/dev/null && npx netlify deploy --build --prod --site "$SITE_ID" --message "$SHA (GitHub main)" )
