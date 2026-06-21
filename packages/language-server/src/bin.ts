#!/usr/bin/env node
/**
 * Executable entry for the Nota Volar language server — the binary the `vscode-nota` client (Phase W)
 * launches over stdio/IPC. All logic lives in {@link startServer}; this is just the shebang shim.
 */
import { startServer } from "./server";

startServer();
