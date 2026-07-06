/**
 * The Nota VSCode extension — a **thin client** that launches the Volar language server
 * (`@nota-lang/language-server`) and lets it drive all semantic features for `.nota` files.
 * The TextMate grammar + language registration stay declarative in
 * `package.json`; this module spawns the language server and hands it `nota` documents over an LSP
 * connection.
 *
 * **What rides this connection:** diagnostics (`@Unknown{}` → "Cannot find name"),
 * hover, completion, go-to-definition, find-references, and rename — each produced by the server's
 * `volar-service-typescript` over the per-file virtual `.tsx` and mapped back to `.nota` ranges via
 * the generated `CodeMapping`s. The client itself is feature-agnostic: it only starts/stops the server and
 * declares which documents (`language: "nota"`) it owns.
 */

import { existsSync } from "node:fs";
import type * as vscode from "vscode";
import {
  LanguageClient,
  type LanguageClientOptions,
  type ServerOptions,
  TransportKind
} from "vscode-languageclient/node";

/** The running client, kept so {@link deactivate} can stop the server. */
let client: LanguageClient | undefined;

export function activate(context: vscode.ExtensionContext): void {
  // Resolve the server's executable entry. A *packaged* extension (the vsix) carries the
  // esbuild-bundled server at `dist/server.js` plus the node-wasm reader at `wasm/`
  // (see `scripts/package-vsix.mjs`); a dev run from the workspace (F5) has neither and falls
  // back to the workspace dependency — `require.resolve` honors the package's `exports`
  // (`"./*" → "./dist/*.js"`), yielding the absolute path to the built `bin.js`.
  const bundledServer = context.asAbsolutePath("dist/server.js");
  const serverModule = existsSync(bundledServer)
    ? bundledServer
    : require.resolve("@nota-lang/language-server/bin");

  // Point the compiler shim at the vsix's vendored wasm reader explicitly (the packaged layout
  // has no repo/node_modules to resolve against, and an env var beats patching import.meta.url
  // into a CJS bundle). Dev runs have no `wasm/` and keep the shim's own resolution (repo
  // pkg-node).
  const bundledWasm = context.asAbsolutePath("wasm/nota_wasm.js");
  const serverEnv = existsSync(bundledWasm)
    ? { ...process.env, NOTA_WASM_NODE: bundledWasm }
    : undefined;

  // Run the server as a Node module over **stdio** (it calls `createConnection()`, which the
  // `--stdio` transport flag selects). `vscode-languageclient` forks `serverModule` with the
  // extension-host Node, appending `--stdio`; the same module is used for normal + debug runs.
  const serverOptions: ServerOptions = {
    run: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: { env: serverEnv }
    },
    debug: {
      module: serverModule,
      transport: TransportKind.stdio,
      options: {
        env: serverEnv,
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
