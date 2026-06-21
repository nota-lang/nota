/**
 * The Nota VSCode extension — a **thin client** that launches the Volar language server
 * (`@nota-lang/language-server`) and lets it drive all semantic features for `.nota` files
 * (implementation.md §5.7-W). The TextMate grammar + language registration stay declarative in
 * `package.json` (Phase U); this module adds the Phase-V/W layer: it spawns the server and hands it
 * `nota` documents over an LSP connection.
 *
 * **What rides this connection (Phases V–W):** diagnostics (`@Unknown{}` → "Cannot find name"),
 * hover, completion, go-to-definition, find-references, and rename — each produced by the server's
 * `volar-service-typescript` over the per-file virtual `.tsx` and mapped back to `.nota` ranges via
 * the H1 `CodeMapping`s. The client itself is feature-agnostic: it only starts/stops the server and
 * declares which documents (`language: "nota"`) it owns.
 */

import type * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind
} from "vscode-languageclient/node";

/** The running client, kept so {@link deactivate} can stop the server. */
let client: LanguageClient | undefined;

export function activate(_context: vscode.ExtensionContext): void {
  // Resolve the server's executable entry (`@nota-lang/language-server`'s `nota-language-server`
  // bin = `dist/bin.js`). `require.resolve` honors the package's `exports` (`"./*" → "./dist/*.js"`),
  // so this yields the absolute path to the built `bin.js` wherever the dependency is installed.
  const serverModule = require.resolve("@nota-lang/language-server/bin");

  // Run the server as a Node module over **stdio** (it calls `createConnection()`, which the
  // `--stdio` transport flag selects). `vscode-languageclient` forks `serverModule` with the
  // extension-host Node, appending `--stdio`; the same module is used for normal + debug runs.
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.stdio
    },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: {
        // Let a debugger attach to the forked server on a fixed port in debug sessions.
        execArgv: ["--nolazy", "--inspect=6009"]
      }
    }
  };

  // The client owns `.nota` documents: it forwards their open/change/etc. to the server and routes
  // the server's diagnostics/hover/completion/definition/references/rename back into VSCode.
  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "nota" }]
  };

  client = new LanguageClient(
    "nota",
    "Nota Language Server",
    serverOptions,
    clientOptions
  );

  // `start()` spawns the server and begins serving features for open `.nota` files. Errors surface
  // through the "Nota Language Server" output channel the client creates.
  void client.start();
}

export function deactivate(): Thenable<void> | undefined {
  // Stop the server (closes the connection + terminates the child process) on extension shutdown.
  return client?.stop();
}
