/**
 * The **node (stdio)** entry of the Nota Volar language server — the flavor `bin.ts` boots and
 * editor clients (`eglot`, `vscode-languageclient`) launch as a child process.
 *
 * All server logic lives in the transport-agnostic {@link initializeNotaServer}
 * (`./server-core.ts`); this module supplies the node pieces: the stdio/IPC connection and a
 * `createTypeScriptProject` over the real filesystem (`ts.sys`, tsconfig discovery on disk). The
 * browser worker flavor is `./browser.ts`.
 */

import {
  type Connection,
  createConnection,
  createServer,
  createTypeScriptProject
} from "@volar/language-server/node.js";
import ts from "typescript";
import { notaLanguagePlugin } from "./language-plugin.js";
import { initializeNotaServer } from "./server-core.js";

/**
 * Boot the language server on a Volar `Connection`. Registers the connection lifecycle handlers and
 * starts listening. Defaults to a fresh `createConnection()` (the standard stdio/IPC connection the
 * editor client launches).
 *
 * @param connection the LSP connection (defaults to `createConnection()`)
 */
export function startServer(connection: Connection = createConnection()): void {
  const server = createServer(connection);
  initializeNotaServer(
    connection,
    server,
    createTypeScriptProject(ts, undefined, () => ({
      languagePlugins: [notaLanguagePlugin]
    })),
    ts
  );
}
