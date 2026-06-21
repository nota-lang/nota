/**
 * CM6 syntax highlighting for the **Post-SSG HTML** pane: the `@codemirror/lang-html` Lezer parser
 * paired with the shared {@link catppuccinHighlight} (which maps the HTML tag/attribute tags too).
 */

import { html } from "@codemirror/lang-html";
import type { Extension } from "@codemirror/state";
import { catppuccinHighlight } from "./highlight-style";

/** The HTML language + Catppuccin highlight, as one CM6 extension for the read-only `CodeView`. */
export function htmlLanguage(): Extension {
  // No embedded `<script>`/`<style>` autocompletion machinery — this is a read-only debug dump.
  return [
    html({ autoCloseTags: false, matchClosingTags: false }),
    catppuccinHighlight
  ];
}
