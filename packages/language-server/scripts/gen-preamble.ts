/**
 * Regenerate `src/preamble.generated.ts` from the built runtime `.d.ts` (contract R22 / D3).
 *
 * Run after any change to the runtime's typed emit surface (`h` overloads, the DOM attribute map,
 * `inlineComponent`/`blockComponent`, …) or the ambient prelude shapes in `preamble-gen.ts`:
 *
 * ```sh
 * cd packages/runtime && depot build          # the generator reads runtime/dist/*.d.ts
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

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "preamble.generated.ts");

const preamble = buildPreamble();
const file = `/**
 * **GENERATED — do not edit.** The resolution-independent typing preamble, baked from the runtime's
 * built \`.d.ts\` by \`scripts/gen-preamble.ts\` (contract R22 / D3). Regenerate after a runtime
 * typed-surface change; the \`preamble-sync\` test guards drift. See \`./preamble-gen.ts\`.
 */

/** The typing preamble prepended to every virtual \`.tsx\` (ambient runtime module + prelude globals). */
export const PREAMBLE = ${JSON.stringify(preamble)};

/** The byte length every \`generatedOffsets\` entry is shifted by (a clean whole-lines constant). */
export const PREAMBLE_LENGTH = PREAMBLE.length;
`;

writeFileSync(OUT, file, "utf8");
// eslint-disable-next-line no-console
console.log(`wrote ${OUT} (${preamble.length} chars)`);
