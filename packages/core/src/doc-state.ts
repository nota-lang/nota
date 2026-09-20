/**
 * Per-document registrations used for references, numbering, and end-of-document trailers.
 * Seeded stores are one pass of the fixpoint render; live registrations remain reactive on the
 * client.
 */

import { isServer, type JSX } from "@solidjs/web";
import {
  createContext,
  createSignal,
  getOwner,
  onCleanup,
  useContext
} from "solid-js";
import type { SmartOptions } from "./smart";

/** Opaque identity for one document fact. It carries no ordering semantics. */
export type Location = string;

/** Function-valued fields are live-only and omitted from snapshots. */
export type Fact = Record<string, unknown>;

/** A registered fact. */
export interface LocatedFact extends Fact {
  location: Location;
}

/** One entry in the document-ordered snapshot. */
export interface SnapshotEntry {
  kind: string;
  fact: LocatedFact;
}

/** The ordered, JSON-safe wire format of the document's `.aux` model. */
export type Snapshot = SnapshotEntry[];

/** The handle returned by {@link DocState.register}. */
export interface FactHandle {
  fact: LocatedFact;
}

interface RegisteredFactHandle extends FactHandle {
  kind: string;
}

export interface DocState {
  /** Register a fact with an opaque location. */
  register(kind: string, fact: Fact): FactHandle;
  /** Remove a registration (rarely needed directly — see {@link register}). */
  unregister(h: FactHandle): void;
  /** Read the pinned seed, or live facts after release. */
  read(kind: string): LocatedFact[];
  /** Read live facts, including fields that cannot enter a snapshot. */
  live(kind: string): LocatedFact[];
  /** Unpin the seed without notifying readers. */
  release(): void;
  /** The JSON-safe snapshot of live registrations (function-valued fields dropped). */
  snapshot(): Snapshot;
  /** Register a document-end trailer thunk, idempotent by name (first registration wins). */
  trailer(name: string, thunk: () => JSX.Element): void;
  /** Registered trailer thunks in insertion order (reactive). Shared array: do not mutate. */
  trailers(): (() => JSX.Element)[];
  /** Set a document flag. */
  flag(name: string): void;
  /** Read a document flag reactively. */
  hasFlag(name: string): boolean;
  /** Was this store created with a seed (any SSG pass after the first / hydration)? */
  readonly seeded: boolean;
  /** Document-wide smart-punctuation settings. */
  readonly smart?: SmartOptions | false;
  /** Return session-owned state initialized on first use. */
  local<T>(key: object, init: () => T): T;
  /** Return a location's index in the resolved document order, or `-1` if absent. */
  index(location: Location): number;
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
  // Registrations write bookkeeping signals from component bodies.
  const [version, setVersion] = createSignal(0, { ownedWrite: true });
  // Track trailers separately: fact registrations must not rebuild hydrated trailer DOM.
  const [trailerVersion, setTrailerVersion] = createSignal(0, {
    ownedWrite: true
  });
  // Release is silent because a converged live store equals its seed. The next registration
  // bumps version and moves readers to live facts.
  let released = seed === undefined;
  let nextRegistration = 0;
  const entries: RegisteredFactHandle[] = [];
  const seededFacts = new Map<string, LocatedFact[]>();
  const noSeededFacts: LocatedFact[] = [];
  for (const entry of seed ?? []) {
    const facts = seededFacts.get(entry.kind) ?? [];
    facts.push(entry.fact);
    seededFacts.set(entry.kind, facts);
  }
  const trailerMap = new Map<string, () => JSX.Element>();
  // Replace only when a trailer is added, preserving identity for structural readers.
  let trailerList: (() => JSX.Element)[] = [];
  const flags = new Set<string>();
  const locals = new Map<object, unknown>();
  // Only client readers need invalidation; server writes produce SERVER_WRITE diagnostics.
  const bump = () => {
    if (!isServer) setVersion(v => v + 1);
  };
  const bumpTrailers = () => {
    if (!isServer) setTrailerVersion(v => v + 1);
  };

  const liveOf = (kind: string): LocatedFact[] => {
    version();
    return entries
      .filter(entry => entry.kind === kind)
      .map(entry => entry.fact);
  };

  const state: DocState = {
    register(kind, fact) {
      nextRegistration += 1;
      const handle: RegisteredFactHandle = {
        kind,
        fact: { ...fact, location: `m:${nextRegistration}` }
      };
      entries.push(handle);
      bump();
      // Server roots dispose before snapshot(), so only client registrations auto-unregister.
      if (!isServer && getOwner()) {
        onCleanup(() => state.unregister(handle));
      }
      return handle;
    },
    unregister(h) {
      const i = entries.indexOf(h as RegisteredFactHandle);
      if (i >= 0) {
        entries.splice(i, 1);
        bump();
      }
    },
    read(kind) {
      version(); // track ALWAYS — a pinned reader must still wake on post-release registrations
      if (!released && seed !== undefined) {
        return seededFacts.get(kind) ?? noSeededFacts;
      }
      return entries
        .filter(entry => entry.kind === kind)
        .map(entry => entry.fact);
    },
    live: liveOf,
    release() {
      released = true;
    },
    snapshot() {
      // JSON round-trip: drops function-valued/undefined fields, proving the snapshot is wire-safe.
      return JSON.parse(
        JSON.stringify(entries.map(({ kind, fact }) => ({ kind, fact })))
      ) as Snapshot;
    },
    trailer(name, thunk) {
      if (!trailerMap.has(name)) {
        trailerMap.set(name, thunk);
        trailerList = [...trailerMap.values()];
        bumpTrailers();
      }
    },
    trailers() {
      trailerVersion();
      return trailerList;
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
    },
    local<T>(key: object, init: () => T): T {
      if (!locals.has(key)) {
        locals.set(key, init());
      }
      return locals.get(key) as T;
    },
    index(location) {
      version();
      const resolved = !released && seed !== undefined ? seed : entries;
      return resolved.findIndex(entry => entry.fact.location === location);
    }
  };
  return state;
}

// Solid throws for missing contexts without a non-undefined default.
const DocStateContext = createContext<DocState | null>(null);

/** Allow setup-module setters outside any reactive owner; useContext itself would throw. */
function docStateInContext(): DocState | null {
  return getOwner() === null ? null : useContext(DocStateContext);
}

/** Return the current document store. */
export function useDocState(): DocState {
  const state = docStateInContext();
  if (state === null) {
    throw new Error(
      "nota: no document state in context — doc-state components must render inside <NotaDoc>"
    );
  }
  return state;
}

/** Return the current document store, if called during a document render. */
export function useOptionalDocState(): DocState | undefined {
  return docStateInContext() ?? undefined;
}

/** The context, exported for the render drivers; prefer {@link useDocState} in components. */
export { DocStateContext };
