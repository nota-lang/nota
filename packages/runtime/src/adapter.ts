/**
 * The framework adapter injector (implementation.md §2.3; contract §1 `setAdapter`).
 *
 * A single ambient adapter, set once before any `▸`-render. On the server it is set by the SSG
 * driver; on the client by the app entry, pre-hydrate. One adapter per process (one framework per
 * app), so a singleton is correct.
 *
 * For Phases G/H the adapter is never actually injected — only the `▸ = false` paths run — so the
 * `getAdapter()` accessor throws a clear "no adapter injected" error. The four-method interface
 * (E3) is fixed here as a *type*; its `react`/`solid` implementations are Phase J.
 */

/**
 * A framework hyperscript adapter (the entire framework surface; §2.3 E3). Implemented by
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
  /** Framework fragment constructor. */
  Fragment(children: unknown): unknown;
  /** Synchronous SSR string render of a framework element. */
  renderToString(el: unknown): string;
  /** Client island boot: attach over server-rendered DOM. */
  hydrate(el: unknown, container: unknown): void;
}

let current: Adapter | undefined;

/**
 * Inject the ambient framework adapter. Called by the SSG driver (server) or the app entry
 * (client) before any `▸ = true` render. (Phase J wires the real adapters; here it just stores
 * the singleton so the lifecycle is testable.)
 */
export function setAdapter(a: Adapter): void {
  current = a;
}

/**
 * The ambient adapter, or throw a pointed error if none is set. `h`/`Fragment` under `▸`, and
 * `island`, dispatch through this — calling any of them with no adapter set throws
 * "no adapter injected" rather than a cryptic `undefined is not a function` (§2.3).
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
