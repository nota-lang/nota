/**
 * Doc-state — the LaTeX `.aux` model, in process (design/solid.md §Doc-state).
 *
 * Components *register* facts (headings, footnotes, definitions, cites) during render and read
 * derived facts through memos. Registrations ≙ the old marks; memos ≙ the old queries; the store
 * ≙ `DocIndex`. Unmount unregisters (`onCleanup`), so doc-state is reactive: a heading inserted
 * by a `<Show>` renumbers the document live. The render drivers thread a store through
 * {@link DocStateContext}; a bare `NotaDoc` self-provisions one (tests, pure CSR).
 */

import {
  createContext,
  createSignal,
  getOwner,
  type JSX,
  onCleanup,
  useContext
} from "solid-js";
import { isServer } from "solid-js/web";
import type { SmartOptions } from "./smart";

/** One registered fact. JSON-serializable fields survive {@link DocState.snapshot}; function-
 * valued fields (e.g. a definition's tooltip thunk) are for same-pass readers and are dropped. */
export type Fact = Record<string, unknown>;

/** A doc-state snapshot: kind → ordered JSON-safe facts. The wire format of the `.aux` model. */
export type Snapshot = Record<string, Fact[]>;

/** The handle {@link DocState.register} returns: the fact plus its 1-based per-kind sequence. */
export interface FactHandle {
  kind: string;
  seq: number;
  fact: Fact;
}

export interface DocState {
  /**
   * Register a fact during render. The stored fact is `{...fact, pos}` where `pos` is a
   * store-global 1-based sequence — cross-kind document order, what "nearest preceding heading"
   * style queries key on. Returns its handle (`seq` is 1-based per kind). On the client the
   * registration auto-unregisters when the owning computation is disposed, so doc-state is
   * reactive under `<Show>`/`<For>`.
   */
  register(kind: string, fact: Fact): FactHandle;
  /** Remove a registration (rarely needed directly — see {@link register}). */
  unregister(h: FactHandle): void;
  /**
   * The **resolved** facts of a kind: the seed snapshot while one is pinned (SSG pass 2,
   * hydration), else the live registrations (reactive). This is what forward-referencing
   * readers (`Toc`, `Ref`) consume.
   */
  read(kind: string): Fact[];
  /**
   * The **live** registrations of a kind (reactive, never seed-pinned). For readers positioned
   * after all registrations — trailers — which need same-pass non-JSON fields (tooltip thunks).
   */
  live(kind: string): Fact[];
  /**
   * Unpin the seed — silently. Readers keep their current (seed-derived, converged-equal)
   * values; the next live registration re-runs them against the live facts. Called after
   * hydration completes.
   */
  release(): void;
  /** The JSON-safe snapshot of live registrations (function-valued fields dropped). */
  snapshot(): Snapshot;
  /** Register a document-end trailer thunk, idempotent by name (first registration wins). */
  trailer(name: string, thunk: () => JSX.Element): void;
  /** The registered trailer thunks, in registration order (reactive). */
  trailers(): (() => JSX.Element)[];
  /** Set a positional flag (e.g. "footnotes-placed" — explicit placement overrides a trailer). */
  flag(name: string): void;
  /** Read a flag (reactive). Positional: set-before-read holds by tree order. */
  hasFlag(name: string): boolean;
  /** Was this store created with a seed (SSG pass 2 / hydration)? */
  readonly seeded: boolean;
  /**
   * The document's smart-punctuation setting (threaded from the render drivers; `undefined` ⇒
   * defaults, `false` ⇒ off). Read by every `Reforest` pass under this store — server and client
   * must agree, so it rides the store, not a component prop.
   */
  readonly smart?: SmartOptions | false;
}

/** Store-creation options ({@link createDocState}). */
export interface DocStateOptions {
  /** Smart punctuation for this document's Reforest passes ({@link DocState.smart}). */
  smart?: SmartOptions | false;
}

/**
 * Create a per-document reactive store. With a `seed` (pass 1's snapshot during SSG pass 2; the
 * page-embedded snapshot during hydration), {@link DocState.read} serves the seed until
 * {@link DocState.release} — so forward references resolve to converged values while the live
 * registrations accumulate underneath.
 */
export function createDocState(
  seed?: Snapshot,
  options: DocStateOptions = {}
): DocState {
  const [version, setVersion] = createSignal(0);
  // Deliberately NOT a signal: release() must be silent. At release time live == seed (the
  // document converged), so notifying readers would re-run every doc-state consumer to produce
  // identical output — observable as DOM churn right after hydration. Instead readers keep
  // serving the (equal) seed until the next real registration bumps `version`, which re-runs
  // them under released = true.
  let released = seed === undefined;
  let nextPos = 0;
  const facts = new Map<string, FactHandle[]>();
  const trailerMap = new Map<string, () => JSX.Element>();
  const flags = new Set<string>();
  const bump = () => setVersion(v => v + 1);

  const liveOf = (kind: string): Fact[] => {
    version();
    return (facts.get(kind) ?? []).map(h => h.fact);
  };

  const state: DocState = {
    register(kind, fact) {
      const list = facts.get(kind) ?? [];
      facts.set(kind, list);
      nextPos += 1;
      const handle: FactHandle = {
        kind,
        seq: list.length + 1,
        fact: { ...fact, pos: nextPos }
      };
      list.push(handle);
      bump();
      // Client-side, tie the registration to the owning computation so conditional content
      // unregisters on unmount. Server-side renderToString disposes its root after rendering,
      // which would empty the store before snapshot() — so no cleanup there.
      if (!isServer && getOwner()) {
        onCleanup(() => state.unregister(handle));
      }
      return handle;
    },
    unregister(h) {
      const list = facts.get(h.kind);
      if (!list) return;
      const i = list.indexOf(h);
      if (i >= 0) {
        list.splice(i, 1);
        // Re-sequence: seq stays 1-based registration order.
        list.forEach((entry, k) => {
          entry.seq = k + 1;
        });
        bump();
      }
    },
    read(kind) {
      version(); // track ALWAYS — a pinned reader must still wake on post-release registrations
      if (!released && seed !== undefined) {
        return seed[kind] ?? [];
      }
      return (facts.get(kind) ?? []).map(h => h.fact);
    },
    live: liveOf,
    release() {
      released = true;
    },
    snapshot() {
      const out: Snapshot = {};
      for (const [kind, list] of facts) {
        out[kind] = list.map(h => h.fact);
      }
      // JSON round-trip: drops function-valued/undefined fields, proving the snapshot is wire-safe.
      return JSON.parse(JSON.stringify(out)) as Snapshot;
    },
    trailer(name, thunk) {
      if (!trailerMap.has(name)) {
        trailerMap.set(name, thunk);
        bump();
      }
    },
    trailers() {
      version();
      return [...trailerMap.values()];
    },
    flag(name) {
      flags.add(name);
      bump();
    },
    hasFlag(name) {
      version();
      return flags.has(name);
    },
    get seeded() {
      return seed !== undefined;
    },
    get smart() {
      return options.smart;
    }
  };
  return state;
}

const DocStateContext = createContext<DocState>();

/**
 * The current document's {@link DocState}. Pointed error outside a document — every doc-state
 * consumer (the prelude's `Heading`/`Ref`/`Footnote`/…) must render inside a `NotaDoc`.
 */
export function useDocState(): DocState {
  const state = useContext(DocStateContext);
  if (!state) {
    throw new Error(
      "nota: no document state in context — doc-state components must render inside <NotaDoc>"
    );
  }
  return state;
}

/** The context, exported for the render drivers; prefer {@link useDocState} in components. */
export { DocStateContext };
