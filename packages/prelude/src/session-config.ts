/**
 * Per-document-session configuration slots.
 *
 * This is the mechanism the positional setters share, and deliberately not a config object: each
 * concern owns its own state next to the components that read it (`lstset` and the code config in
 * `./code`, `mathset` and the math config in `./tex`, and so on). A single `PreludeConfig` made
 * every setter look like it belonged to every component, and made the module holding it a
 * dependency of everything.
 *
 * Each slot has two levels, which is what the render model requires:
 *
 * - a **baseline**, mutated by a setter called outside any document — the "site setup module"
 *   path, where an integrator establishes defaults before rendering; and
 * - a **session copy**, cloned from the baseline the first time a document touches the slot.
 *
 * The copy is what makes the fixpoint render sound. Every pass is a separate session, so a
 * `% lstset(…)` halfway through a document must not leak from one pass into the next, and two
 * documents rendered on one page must not see each other's configuration.
 */

import { type DocState, useOptionalDocState } from "@nota-lang/core";

/** A configuration slot: mutable for setters, readonly for the components that read it. */
export interface SessionConfig<T> {
  /**
   * The live, mutable value for the active session — or the baseline when there is no session,
   * which is how a setup module establishes defaults. The setters' seam.
   */
  update(session?: DocState): T;
  /** The same value, typed for reading. */
  read(session?: DocState): Readonly<T>;
}

/** Every slot's baseline reset, for {@link resetConfigForTest}. */
const RESETS: (() => void)[] = [];

/**
 * Declare a configuration slot.
 *
 * `defaults` must return a fresh value per call and `copy` must copy deeply enough that a
 * session cannot mutate the baseline through it — arrays and records held by the value need
 * their own copies, or one document's `lstset({ langs })` would append to every later one's.
 */
export function sessionConfig<T>(
  defaults: () => T,
  copy: (value: T) => T
): SessionConfig<T> {
  const key = {};
  let setup = defaults();
  const update = (session?: DocState): T => {
    const active = session ?? useOptionalDocState();
    return active?.local(key, () => copy(setup)) ?? setup;
  };
  RESETS.push(() => {
    setup = defaults();
  });
  return { update, read: update };
}

/** Test hook: restore every slot's shipped defaults as both current value and baseline. */
export function resetConfigForTest(): void {
  for (const reset of RESETS) {
    reset();
  }
}
