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
// `PREAMBLE_LENGTH` shifts the reader's BYTE offsets (`shiftMappings`, language-plugin.ts) — it
// must be a true UTF-8 byte length, not `PREAMBLE.length` (a UTF-16 code-unit count). The two
// coincide only while `preamble` is pure ASCII, which is otherwise unenforced — bake the real byte
// length here (generation time, where `Buffer` is available) rather than recomputing `.length` at
// server-runtime load (browser-worker-reachable, where it is not — see `./byte-offsets.ts`).
const preambleByteLength = Buffer.byteLength(preamble, "utf8");
const file = `/**
 * **GENERATED — do not edit.** The resolution-independent typing preamble, baked by
 * \`scripts/gen-preamble.ts\` from the hand-written ambient declarations in \`./preamble-gen.ts\`
 * (coverage-guarded against the compiler's canonical free-name lists). Regenerate after any
 * typed-surface change; the \`preamble-sync\` test guards drift.
 */

/** The typing preamble prepended to every virtual \`.tsx\` (global JSX namespace + ambient structural/solid-js/prelude declarations). */
export const PREAMBLE = ${JSON.stringify(preamble)};

// A cheap module-load invariant, not an incidental restriction: \`PREAMBLE_LENGTH\` below is baked
// as PREAMBLE's UTF-8 BYTE length at generation time (\`Buffer.byteLength\`, in \`gen-preamble.ts\`,
// where \`Buffer\` is available) rather than recomputed as \`PREAMBLE.length\` (UTF-16 code units) at
// server-runtime load — the two coincide only while PREAMBLE is pure ASCII. If a future preamble
// edit ever introduces a non-ASCII character, this throws at import time instead of silently
// shifting every \`.nota\` ⇄ virtual-\`.tsx\` mapping by the (now wrong) byte count.
if (/[^\\x00-\\x7f]/.test(PREAMBLE)) {
  throw new Error(
    "preamble.generated.ts: PREAMBLE must be pure ASCII — PREAMBLE_LENGTH is baked as a UTF-8 byte length at generation time (see scripts/gen-preamble.ts)"
  );
}

/** The UTF-8 byte length every \`generatedOffsets\` entry is shifted by — baked at generation time
 * as a literal (see the ASCII assertion above for why \`PREAMBLE.length\` would also work today, and
 * why this doesn't rely on that coincidence). */
export const PREAMBLE_LENGTH = ${preambleByteLength};
`;

writeFileSync(OUT, file, "utf8");
// eslint-disable-next-line no-console
console.log(
  `wrote ${OUT} (${preamble.length} UTF-16 units, ${preambleByteLength} UTF-8 bytes)`
);
