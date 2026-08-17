#!/usr/bin/env node
/**
 * Executable entry for the Nota Volar language server — the binary a stdio LSP client launches.
 * `editors/emacs/nota-mode.el` is the verified in-repo consumer (`eglot-server-programs` points at
 * this file's build output, `dist/bin.js --stdio`); any other `vscode-languageclient`-style client
 * would launch it the same way. All logic lives in {@link startServer}; this is just the shebang
 * shim.
 */
import { startServer } from "./server.js";

startServer();
