/**
 * The **typing preamble** prepended to every virtual `.tsx`.
 *
 * The reader's `compileVirtual` emits a *bare* `.tsx` — it deliberately omits the
 * `@nota-lang/runtime` import (the reader does not emit it; the integrator prepends it) **and** the
 * ambient prelude bindings the emit references as free identifiers (`useState`, and the documented
 * `CodeInline`/`CodeBlock`/`Math` prelude components). For the TS language service to type-check the
 * virtual module (so `h`/`decode`/`Fragment`/component refs resolve and `@Unknown{}` →
 * "Cannot find name 'Unknown'" rather than a cascade of phantom errors), the language server
 * prepends this preamble.
 *
 * **The preamble-shift rule.** Prepending text to `code` pushes every generated offset forward by
 * `PREAMBLE.length` bytes. The reader's `generatedOffsets` index the *bare* `.tsx`; after the
 * prepend they must be shifted by `PREAMBLE.length`. `sourceOffsets` index the `.nota` and are
 * **unchanged** (the source is untouched). {@link shiftMappings} performs exactly this.
 *
 * The preamble is authored to occupy **whole lines only** and never to be the target of a mapping,
 * so the shift is a pure additive constant — no mapping ever points *into* the preamble.
 */

/**
 * The runtime import the reader omits — byte-identical to
 * `@nota-lang/compiler`'s `RUNTIME_IMPORT`. Brings `h` / `decode` / `Fragment` /
 * `inlineComponent` / `blockComponent` into scope with their shipped `.d.ts` types.
 */
const RUNTIME_IMPORT =
  'import { h, decode, Fragment, inlineComponent, blockComponent } from "@nota-lang/runtime";\n';

/**
 * Ambient declarations for the free identifiers the emit references that are *not* from the runtime
 * import:
 *
 * - `useState` — the framework hook the integrator supplies (the canonical golden's
 *   `%let Colorized = inlineComponent((children) => { let [c, setC] = useState("red"); … })`
 *   references it as a free identifier). Typed as the React-shaped hook so destructuring + the
 *   setter type-check.
 * - `CodeInline` / `CodeBlock` / `Math` — the documented prelude *components* (`` `@x` ``
 *   → `h(CodeInline, …)`, fenced code → `h(CodeBlock, …)`, `$…$` → `h(Math, …)`). They are the
 *   documented extension point; until a real prelude `.d.ts` ships they are ambiently `any` so the
 *   emit type-checks without asserting their shape. (Note: `Math` the JS global is shadowed here only
 *   inside the virtual module; the Nota `Math` *component* is what the emit references.)
 *
 * `declare` + ambient `const` ⇒ no runtime footprint; this is types-only.
 */
const AMBIENT_PRELUDE =
  "declare const useState: <T>(init: T) => [T, (v: T) => void];\n" +
  "declare const CodeInline: any;\n" +
  "declare const CodeBlock: any;\n" +
  "declare const Math: any;\n";

/**
 * The full preamble prepended to the bare virtual `.tsx`. Whole lines only (every line ends in
 * `\n`), so it never overlaps a mapped generated range and the shift stays a clean constant.
 */
export const PREAMBLE = RUNTIME_IMPORT + AMBIENT_PRELUDE;

/** The byte length every `generatedOffsets` entry is shifted by. */
export const PREAMBLE_LENGTH = PREAMBLE.length;
