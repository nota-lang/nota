#!/usr/bin/env node
// The published bin entry. The built dist/cli.cjs self-executes on require but carries no
// shebang (depot/vite emit plain CJS); npm's .bin symlink needs one, so this thin committed
// wrapper is the executable. pnpm's workspace shims made the bare dist path *look* fine in dev.
require("../dist/cli.cjs");
