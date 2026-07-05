/**
 * `@nota-lang/prelude` — the standard ambient prelude (contract R14).
 *
 * The reader emits `Tex` / `CodeInline` / `CodeBlock` as free identifiers; integrators bind them to
 * this package's exports (the CLI via esbuild `inject`, vite via its virtual prelude module). Each
 * is a **registry slot** over a shipped default:
 *
 * - `Tex` → {@link DefaultTex} — KaTeX → MathML (no CSS/fonts needed);
 * - `CodeInline` / `CodeBlock` → {@link DefaultCodeInline} / {@link DefaultCodeBlock} — sync shiki,
 *   armed `|@` parts as decorations.
 *
 * Override per-site at runtime with `registerComponents({ Tex: MyMath })` (re-exported here for
 * convenience — it is ambient-adjacent surface); override per-document by `%import`ing your own
 * binding, which lexically shadows the ambient one. A registered *plain function* stays fully
 * static under SSG; a registered `inlineComponent`/`blockComponent` becomes a hydration island —
 * both interact with SSG like any other component (R14b).
 *
 * Configure the defaults with {@link lstset} (listings-style: lang/theme/grammar extensions)
 * and {@link mathset} (KaTeX macros) — document-global, reset per render (R14d).
 */

import { slot } from "@nota-lang/runtime";

import { DefaultCodeBlock, DefaultCodeInline } from "./code";
import { DefaultTex } from "./tex";

// --- the ambient bindings (registry slots over the shipped defaults) ---
export const Tex = slot("Tex", DefaultTex);
export const CodeInline = slot("CodeInline", DefaultCodeInline);
export const CodeBlock = slot("CodeBlock", DefaultCodeBlock);

// --- override surface (re-exported from the runtime so `% registerComponents({…})` is ambient) ---
export {
  clearRegisteredComponents,
  registerComponents
} from "@nota-lang/runtime";
// --- the shipped defaults (exported for composition/wrapping in user overrides) ---
export { DefaultCodeBlock, DefaultCodeInline } from "./code";

// --- configuration (R14d) ---
export {
  bakeConfigBaseline,
  type LstsetOptions,
  lstset,
  type MathsetOptions,
  mathset,
  resetConfigForTest
} from "./config";
export { DefaultTex } from "./tex";
