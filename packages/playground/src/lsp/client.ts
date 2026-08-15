/**
 * The editor-side LSP wiring: spawn the language-server worker, connect an
 * `@codemirror/lsp-client` over a `postMessage` {@link Transport}, and expose one CM6 extension
 * carrying the LSP feature set (diagnostics, completion, hover, signature help, rename, …).
 *
 * The transport is the only glue: `@codemirror/lsp-client` speaks header-less JSON strings, the
 * Volar browser server speaks structured-clone message objects — one `JSON.parse`/`stringify` pair
 * bridges them.
 *
 * One worker + client per page (module-level singleton): the playground has a single document, and
 * React re-mounts must not leak workers.
 */

import {
  LSPClient,
  LSPPlugin,
  languageServerExtensions,
  type Transport
} from "@codemirror/lsp-client";
import type { Extension } from "@codemirror/state";

/** The (virtual) URI of the playground document; the server sees `/workspace/tsconfig.json`'s project. */
export const NOTA_DOC_URI = "file:///workspace/doc.nota";

/** Wrap a Worker's structured-clone postMessage channel as the client's string transport. */
export function workerTransport(worker: Worker): Transport {
  const handlers = new Set<(value: string) => void>();
  worker.onmessage = event => {
    const message = JSON.stringify(event.data);
    for (const handler of handlers) {
      handler(message);
    }
  };
  return {
    send(message) {
      worker.postMessage(JSON.parse(message));
    },
    subscribe(handler) {
      handlers.add(handler);
    },
    unsubscribe(handler) {
      handlers.delete(handler);
    }
  };
}

let cached: Extension | null = null;

/**
 * The LSP editor extension for the playground document — or `[]` where workers are unavailable
 * (jsdom tests). Created once; safe to include in multiple editor instantiations.
 */
export function notaLsp(): Extension {
  if (cached === null) {
    if (typeof Worker === "undefined") {
      cached = [];
    } else {
      const worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module"
      });
      const client = new LSPClient({
        rootUri: "file:///workspace",
        extensions: languageServerExtensions(),
        // The worker cold-starts typescript + the wasm reader on first use; don't let the default
        // 3s request timeout race that.
        timeout: 15_000
      }).connect(workerTransport(worker));
      cached = LSPPlugin.create(client, NOTA_DOC_URI, "nota");
    }
  }
  return cached;
}
