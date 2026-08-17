/**
 * SSG entry for the doc-state **sugar** e2e (`sugars.nota` — `<label>`, `&ref`, `[^n]`,
 * `[^n]: body` only; no element forms). Same shape as ./ssg-entry.ts: loaded through the Vite
 * SSR pipeline so the whole graph shares one doc-state context instance.
 */
import { docStateScript, renderDocument } from "@nota-lang/solid";
import Doc from "./sugars.nota";

export function run(): { html: string; stateScript: string } {
  const { html, state } = renderDocument(Doc);
  return { html, stateScript: docStateScript(state) };
}
