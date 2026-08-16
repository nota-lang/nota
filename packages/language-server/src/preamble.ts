/**
 * The **typing preamble** prepended to every virtual `.tsx` — a thin re-export of the *generated*
 * preamble (`./preamble.generated.ts`, baked by `scripts/gen-preamble.ts`; see `./preamble-gen.ts`
 * for the generator).
 *
 * The reader's `compileVirtual` emits a *bare* Solid JSX `.tsx` — it deliberately omits every
 * import; the structural components (`NotaDoc`/`Reforest`/`UlLi`/…), the ambient prelude, and the
 * `solid-js` state surface are free identifiers. The preamble supplies them as module-local
 * ambient declarations plus a global `JSX` namespace, so a `.nota` **anywhere** — with no
 * `node_modules` at all — still type-checks (resolution independence).
 *
 * **The preamble-shift rule.** Prepending text to `code` pushes every generated offset forward by
 * `PREAMBLE_LENGTH` bytes. The reader's `generatedOffsets` index the *bare* `.tsx`; after the
 * prepend they must be shifted by `PREAMBLE_LENGTH`. `sourceOffsets` index the `.nota` and are
 * **unchanged**. `shiftMappings` (language-plugin) performs exactly this. The preamble is whole
 * lines only and never the target of a mapping, so the shift is a pure additive constant.
 */

export { PREAMBLE, PREAMBLE_LENGTH } from "./preamble.generated.js";
