/**
 * SSG entry for the `?bib` e2e: loaded through the Vite SSR pipeline, for the same reason
 * ./ssg-entry.ts is — the compiled `.nota`, the prelude and `@nota-lang/core` have to be one
 * module instance or the doc-state context splits in two.
 *
 * Re-exports the imported database as well as the render, so the test can check both the JSON
 * the `?bib` module produced and what `bibset` did with it.
 */
import { renderDocument } from "@nota-lang/core";
import type { BibDatabase } from "../../src/bib";
import Doc from "./bib.nota";
import bib from "./refs.bib?bib";

export function run(): { html: string; bib: BibDatabase } {
  return { html: renderDocument(Doc).html, bib };
}
