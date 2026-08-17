/**
 * The paths to the hydration e2e's built **document directories**, in a standalone module that
 * imports **nothing heavy** — crucially NOT `../src/build` — so the jsdom test can import the
 * constants without dragging the build pipeline (and vite) into the jsdom realm. The Node
 * globalSetup (which writes the directories) and the jsdom test (which reads them) share these.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

/** The golden's built document directory (`index.html` + `assets/`), written by the globalSetup. */
export const BUILT_DIR = join(here, ".golden.built");

/**
 * The closure fixture's built document directory (`integration/closure.nota` — a document-local
 * component inside `@for` closing over the loop variable, hydrated as part of the one Solid app).
 */
export const CLOSURE_BUILT_DIR = join(here, ".closure.built");

/**
 * The conditional fixture's built document directory (`integration/conditional.nota` — `@if`
 * lowered to Solid's `<Show>`: a reactive branch with a `fallback`, plus taken/untaken
 * fallback-less branches).
 */
export const CONDITIONAL_BUILT_DIR = join(here, ".conditional.built");

/**
 * The dynamic fixture's built document directory (`integration/dynamic.nota` — the `<Dynamic>`
 * hydration surface: prelude `Heading` (`<Dynamic component={"h"+rank}>`) + a forward `@Toc`, an
 * `@(expr){…}` dynamic tag whose expression is a component, a `@Definition`/`&ref` pair (the def
 * tooltip's hydration path), and a signal-driven counter).
 */
export const DYNAMIC_BUILT_DIR = join(here, ".dynamic.built");

/** A built directory's `index.html`. */
export function indexHtmlOf(dir: string): string {
  return join(dir, "index.html");
}

/** A built directory's client bundle (the IIFE the page's `<script src>` loads). */
export function clientJsOf(dir: string): string {
  return join(dir, "assets", "index.js");
}
