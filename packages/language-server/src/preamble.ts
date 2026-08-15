/**
 * The **typing preamble** prepended to every virtual `.tsx` — a thin re-export of the *generated*
 * preamble (`./preamble.generated.ts`, baked from the runtime's built `.d.ts` by
 * `scripts/gen-preamble.ts`; see `./preamble-gen.ts` for the generator).
 *
 * The reader's `compileVirtual` emits a *bare* `.tsx` — it deliberately omits the
 * `@nota-lang/runtime` import and the ambient prelude bindings the emit references as free
 * identifiers (`useState`, `CodeInline`/`CodeBlock`/`Tex`/`Heading` + the doc-state family, the
 * config fns). The preamble supplies them. Crucially it declares the runtime surface as an **ambient
 * module** (`declare module "@nota-lang/runtime" { … }`, the runtime's own `.d.ts` inlined) rather
 * than importing it from `node_modules`, so a `.nota` **outside** `packages/*` — where there is no
 * `node_modules/@nota-lang/runtime` — still resolves `h`/`decode`/`blockComponent`/… to their real
 * typed signatures (the resolution-independence fix for "`blockComponent` has no inferred type").
 *
 * **The preamble-shift rule.** Prepending text to `code` pushes every generated offset forward by
 * `PREAMBLE_LENGTH` bytes. The reader's `generatedOffsets` index the *bare* `.tsx`; after the
 * prepend they must be shifted by `PREAMBLE_LENGTH`. `sourceOffsets` index the `.nota` and are
 * **unchanged**. {@link shiftMappings} performs exactly this. The preamble is whole lines only and is
 * never the target of a mapping, so the shift is a pure additive constant.
 */

export { PREAMBLE, PREAMBLE_LENGTH } from "./preamble.generated.js";
