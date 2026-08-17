/**
 * Vitest **globalSetup** for the hydration e2e (runs in full Node — NOT jsdom).
 *
 * The builds are the slow part (cold reader + two vite builds each), so we build the fixtures'
 * document directories here, once; the jsdom tests then *load the emitted files*.
 *
 * Three fixtures:
 * - `golden.nota` — the canonical `Colorized` document (signal-driven style, click → color).
 * - `closure.nota` — a **document-local** component defined inside `@for`, closing over the
 *   loop variable, with per-instance signal state. Under the Solid architecture this needs no
 *   replay machinery: the whole document hydrates as one app and the closures are just... the
 *   program's closures.
 * - `conditional.nota` — `@if`, which lowers to Solid's `<Show>`. Covers the reactive branch
 *   swap (the thing `<Show>` buys over the interpolated ternary it replaced) and the two static
 *   fallback-less branches, plus an `else if` chain (nested `<Show>` fallbacks).
 * - `dynamic.nota` — the `<Dynamic>` hydration surface (prelude `Heading`, an `@(expr)` dynamic
 *   tag) + the definition tooltip's hydration path (`DefBank`'s `onMount` handlers) + a counter.
 */

import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNotaFile } from "../src/build";
import {
  BUILT_DIR,
  CLOSURE_BUILT_DIR,
  CONDITIONAL_BUILT_DIR,
  DYNAMIC_BUILT_DIR
} from "./builtHtmlPath";

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
  await buildNotaFile(join(integrationDir, "conditional.nota"), {
    resolveFrom: pkgRoot,
    outDir: CONDITIONAL_BUILT_DIR
  });
  await buildNotaFile(join(integrationDir, "dynamic.nota"), {
    resolveFrom: pkgRoot,
    outDir: DYNAMIC_BUILT_DIR
  });
}
