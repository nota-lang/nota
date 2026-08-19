/** Queue LSP messages until the top-level-await server graph has loaded. */

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
  const handler = scope.onmessage;
  if (handler) {
    for (const event of queued) {
      handler.call(scope, event);
    }
  }
  queued.length = 0;
})();
