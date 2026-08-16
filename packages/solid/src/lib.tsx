/**
 * `@nota-lang/solid` — the Nota runtime, specialized to Solid (design/solid.md).
 *
 * A `.nota` document compiles to a plain Solid component whose body is wrapped in
 * {@link NotaDoc}: a document-state provider around a {@link Reforest} pass plus a trailer
 * outlet. Everything the old `@nota-lang/runtime` did with a parallel vnode tree
 * (struct/serialize/islands/replay) is done here with Solid's own primitives:
 *
 * - **Restructuring** (`reforest.tsx`): Solid's `children()` helper resolves descendants
 *   *through* component boundaries; re-parenting the resolved nodes — paragraphs, lists,
 *   nested sections — is semantically transparent because Solid binds reactivity to node
 *   identity, and the deterministic pass derives the same forest on server and client.
 * - **Doc-state** (`doc-state.ts`): the LaTeX `.aux` model in process — components register
 *   facts and read derived facts through memos; a seed pins reads for SSG pass 2 / hydration.
 * - **Drivers** (`render.tsx`): {@link renderDocument} (two-pass + convergence) and
 *   {@link hydrateDocument} (seed + claim + silent release).
 *
 * This module is the package's public surface; the implementation lives in the sibling files.
 */

export * from "./doc-state";
export * from "./nota-doc";
export * from "./reforest";
export * from "./render";
export * from "./smart";
export * from "./text";
