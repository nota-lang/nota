/**
 * Pretty-print the **Generated-JS** pane (decode.md stage 3). The wasm reader's codegen is valid but
 * unfriendly to read — it tab-indents yet emits the whole `Doc()` body as one long line of nested
 * `h(...)` calls. We reformat purely for *display*; the parity tests still compare the raw
 * {@link compileNotaRaw} emit, so this never touches the byte-identity invariant (contract §3).
 *
 * "Easiest formatter that runs in the browser" = **Prettier standalone**: plain JS, no wasm init,
 * `format()` is async. We pull it (and the babel parser + estree printer) via dynamic `import()` so
 * the ~1.5 MB of formatter stays off the initial bundle — it loads lazily on the first format, after
 * the editor + compiler are already interactive.
 */

type PrettierKit = {
  format: (source: string, options: object) => Promise<string>;
  plugins: object[];
};

// Memoize the dynamic import so we pay the module fetch + parse once, not per keystroke.
let kit: Promise<PrettierKit> | null = null;
function loadPrettier(): Promise<PrettierKit> {
  if (!kit) {
    kit = Promise.all([
      import("prettier/standalone"),
      import("prettier/plugins/babel"),
      import("prettier/plugins/estree")
    ]).then(([standalone, babel, estree]) => ({
      format: standalone.format,
      // The plugin *is* the module namespace (Prettier's documented usage).
      plugins: [babel, estree]
    }));
  }
  return kit;
}

/**
 * Format an emitted JS module for display. Falls back to the input unchanged on any parse/print
 * error — the emit is always valid JS (impl.md §1.6 validity invariant), so this only guards against
 * a transient half-applied edit, and a raw pane beats a blank one.
 */
export async function formatJs(code: string): Promise<string> {
  if (!code.trim()) return code;
  try {
    const { format, plugins } = await loadPrettier();
    return await format(code, { parser: "babel", plugins });
  } catch {
    return code;
  }
}
