/**
 * Vitest **globalSetup** for the hydration e2e (runs in full Node — NOT jsdom).
 *
 * The builds are the slow part (cold reader + two vite builds each), and they belong in Node, not
 * in the jsdom workers — so we build the fixtures' document directories here, once, and the jsdom
 * tests then *load the emitted files* — exactly what the e2e wants.
 *
 * Two fixtures:
 * - `golden.nota` — the canonical `Colorized` document (module-scope island).
 * - `closure.nota` — the replay-hydration headline: a **document-local** island defined inside
 *   `@for`, closing over the loop variable. Only replay hydration (`hydrateDocument`) can hydrate it.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNotaFile } from "../src/build";
import { BUILT_DIR, CLOSURE_BUILT_DIR } from "./builtHtmlPath";

const here = dirname(fileURLToPath(import.meta.url));

export default async function setup(): Promise<void> {
  const pkgRoot = join(here, "..");
  const integrationDir = join(here, "..", "..", "..", "integration");
  await buildNotaFile(join(integrationDir, "golden.nota"), {
    resolveFrom: pkgRoot,
    outDir: BUILT_DIR
  });
  await buildNotaFile(join(integrationDir, "closure.nota"), {
    resolveFrom: pkgRoot,
    outDir: CLOSURE_BUILT_DIR
  });
}
