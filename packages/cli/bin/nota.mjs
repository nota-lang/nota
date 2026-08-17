#!/usr/bin/env node
// The published bin entry. The built dist/cli.js self-executes on import but carries no shebang
// (depot/vite emit a plain ESM module); npm's .bin symlink needs one, so this thin committed
// wrapper is the executable.
import "../dist/cli.js";
