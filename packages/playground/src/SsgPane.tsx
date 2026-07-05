/**
 * The **SSG output** pane: the artifacts a build ships, stacked. The HTML
 * comes back from `renderToString` with no indentation, so it gets the full treatment — Prettier
 * (html parser) + CM6 HTML highlighting via {@link CodePane}. The island manifest is built by
 * `JSON.stringify(…, 2)`, already pretty, so it only needs highlighting: a read-only JSON
 * {@link CodeView}. The **client JS** block is the generated hydration entry
 * (`generateClientEntry(manifest)` — the exact source the CLI esbuild-bundles into the inlined
 * `<script>`), Prettier(babel) + JS highlighting; an island-free doc shows the zero-JS note
 * instead, mirroring the CLI (which emits no client bundle at all). All grow to their content;
 * the surrounding tab body scrolls.
 */

import { useMemo } from "react";
import { CodePane } from "./CodePane";
import { CodeView } from "./CodeView";
import { jsonLanguage } from "./json-mode";
import type { ManifestEntry } from "./ssg";

export interface SsgPaneProps {
  html: string;
  manifest: Record<string, ManifestEntry>;
  /** The generated hydration entry; `""` = island-free (zero-JS). */
  clientJs: string;
}

export function SsgPane({ html, manifest, clientJs }: SsgPaneProps) {
  const jsonLang = useMemo(() => jsonLanguage(), []);
  const manifestText = useMemo(
    () => JSON.stringify(manifest, null, 2),
    [manifest]
  );

  return (
    <div className="ssg" data-testid="pane-ssg">
      <h4>HTML</h4>
      <CodePane code={html} mode="html" testid="pane-ssg-html" />
      <h4>Island manifest</h4>
      <div className="ssg-manifest" data-testid="pane-ssg-manifest">
        <CodeView value={manifestText} language={jsonLang} />
      </div>
      <h4>Client JS (hydration entry)</h4>
      {clientJs === "" ? (
        <p className="ssg-zero-js" data-testid="pane-ssg-client-js-empty">
          island-free document — no client JS is generated (zero-JS)
        </p>
      ) : (
        <>
          <p className="ssg-caption" data-testid="pane-ssg-client-js-caption">
            bundler input, not a shipped file: esbuild folds this entry, the
            compiled document module (<code>./doc.compiled.mjs</code> — the
            Generated JS pane), the runtime, and the adapter into the ONE{" "}
            <code>&lt;script&gt;</code> inlined in the built HTML.
          </p>
          <CodePane code={clientJs} mode="js" testid="pane-ssg-client-js" />
        </>
      )}
    </div>
  );
}
