/**
 * `@nota-lang/language-server` — the Volar language server for `.nota`.
 *
 * At its core is a Volar `LanguagePlugin` that turns a `.nota`
 * file into a virtual `.tsx` (the reader's type-preserving emit + a typing preamble) and a
 * `CodeMapping[]` linking `.nota` ⇄ `.tsx` offsets, over which `@volar/typescript` runs the standard
 * TS language service — surfacing **diagnostics** mapped back to `.nota` ranges (the headline case:
 * `@Unknown{}` → "Cannot find name 'Unknown'"). Hover, completion, definition, references,
 * rename, and semantic tokens all ride this same core.
 *
 * Public surface:
 * - {@link notaLanguagePlugin} — the Volar `LanguagePlugin`.
 * - {@link buildVirtual} / {@link shiftMappings} — the virtual-code build + the
 *   preamble-shift (exposed for testing and embedders).
 * - {@link PREAMBLE} / {@link PREAMBLE_LENGTH} — the typing preamble and its length.
 * - {@link startServer} — boot the LSP server on a connection (the `bin.ts` executable calls this).
 */

export {
  buildVirtual,
  NOTA_LANGUAGE_ID,
  type NotaVirtualCode,
  notaLanguagePlugin,
  shiftMappings,
  VIRTUAL_LANGUAGE_ID
} from "./language-plugin.js";
export { PREAMBLE, PREAMBLE_LENGTH } from "./preamble.js";
export { startServer } from "./server.js";
