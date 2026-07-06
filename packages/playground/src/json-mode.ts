/**
 * CM6 syntax highlighting for the **island manifest** (JSON) shown under the SSG-output pane: the
 * `@codemirror/lang-json` Lezer parser paired with the shared {@link catppuccinHighlight}.
 */

import { json } from "@codemirror/lang-json";
import type { Extension } from "@codemirror/state";
import { catppuccinHighlight } from "@nota-lang/codemirror";

/** The JSON language + Catppuccin highlight, as one CM6 extension for the read-only `CodeView`. */
export function jsonLanguage(): Extension {
  return [json(), catppuccinHighlight];
}
