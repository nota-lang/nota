/**
 * SSG entry for the hydrate e2e: server-renders the fixture document (two-pass, seeded) to
 * hydratable HTML. Loaded through Vite's SSR pipeline by tests/ssg.mjs, so JSX here and in the
 * imported modules compiles to solid-js/web server calls.
 */
import { renderDocument } from "../../src/lib";
import { Doc, PlainDoc } from "./doc";

export function run(): {
  body: string;
  state: string;
  scopedBody: string;
  plainBody: string;
} {
  const { html, state } = renderDocument(Doc);
  // The host-embedding shape (Astro island): hydration keys prefixed by a per-document id.
  const scoped = renderDocument(Doc, { renderId: "s0" });
  // The seed-free document (no forward references) for the hydrateDocument fallback paths.
  const plain = renderDocument(PlainDoc);
  return {
    body: html,
    state: JSON.stringify(state),
    scopedBody: scoped.html,
    plainBody: plain.html
  };
}
