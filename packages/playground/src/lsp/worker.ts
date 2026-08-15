/**
 * The worker **bootstrap**: queue messages that arrive while the heavy server module graph
 * (typescript + the TS libs + the wasm reader) is still evaluating, then replay them once the
 * server is listening.
 *
 * Why this exists: the wasm reader is an ESM `.wasm` import, which makes the worker's module graph
 * evaluate with top-level await. The browser enables message delivery at the first suspension —
 * *before* Volar's `listen()` attaches `self.onmessage` — so an LSP client that connects
 * immediately (the playground does) would have its `initialize` request silently dropped and time
 * out. This entry therefore has NO static imports of the server (static imports hoist and would
 * reintroduce the race): it synchronously installs a queueing handler, dynamically imports the
 * server, boots it, and replays the queue into the connection's handler.
 */

// Structural view of DedicatedWorkerGlobalScope (the tsconfig carries dom, not webworker).
interface WorkerScope {
  onmessage: ((event: MessageEvent) => void) | null;
}

const scope = self as unknown as WorkerScope;
const queued: MessageEvent[] = [];
scope.onmessage = (event: MessageEvent) => {
  queued.push(event);
};

(async () => {
  const { boot } = await import("./worker-server");
  boot();
  // `listen()` replaced `self.onmessage` with the connection's reader; hand it the backlog.
  const handler = scope.onmessage;
  if (handler) {
    for (const event of queued) {
      handler.call(scope, event);
    }
  }
  queued.length = 0;
})();
