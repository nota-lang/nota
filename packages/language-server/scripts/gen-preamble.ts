/**
 * Regenerate `src/preamble.generated.ts` — the resolution-independent typing preamble, built by
 * `preamble-gen.ts` from its hand-written ambient declarations, coverage-guarded against the
 * compiler's canonical free-name lists.
 *
 * Run after any change to the ambient surfaces in `preamble-gen.ts` (the JSX namespace, the
 * structural components, the solid-js/prelude declarations):
 *
 * ```sh
 * cd packages/language-server && npx tsx scripts/gen-preamble.ts
 * ```
 *
 * The committed `preamble.generated.ts` bakes the preamble into the shipped server (so it does not
 * read the runtime `.d.ts` at editor runtime); the `preamble-sync` test fails CI if it drifts from
 * what this script would produce.
 */

import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPreamble } from "../src/preamble-gen.ts";

const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "src",
  "preamble.generated.ts"
);

const preamble = buildPreamble();
const file = `/**
 * **GENERATED — do not edit.** The resolution-independent typing preamble, baked by
 * \`scripts/gen-preamble.ts\` from the hand-written ambient declarations in \`./preamble-gen.ts\`
 * (coverage-guarded against the compiler's canonical free-name lists). Regenerate after any
 * typed-surface change; the \`preamble-sync\` test guards drift.
 */

/** The typing preamble prepended to every virtual \`.tsx\` (global JSX namespace + ambient structural/solid-js/prelude declarations). */
export const PREAMBLE = ${JSON.stringify(preamble)};

/** The byte length every \`generatedOffsets\` entry is shifted by (a clean whole-lines constant). */
export const PREAMBLE_LENGTH = PREAMBLE.length;
`;

writeFileSync(OUT, file, "utf8");
// eslint-disable-next-line no-console
console.log(`wrote ${OUT} (${preamble.length} chars)`);
