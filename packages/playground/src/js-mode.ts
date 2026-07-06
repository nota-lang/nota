/**
 * CM6 syntax highlighting for the **Generated-JS** pane: the `@codemirror/lang-javascript` Lezer
 * parser paired with the shared {@link catppuccinHighlight}.
 */

import { javascript } from "@codemirror/lang-javascript";
import type { Extension } from "@codemirror/state";
import { catppuccinHighlight } from "@nota-lang/codemirror";

/** The JS language + Catppuccin highlight, as one CM6 extension for the read-only `CodeView`. */
export function jsLanguage(): Extension {
  return [javascript(), catppuccinHighlight];
}
