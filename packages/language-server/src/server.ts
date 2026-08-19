/** Node/stdio entry for the Nota language server. */

import {
  type Connection,
  createConnection,
  createServer,
  createTypeScriptProject
} from "@volar/language-server/node.js";
import ts from "typescript";
import { notaLanguagePlugin } from "./language-plugin.js";
import { initializeNotaServer } from "./server-core.js";

/** Start the server on a supplied connection, or stdio by default. */
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
