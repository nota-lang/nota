/**
 * The **SSG output** pane: the two artifacts `render` produces, stacked. The HTML
 * comes back from `renderToString` with no indentation, so it gets the full treatment — Prettier
 * (html parser) + CM6 HTML highlighting via {@link CodePane}. The island manifest is built by
 * `JSON.stringify(…, 2)`, already pretty, so it only needs highlighting: a read-only JSON
 * {@link CodeView}. Both grow to their content; the surrounding tab body scrolls.
 */

import { useMemo } from "react";
import { CodePane } from "./CodePane";
import { CodeView } from "./CodeView";
import { jsonLanguage } from "./json-mode";
import type { ManifestEntry } from "./ssg";

export interface SsgPaneProps {
  html: string;
  manifest: Record<string, ManifestEntry>;
}

export function SsgPane({ html, manifest }: SsgPaneProps) {
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
    </div>
  );
}
