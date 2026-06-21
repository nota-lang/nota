/**
 * The framework adapter injector (`setAdapter` / `getAdapter`).
 *
 * A single ambient adapter, set once before any `▸`-render. On the server it is set by the SSG
 * driver; on the client by the app entry, pre-hydrate. One adapter per process (one framework per
 * app), so a singleton is correct.
 *
 * When no adapter is injected, only the `▸ = false` paths run, and the `getAdapter()` accessor
 * throws a clear "no adapter injected" error. The four-method interface is fixed here as a *type*;
 * the `react`/`solid` implementations live in their own packages.
 */

/**
 * A framework hyperscript adapter (the entire framework surface). Implemented by
 * `@nota-lang/react` and `@nota-lang/solid`. Bodies are not provided here.
 *
 * `El` is the framework's opaque element type (React element / Solid JSX node); left as `unknown`
 * at this boundary.
 *
 * `children` is `unknown` because the adapter is fed two shapes (both are normalized inside it):
 * a `VNode[]` from `h`'s `▸ = true` path (`adapter.h(t, p, flatten(children))`), and a single
 * `RawHtml` slot from {@link "./serialize".island} (`adapter.h(comp, props, raw(slot))`) — a
 * pre-rendered-HTML marker the adapter injects as innerHTML (see {@link "./raw"}).
 */
export interface Adapter {
  /** Framework hyperscript. `tag` is a host string or a component function. */
  h(
    tag: unknown,
    props: Record<string, unknown> | null,
    children: unknown
  ): unknown;
  /**
   * Framework fragment constructor. `props` is an optional leading props object — the Nota
   * `Fragment(props?, …children)` surface passes a `key` here for `@for`
   * iterations (`Fragment({ key: _i }, …)`); `null`/`{}` for a keyless fragment. React forwards it
   * to `createElement(React.Fragment, props, …)` (React.Fragment accepts `key`); Solid keys
   * differently, so it is best-effort there.
   */
  Fragment(props: Record<string, unknown> | null, children: unknown): unknown;
  /** Synchronous SSR string render of a framework element. */
  renderToString(el: unknown): string;
  /**
   * Client island boot: attach over server-rendered DOM. Returns a teardown handle that unmounts
   * the island (React `root.unmount()` / Solid's dispose), so a re-render or a live preview can
   * release the previous mount instead of leaking detached roots, fibers, and listeners.
   */
  hydrate(el: unknown, container: unknown): () => void;
}

let current: Adapter | undefined;

/**
 * Inject the ambient framework adapter. Called by the SSG driver (server) or the app entry
 * (client) before any `▸ = true` render. Stores the singleton so the lifecycle is testable.
 */
export function setAdapter(a: Adapter): void {
  current = a;
}

/**
 * The ambient adapter, or throw a pointed error if none is set. `h`/`Fragment` under `▸`, and
 * `island`, dispatch through this — calling any of them with no adapter set throws
 * "no adapter injected" rather than a cryptic `undefined is not a function`.
 */
export function getAdapter(): Adapter {
  if (current === undefined) {
    throw new Error(
      "no adapter injected: call setAdapter(...) with a @nota-lang/{react,solid} adapter before rendering inside a component (▸ = true)"
    );
  }
  return current;
}

/** Test/driver hook: clear the ambient adapter (e.g. `reset()` in the SSG driver). */
export function clearAdapter(): void {
  current = undefined;
}
