/** Public language-server API. */

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
