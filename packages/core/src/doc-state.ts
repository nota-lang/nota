/**
 * Per-document registrations used for references, numbering, and end-of-document trailers.
 * Seeded stores support two-pass rendering; live registrations remain reactive on the client.
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

/** Function-valued fields are live-only and omitted from snapshots. */
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
  /** Register a fact, assigning global `pos` and per-kind `seq` values. */
  register(kind: string, fact: Fact): FactHandle;
  /** Remove a registration (rarely needed directly — see {@link register}). */
  unregister(h: FactHandle): void;
  /** Read the pinned seed, or live facts after release. */
  read(kind: string): Fact[];
  /** Read live facts, including fields that cannot enter a snapshot. */
  live(kind: string): Fact[];
  /** Unpin the seed without notifying readers. */
  release(): void;
  /** The JSON-safe snapshot of live registrations (function-valued fields dropped). */
  snapshot(): Snapshot;
  /** Register a document-end trailer thunk, idempotent by name (first registration wins). */
  trailer(name: string, thunk: () => JSX.Element): void;
  /** The registered trailer thunks, in registration order (reactive). */
  trailers(): (() => JSX.Element)[];
  /** Set a document flag. */
  flag(name: string): void;
  /** Read a document flag reactively. */
  hasFlag(name: string): boolean;
  /** Was this store created with a seed (SSG pass 2 / hydration)? */
  readonly seeded: boolean;
  /** Document-wide smart-punctuation settings. */
  readonly smart?: SmartOptions | false;
}

/** Store-creation options ({@link createDocState}). */
export interface DocStateOptions {
  /** Smart punctuation for this document's Reforest passes ({@link DocState.smart}). */
  smart?: SmartOptions | false;
}

/** Create a reactive store, optionally pinned to a snapshot until {@link DocState.release}. */
export function createDocState(
  seed?: Snapshot,
  options: DocStateOptions = {}
): DocState {
  const [version, setVersion] = createSignal(0);
  // Release is silent because a converged live store equals its seed. The next registration
  // bumps version and moves readers to live facts.
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
      // Server roots dispose before snapshot(), so only client registrations auto-unregister.
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

/** Return the current document store. */
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
