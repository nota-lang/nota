/**
 * The renderer's DOM marker attributes — one copy for the server (writes the kebab-case
 * attribute) and the client (reads the camelCase `dataset` key, derived by the DOM's own rule).
 */

/** Ties a rendered island to its hydration entry. */
export const RENDER_ID_ATTR = "data-nota-render-id";

/** Carries the converged doc-state snapshot to the client. */
export const DOC_STATE_ATTR = "data-nota-doc-state";

/** The `dataset` property name for a `data-*` attribute (the DOM's kebab→camel conversion). */
export const datasetKey = (attr: string): string =>
  attr
    .replace(/^data-/, "")
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
