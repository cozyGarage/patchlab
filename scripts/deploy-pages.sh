#!/usr/bin/env bash
# Manual GitHub Pages deploy when Actions workflow push is unavailable.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
npm run build
TMP="$(mktemp -d)"
cp -a dist/. "$TMP/"
touch "$TMP/.nojekyll"
cd "$TMP"
git init
git checkout -b gh-pages
git add -A
git -c user.email="${GIT_AUTHOR_EMAIL:-deploy@localhost}" \
  -c user.name="${GIT_AUTHOR_NAME:-PatchLab Deploy}" \
  commit -m "Deploy PatchLab $(date -u +%Y-%m-%d)"
git remote add origin https://github.com/cozyGarage/patchlab.git
git push -f origin gh-pages
cd "$ROOT"
rm -rf "$TMP"
echo "Published https://cozygarage.github.io/patchlab/"
