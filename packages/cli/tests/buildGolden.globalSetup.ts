/**
 * Vitest **globalSetup** for the hydration e2e (runs in full Node — NOT jsdom).
 *
 * The builds are the slow part (cold reader + two vite builds each), so we build the fixtures'
 * document directories here, once; the jsdom tests then *load the emitted files*.
 *
 * Two fixtures:
 * - `golden.nota` — the canonical `Colorized` document (signal-driven style, click → color).
 * - `closure.nota` — a **document-local** component defined inside `@for`, closing over the
 *   loop variable, with per-instance signal state. Under the Solid architecture this needs no
 *   replay machinery: the whole document hydrates as one app and the closures are just... the
 *   program's closures.
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
