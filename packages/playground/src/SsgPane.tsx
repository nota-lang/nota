/**
 * The **SSG output** pane: the build artifacts, stacked, each under its build-time name.
 *
 * - **HTML** — `render(Doc)`'s output. `renderToString` emits no indentation, so it gets the full
 *   treatment: Prettier (html parser) + CM6 HTML highlighting via {@link CodePane}.
 * - **doc.compiled.mjs** — the compiled document module as a build consumes it (the emitted JS
 *   with the runtime import prepended); Prettier(babel) + JS highlighting.
 * - **client.entry.mjs** — the generated hydration entry (`generateClientEntry({ moduleId })` — the
 *   replay entry: it imports `Doc` and calls `hydrateDocument(Doc)`, which re-executes
 *   the document client-side to recover each island live); an island-free doc shows the zero-JS
 *   note instead, mirroring the CLI (which emits no client bundle at all).
 *
 * All blocks grow to their content; the surrounding tab body scrolls.
 */

import { CodePane } from "./CodePane";

export interface SsgPaneProps {
  html: string;
  /** The compiled document module (runtime import included) — the build's `doc.compiled.mjs`. */
  compiledJs: string;
  /** The generated hydration entry; `""` = island-free (zero-JS). */
  clientJs: string;
}

export function SsgPane({ html, compiledJs, clientJs }: SsgPaneProps) {
  return (
    <div className="ssg" data-testid="pane-ssg">
      <h4>HTML</h4>
      <CodePane code={html} mode="html" testid="pane-ssg-html" />
      <h4>doc.compiled.mjs</h4>
      <CodePane code={compiledJs} mode="js" testid="pane-ssg-compiled" />
      <h4>client.entry.mjs</h4>
      {clientJs === "" ? (
        <p className="ssg-zero-js" data-testid="pane-ssg-client-js-empty">
          island-free document — no client JS is generated (zero-JS)
        </p>
      ) : (
        <CodePane code={clientJs} mode="js" testid="pane-ssg-client-js" />
      )}
    </div>
  );
}
