/**
 * The Nota Volar **language server**.
 *
 * Wires the standard Volar node server: a `createConnection` + `createServer`, a TypeScript project
 * (`createTypeScriptProject`) that registers {@link notaLanguagePlugin} so the TS language service
 * runs over each `.nota`'s virtual `.tsx`, and the `volar-service-typescript` language-service
 * plugins that surface diagnostics / hover / completion / definition / references / rename. The same
 * wiring carries all of those features over the single virtual-code mapping.
 *
 * This module exports {@link startServer} (idempotent given a connection) so the thin `bin.ts` entry
 * and any embedder can boot it; `bin.ts` is the executable the `vscode-nota` client launches.
 */

import {
  type Connection,
  createConnection,
  createServer,
  createTypeScriptProject
} from "@volar/language-server/node.js";
import ts from "typescript";
import { create as createTypeScriptServices } from "volar-service-typescript";
import { notaCompletionsPlugin } from "./completions.js";
import { notaDiagnosticsServicePlugin } from "./diagnostics.js";
import { notaLanguagePlugin } from "./language-plugin.js";
import { notaSemanticTokensPlugin } from "./semantic-tokens.js";

/**
 * Boot the language server on a Volar `Connection`. Registers the connection lifecycle handlers and
 * starts listening. Defaults to a fresh `createConnection()` (the standard stdio/IPC connection the
 * editor client launches).
 *
 * @param connection the LSP connection (defaults to `createConnection()`)
 */
export function startServer(connection: Connection = createConnection()): void {
  const server = createServer(connection);

  connection.onInitialize(params =>
    server.initialize(
      params,
      // A TS project so the TS language service runs over the virtual `.tsx`. The reader's emit +
      // shifted mappings come from `notaLanguagePlugin`; `volar-service-typescript` is what actually
      // produces TS diagnostics/hover/etc. over the virtual file.
      createTypeScriptProject(ts, undefined, () => ({
        languagePlugins: [notaLanguagePlugin]
      })),
      // `volar-service-typescript` surfaces *type* diagnostics/hover/completion over the virtual
      // `.tsx` (incl. `@tag[|` prop completions through the recovery anchor mapping); the Nota
      // plugins add the `.nota`'s own *syntax* diagnostics (D5), reader-driven semantic tokens (D2),
      // and `@|` markup-head completions (P5).
      [
        ...createTypeScriptServices(ts),
        notaDiagnosticsServicePlugin,
        notaSemanticTokensPlugin,
        notaCompletionsPlugin
      ]
    )
  );

  connection.onInitialized(() => server.initialized());
  connection.onShutdown(() => server.shutdown());

  connection.listen();
}
