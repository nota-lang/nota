/** Connect CodeMirror's string LSP transport to the browser server worker. */

import {
  LSPClient,
  LSPPlugin,
  languageServerExtensions,
  type Transport
} from "@codemirror/lsp-client";
import type { Extension } from "@codemirror/state";

export const NOTA_DOC_URI = "file:///workspace/doc.nota";

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

/** Return the singleton LSP extension, or `[]` outside a worker-capable browser. */
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
        timeout: 15_000
      }).connect(workerTransport(worker));
      cached = LSPPlugin.create(client, NOTA_DOC_URI, "nota");
    }
  }
  return cached;
}
