/**
 * Pretty-print an output pane for *display only* (the emitted JS module, the SSG HTML).
 * The wasm reader's codegen and React's `renderToString` are both valid but unfriendly to read — the
 * JS emit puts the whole `Doc()` body on one line; the SSG HTML comes back with no indentation. We
 * reformat purely for the pane, never touching the bytes the pipeline actually emits/serializes, so
 * the parity tests still compare the raw output.
 *
 * "Easiest formatter that runs in the browser" = **Prettier standalone**: plain JS, no wasm init,
 * async `format()`. Standalone + the parser plugins load via dynamic `import()` so the formatter
 * stays off the initial bundle (it code-splits into lazy chunks), and each parser pulls only the
 * plugins it needs — the JS pane never fetches the HTML plugin, and vice-versa.
 */

type Parser = "babel" | "html";

let standaloneP: Promise<typeof import("prettier/standalone")> | null = null;
function loadStandalone() {
  if (!standaloneP) standaloneP = import("prettier/standalone");
  return standaloneP;
}

// Memoize each parser's plugin set so we pay its module fetch + parse once, not per keystroke.
const pluginsP: Partial<Record<Parser, Promise<object[]>>> = {};
function loadPlugins(parser: Parser): Promise<object[]> {
  if (!pluginsP[parser]) {
    pluginsP[parser] =
      parser === "html"
        ? import("prettier/plugins/html").then(html => [html])
        : Promise.all([
            import("prettier/plugins/babel"),
            import("prettier/plugins/estree")
          ]);
  }
  return pluginsP[parser];
}

/**
 * Format `code` with the given Prettier parser for display. Falls back to the input unchanged on any
 * parse/print error — the emit is always valid, so this only guards
 * against a transient half-applied edit, and a raw pane beats a blank one.
 */
export async function formatCode(
  code: string,
  parser: Parser
): Promise<string> {
  if (!code.trim()) return code;
  try {
    const [{ format }, plugins] = await Promise.all([
      loadStandalone(),
      loadPlugins(parser)
    ]);
    return await format(code, { parser, plugins });
  } catch {
    return code;
  }
}
