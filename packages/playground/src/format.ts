/** Lazily format generated code for display. */

type Parser = "babel";

let standaloneP: Promise<typeof import("prettier/standalone")> | null = null;
function loadStandalone() {
  if (!standaloneP) standaloneP = import("prettier/standalone");
  return standaloneP;
}

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

/** Format code, falling back to the input on parse or print errors. */
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
