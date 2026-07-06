/**
 * The path to the hydration e2e's built single-file HTML, in a standalone module that imports
 * **nothing heavy** — crucially NOT `../src/build` (which imports `esbuild`, whose module init throws
 * under jsdom). Both the Node globalSetup (which writes the file) and the jsdom test (which reads it)
 * import this constant without dragging esbuild into the jsdom realm.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** Where the golden's built single-file HTML is written for the jsdom e2e to read. */
export const BUILT_HTML_PATH = join(here, ".golden.built.html");

/**
 * Where the closure fixture's built single-file HTML is written (`integration/closure.nota` — the
 * replay-hydration headline: a document-local island inside `@for` closing over the loop variable).
 */
export const CLOSURE_BUILT_HTML_PATH = join(here, ".closure.built.html");
