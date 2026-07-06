#!/usr/bin/env bash
# Smoke-test the packed CLI tarball the way a user installs it: fresh npm project, install the
# tarball (path for dry runs, https URL post-release), author a doc, `nota build` it, and assert
# real HTML came out. Exercises the whole shipped closure — cli → vite plugin → compiler (wasm
# backend, vendored blob) → runtime/prelude (Heading via `#`, emphasis) — with no workspace, no
# Rust, no prebuilt binary.
#
#   scripts/smoke-install.sh <path-or-url-to-nota-lang-cli.tgz>
set -euo pipefail

tarball="$1"
workdir=$(mktemp -d)
trap 'rm -rf "$workdir"' EXIT
cd "$workdir"

echo "[smoke] npm install $tarball"
npm init -y >/dev/null
npm install --no-fund --no-audit --loglevel=error "$tarball"

cat > doc.nota <<'EOF'
# Smoke

@p{Hello, *world*.}
EOF

echo "[smoke] nota build doc.nota"
npx nota build doc.nota

test -s doc/index.html || { echo "[smoke] FAIL: doc/index.html missing or empty"; exit 1; }
grep -q "world" doc/index.html || { echo "[smoke] FAIL: rendered HTML lacks doc content"; exit 1; }
grep -q "Smoke" doc/index.html || { echo "[smoke] FAIL: rendered HTML lacks the heading"; exit 1; }

echo "[smoke] ok — $(wc -c < doc/index.html | tr -d ' ') bytes of HTML"
