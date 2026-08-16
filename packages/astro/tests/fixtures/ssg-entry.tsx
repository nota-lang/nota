/**
 * SSG entry for the client-entry suite: server-render the fixture document exactly the way the
 * renderer's server entry does for a hydrating island — `renderDocument` with a per-island
 * renderId — yielding the island's inner HTML + doc-state snapshot for the attribute transport.
 * Loaded through Vite's SSR pipeline by tests/ssg.mjs.
 */
import { renderDocument } from "@nota-lang/solid";
import { Doc } from "./doc";

export function run(): { html: string; state: string } {
  const { html, state } = renderDocument(Doc, { renderId: "n0" });
  return { html, state: JSON.stringify(state) };
}
