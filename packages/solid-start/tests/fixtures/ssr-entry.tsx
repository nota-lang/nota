/**
 * The server bytes the client suite hydrates.
 *
 * Rendered as two `renderToString` calls — the app, then the shell — which is the ordering
 * `StartServer` produces (the shell's expressions evaluate after `props.children`) and what makes
 * the module-slot handoff in markers.ts observable. Splitting them also keeps the app subtree the
 * root of its own render, so its hydration keys start at 0 and the dom suite can hydrate the
 * route directly; in a real app that alignment comes from `StartClient` mirroring
 * `StartServer`'s `NoHydration`/`Hydration` nesting, which is SolidStart's business, not this
 * package's.
 *
 * Loaded through Vite's SSR pipeline by tests/ssr.mjs (JSX compiled with generate:"ssr").
 */
import { renderToString } from "solid-js/web";
import { notaRoute } from "../../src/document";
import { NotaDocState } from "../../src/server";
import { Doc } from "./doc";

export function run(): { app: string; shell: string } {
  const Route = notaRoute(Doc);
  const app = renderToString(() => <Route />);
  const shell = renderToString(() => <NotaDocState />);
  return { app, shell };
}
