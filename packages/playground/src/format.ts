/**
 * Pretty-print an output pane for *display only* (the emitted JSX module / babel-compiled JS).
 * The wasm reader's codegen puts the whole `Doc()` body on one line; we reformat purely for the
 * pane, never touching the bytes the pipeline actually emits.
 *
 * "Easiest formatter that runs in the browser" = **Prettier standalone**: plain JS, no wasm init,
 * async `format()`. Standalone + the parser plugins load via dynamic `import()` so the formatter
 * stays off the initial bundle (it code-splits into lazy chunks).
 */

type Parser = "babel";

let standaloneP: Promise<typeof import("prettier/standalone")> | null = null;
function loadStandalone() {
  if (!standaloneP) standaloneP = import("prettier/standalone");
  return standaloneP;
}

// Memoize the plugin set so we pay its module fetch + parse once, not per keystroke.
let pluginsP: Promise<object[]> | null = null;
function loadPlugins(): Promise<object[]> {
  if (!pluginsP) {
    pluginsP = Promise.all([
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree")
    ]);
  }
  return pluginsP;
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
      loadPlugins()
    ]);
    return await format(code, { parser, plugins });
  } catch {
    return code;
  }
}
