/**
 * Vitest **globalSetup** for the hydration e2e (runs in full Node — NOT jsdom).
 *
 * `buildNota` calls esbuild, which **cannot run under jsdom** (jsdom's `TextEncoder` violates an
 * esbuild invariant). So we build the golden's single-file HTML here, in Node, once, and write it to
 * a fixture the jsdom test then *loads* — which is exactly what the e2e wants: "headless-load the
 * emitted single FILE". The build is also the slow part (cold reader + esbuild), so doing it once in
 * setup keeps the jsdom test fast.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildNota } from "../src/build";
import { BUILT_HTML_PATH } from "./builtHtmlPath";

const here = dirname(fileURLToPath(import.meta.url));

export default async function setup(): Promise<void> {
  const pkgRoot = join(here, "..");
  const goldenSrc = readFileSync(
    join(here, "..", "..", "..", "integration", "golden.nota"),
    "utf8"
  );
  const { html } = await buildNota(goldenSrc, {
    sourcePath: "golden.nota",
    resolveFrom: pkgRoot
  });
  writeFileSync(BUILT_HTML_PATH, html, "utf8");
}
