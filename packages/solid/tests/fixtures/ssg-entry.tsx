/**
 * SSG entry for the hydrate e2e: server-renders the fixture document (two-pass, seeded) to
 * hydratable HTML. Loaded through Vite's SSR pipeline by tests/ssg.mjs, so JSX here and in the
 * imported modules compiles to solid-js/web server calls.
 */
import { renderDocument } from "../../src/lib";
import { Doc } from "./doc";

export function run(): { body: string; state: string; scopedBody: string } {
  const { html, state } = renderDocument(Doc);
  // The host-embedding shape (Astro island): hydration keys prefixed by a per-document id.
  const scoped = renderDocument(Doc, { renderId: "s0" });
  return {
    body: html,
    state: JSON.stringify(state),
    scopedBody: scoped.html
  };
}
