/**
 * The `▸` flag: a single module-level boolean answering
 * "are we executing inside a component body?".
 *
 * Every context-sensitive primitive (`h`/`Fragment`/`decode`) branches on it. It is a global
 * with save/restore — **not** a parameter threaded through `h`/`decode` — which is sound because
 * the only place it is set to `true` (`island()`'s synchronous `adapter.renderToString`) cannot
 * be observed stale across an `await` (both React's and Solid's SSR renderers are synchronous).
 * Default is `false`.
 *
 * *Caveat (recorded, not yet needed):* async/streaming SSR would break a module-global flag at a
 * suspension point; the server side would then switch to `AsyncLocalStorage`.
 */

let inComponent = false;

/** Current value of `▸`. Public so adapters/tests can assert the lifecycle. */
export function flag(): boolean {
  return inComponent;
}

/**
 * Run `thunk` with `▸` set to `value`, restoring the previous value afterward (even on throw),
 * and return the thunk's result. This is the `withFlag(value, thunk)` save/restore primitive.
 */
export function withFlag<T>(value: boolean, thunk: () => T): T {
  const prev = inComponent;
  inComponent = value;
  try {
    return thunk();
  } finally {
    inComponent = prev;
  }
}
