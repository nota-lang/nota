/**
 * SSG entry for the e2e: loaded through the Vite SSR pipeline (so the whole graph — the compiled
 * `.nota`, `@nota-lang/solid`, the prelude — is ONE module instance; rendering from the test's
 * own module registry would split the doc-state context).
 */
import { docStateScript, renderDocument } from "@nota-lang/solid";
import Doc from "./doc.nota";

export function run(): { html: string; stateScript: string } {
  const { html, state } = renderDocument(Doc);
  return { html, stateScript: docStateScript(state) };
}
