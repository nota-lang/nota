/**
 * Vitest **globalSetup** for the hydration e2e (runs in full Node — NOT jsdom).
 *
 * `buildNota` calls esbuild, which **cannot run under jsdom** (jsdom's `TextEncoder` violates an
 * esbuild invariant). So we build the fixtures' single-file HTML here, in Node, once, and write them
 * to files the jsdom tests then *load* — which is exactly what the e2e wants: "headless-load the
 * emitted single FILE". The build is also the slow part (cold reader + esbuild), so doing it once in
 * setup keeps the jsdom tests fast.
 *
 * Two fixtures:
 * - `golden.nota` — the canonical `Colorized` document (module-scope island).
 * - `closure.nota` — the replay-hydration headline: a **document-local** island defined inside `@for`, closing
 *   over the loop variable. Only replay hydration (`hydrateDocument`) can hydrate it.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNota } from "../src/build";
import { BUILT_HTML_PATH, CLOSURE_BUILT_HTML_PATH } from "./builtHtmlPath";

const here = dirname(fileURLToPath(import.meta.url));

export default async function setup(): Promise<void> {
  const pkgRoot = join(here, "..");
  const integrationDir = join(here, "..", "..", "..", "integration");
  const build = async (name: string, outPath: string) => {
    const src = readFileSync(join(integrationDir, name), "utf8");
    const { html } = await buildNota(src, {
      sourcePath: name,
      resolveFrom: pkgRoot
    });
    writeFileSync(outPath, html, "utf8");
  };
  await build("golden.nota", BUILT_HTML_PATH);
  await build("closure.nota", CLOSURE_BUILT_HTML_PATH);
}
