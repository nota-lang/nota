/**
 * **The CLI build pipeline.**
 *
 * `buildNota(source) → BuildOutput`: one `.nota` source string → one **self-contained** HTML string,
 * every asset inlined (no external requests). This is the integrator that sequences the compiler,
 * runtime, and bundler pieces:
 *
 * ```
 * doc.nota
 *   → @nota-lang/compiler        // → JS module string (runtime import prepended)
 *   → load in Node SSR + setAdapter
 *   → render(Doc)                 // → { html, manifest }
 *   → if islands:  esbuild the client bundle (boot entry + island components + adapter + runtime)
 *                  → inline as <script>; inline the manifest as JSON metadata
 *   → emit one .html               // SSG body + inline <style> + inline <script>(s)
 * ```
 *
 * ## The two snags (and how they are solved)
 *
 * 1. **Loading/SSR-ing the compiled module.** The emitted module is ESM that (a) imports
 *    `@nota-lang/runtime` and (b) references `useState` as a **free identifier** (the reader emits it
 *    ambient). The runtime `dist` further uses bundler-style **extensionless ESM imports**
 *    (`./adapter`, …) Node's native ESM can't resolve. So we **esbuild-bundle** an SSR entry (which
 *    imports `Doc` from the compiled module + `render`/`setAdapter` from the runtime + the adapter)
 *    into a Node-loadable CJS module, then load it and call `render`. esbuild's bundler resolution
 *    handles the extensionless imports; `inject` supplies the ambient prelude (snag 2). This is the
 *    same bundling approach reused for the client bundle.
 *
 * 2. **The ambient prelude.** esbuild `inject: [<prelude>]` rewrites the compiled module's free
 *    `useState` into the prelude's `useState` export (= React's). The prelude is written to the work
 *    dir at build time so it ships with nothing; see {@link PRELUDE_SOURCE}. **Contract delta:** the
 *    integrator supplies the ambient prelude; the minimal member is `useState` (React's).
 *
 * ## Properties preserved
 * - **Zero-JS for island-free docs.** No islands ⇒ empty manifest ⇒ **no `<script>`** and no client
 *   bundle: a pure static page ({@link BuildOutput.hasIslands} is `false`).
 * - **Single file, no code-splitting.** Everything inlines into one `.html`.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { compile } from "@nota-lang/compiler";
import type { Manifest } from "@nota-lang/runtime";
import { generateClientEntry } from "@nota-lang/vite";
import { build as esbuild } from "esbuild";

/**
 * This module's directory + file, resolved in a way that works **both** when shipped as the rollup
 * CJS bundle (`dist/cli.cjs`) and when loaded as ESM under vitest (`src/build.ts`). Vite's lib-CJS
 * build rewrites `import.meta.url` to `undefined`, so a bare `fileURLToPath(import.meta.url)` throws
 * there; under CJS the `__dirname`/`__filename` globals are correct instead. The `typeof` guard makes
 * `__dirname` safe to test in ESM (where it is not defined).
 */
const MODULE_DIR =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));
const MODULE_FILE =
  typeof __filename !== "undefined"
    ? __filename
    : fileURLToPath(import.meta.url);

/**
 * The ambient prelude source (snag 2) — the single source of truth for it. Written to the work dir
 * and `inject`ed into both bundles so a free `useState` in the compiled module resolves to React's.
 * Held here as a string (rather than a shipped file) so the bundled single-file CLI is self-contained
 * — it materializes the prelude on demand. The reader emits `useState` and `Tex` / `CodeInline` /
 * `CodeBlock` as **free identifiers**; the integrator supplies them, and esbuild `inject` rewrites
 * the free references to these exports. Extend with the `Tex` / `CodeInline` / `CodeBlock` slots
 * once `@nota-lang/prelude` ships (P3 of contract R14). (`Tex`, not `Math` — R14: `inject`
 * rewrites free refs, so exporting a `Math` would capture `Math.floor` in embedded JS.)
 */
export const PRELUDE_SOURCE = `export { useState, useEffect, useRef, useReducer, useMemo, useCallback } from "react";\n`;

/** Options for {@link buildNota}. */
export interface BuildOptions {
  /**
   * Source path of the `.nota` (cosmetic — names the compiler's temp file / future sourcemap, and the
   * `<title>` falls back to its basename). Need not exist on disk.
   */
  sourcePath?: string;
  /** Document `<title>` (default: the `sourcePath` basename, else `"Nota Document"`). */
  title?: string;
  /**
   * Adapter package specifier for the client bundle (default `"@nota-lang/react"`). One per build.
   */
  adapterModule?: string;
  /**
   * Package root from which esbuild resolves the **bare** specifiers in the generated entries
   * (`react`, `@nota-lang/runtime`, `@nota-lang/react`). Defaults to this package's root — the parent
   * of the `src/` (tests) or `dist/` (shipped) directory holding this module — whose `node_modules`
   * has the deps linked. Its `node_modules` is passed to esbuild as a `nodePaths` entry, added to
   * module resolution regardless of where the (temp) entry files live.
   */
  resolveFrom?: string;
  /**
   * Build the SSR + client bundles with `NODE_ENV=development` (React's non-minified build → readable
   * hydration warnings). Default `false` (production: smaller, quiet). Mainly a debugging aid.
   */
  dev?: boolean;
}

/** Result of {@link buildNota}. */
export interface BuildOutput {
  /** The complete, self-contained HTML document string. */
  html: string;
  /** The island manifest (`{}` when island-free). */
  manifest: Manifest;
  /** Whether the document has any islands (⇒ a client `<script>` was inlined). */
  hasIslands: boolean;
}

/** `{ html, manifest }` produced by the SSR step. */
interface SsrResult {
  html: string;
  manifest: Manifest;
}

// ---------------------------------------------------------------------------------------------
// static: compile → SSR → { html, manifest }
// ---------------------------------------------------------------------------------------------

/**
 * Compile the source and run it through the runtime in a Node SSR context, returning the SSG body
 * HTML + island manifest.
 *
 * Mechanism (snag 1 + 2): write the compiled module to the work dir; esbuild-bundle an SSR entry —
 * `import Doc from "<compiled>"; import { render, setAdapter } from "@nota-lang/runtime"; import
 * adapter from "<adapter>"; setAdapter(adapter); export const result = render(Doc);` — to CJS with the
 * prelude `inject`ed; load it and read `result`. `render` is synchronous, so the result is available
 * at module-load time.
 */
async function ssrRender(
  workDir: string,
  compiledPath: string,
  opts: {
    adapterModule: string;
    preludePath: string;
    nodePaths: string[];
    nodeEnv: string;
  }
): Promise<SsrResult> {
  const entryPath = join(workDir, "ssr.entry.mjs");
  // esbuild resolves filesystem paths (not `file://` URLs); the entry and compiled module are
  // siblings in `workDir`, so a `./`-relative specifier is the most robust.
  const compiledSpec = `./${relative(workDir, compiledPath)}`;
  writeFileSync(
    entryPath,
    `import Doc from ${JSON.stringify(compiledSpec)};
import { render, setAdapter } from "@nota-lang/runtime";
import adapter from ${JSON.stringify(opts.adapterModule)};
setAdapter(adapter);
export const result = render(Doc);
`
  );

  const outPath = join(workDir, "ssr.bundle.cjs");
  await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    platform: "node",
    format: "cjs",
    inject: [opts.preludePath],
    nodePaths: opts.nodePaths,
    outfile: outPath,
    logLevel: "silent",
    // React's `renderToString` reads NODE_ENV (production → clean SSR output; development → warnings).
    define: { "process.env.NODE_ENV": JSON.stringify(opts.nodeEnv) }
  });

  // Load the CJS bundle in this Node process and read the rendered result.
  const req = createRequire(MODULE_FILE);
  // Bust any require cache so repeated builds (tests) don't return a stale module.
  delete req.cache[outPath];
  const mod = req(outPath) as { result: SsrResult };
  return mod.result;
}

// ---------------------------------------------------------------------------------------------
// islands: boot entry → esbuild client bundle (single string)
// ---------------------------------------------------------------------------------------------

/**
 * Bundle the client island boot script to a single self-contained string. Uses the
 * {@link generateClientEntry} helper for the boot entry (registry + `bootIslands` + embedded
 * manifest), then esbuild-bundles it (boot + island components from the compiled module + adapter +
 * runtime + React client) for the **browser**, IIFE, minified. The prelude is `inject`ed so the
 * island bodies' free `useState` resolves on the client too.
 */
async function bundleClient(
  workDir: string,
  compiledPath: string,
  manifest: Manifest,
  opts: {
    adapterModule: string;
    preludePath: string;
    nodePaths: string[];
    nodeEnv: string;
  }
): Promise<string> {
  // esbuild resolves filesystem paths; sibling of the entry in `workDir` → `./`-relative specifier.
  const compiledSpec = `./${relative(workDir, compiledPath)}`;
  const entrySource = generateClientEntry(manifest, {
    moduleId: compiledSpec,
    adapterModule: opts.adapterModule
  });
  const entryPath = join(workDir, "client.entry.mjs");
  writeFileSync(entryPath, entrySource);

  const result = await esbuild({
    entryPoints: [entryPath],
    bundle: true,
    platform: "browser",
    format: "iife",
    inject: [opts.preludePath],
    nodePaths: opts.nodePaths,
    minify: opts.nodeEnv !== "development",
    write: false,
    logLevel: "silent",
    // The client needs React's client build at the chosen NODE_ENV (production → minified + quiet).
    define: { "process.env.NODE_ENV": JSON.stringify(opts.nodeEnv) }
  });
  return result.outputFiles[0].text;
}

// ---------------------------------------------------------------------------------------------
// HTML assembly (single self-contained file)
// ---------------------------------------------------------------------------------------------

/** HTML-escape for the `<title>` (the only place we splice arbitrary text into markup head). */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** A safe basename (no extension) from a path, for the default title. */
function baseTitle(sourcePath?: string): string {
  if (!sourcePath) {
    return "Nota Document";
  }
  const leaf = sourcePath.split(/[\\/]/).pop() ?? sourcePath;
  return leaf.replace(/\.nota$/, "") || "Nota Document";
}

/**
 * Assemble the final self-contained HTML document. The island `<script>` is inlined verbatim (an
 * esbuild IIFE bundle — no external `src`); the manifest is inlined as a
 * `<script type="application/json">` **metadata** view (the boot does not depend on it; it is
 * embedded in the bundle). For an island-free doc, **no `<script>` is emitted at all** (the zero-JS
 * property).
 */
function assembleHtml(args: {
  bodyHtml: string;
  manifest: Manifest;
  clientScript?: string;
  title: string;
}): string {
  const { bodyHtml, manifest, clientScript, title } = args;
  const head = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`
  ];

  const scripts: string[] = [];
  if (clientScript !== undefined) {
    // Manifest as inspectable JSON metadata (boot reads the copy embedded in the bundle).
    scripts.push(
      `<script type="application/json" id="nota-manifest">${JSON.stringify(
        manifest
      )}</script>`
    );
    // The island boot bundle, inlined (no external request).
    scripts.push(`<script type="module">${clientScript}</script>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
${head.map(h => `  ${h}`).join("\n")}
</head>
<body>
${bodyHtml}
${scripts.join("\n")}
</body>
</html>
`;
}

// ---------------------------------------------------------------------------------------------
// The driver
// ---------------------------------------------------------------------------------------------

/**
 * Build one `.nota` source into a single self-contained HTML document.
 *
 * @param source the `.nota` file contents
 * @param options {@link BuildOptions}
 * @returns {@link BuildOutput} — the HTML, the manifest, and whether islands were present
 */
export async function buildNota(
  source: string,
  options: BuildOptions = {}
): Promise<BuildOutput> {
  const adapterModule = options.adapterModule ?? "@nota-lang/react";
  const title = options.title ?? baseTitle(options.sourcePath);
  // `MODULE_DIR` is `<pkg>/src` (under vitest) or `<pkg>/dist` (shipped) — both one level under the
  // package root, whose `node_modules` has the deps linked.
  const resolveFrom = options.resolveFrom ?? join(MODULE_DIR, "..");
  const nodePaths = [join(resolveFrom, "node_modules")];

  // 1. compile (.nota → JS module; runtime import prepended). Throws on a reader diagnostic (the
  //    message carries stderr); the CLI surfaces it.
  const { code } = compile(source, { sourcePath: options.sourcePath });

  const workDir = mkdtempSync(join(tmpdir(), "nota-build-"));
  try {
    // The compiled module lives in the work dir; both bundles import `Doc` / island components from it.
    const compiledPath = join(workDir, "doc.compiled.mjs");
    writeFileSync(compiledPath, code);

    // The ambient prelude (snag 2), materialized for esbuild `inject`.
    const preludePath = join(workDir, "prelude.mjs");
    writeFileSync(preludePath, PRELUDE_SOURCE);

    const nodeEnv = options.dev ? "development" : "production";
    const bundleOpts = { adapterModule, preludePath, nodePaths, nodeEnv };

    // 2. SSR: render the document to HTML + manifest.
    const { html: bodyHtml, manifest } = await ssrRender(
      workDir,
      compiledPath,
      bundleOpts
    );
    const hasIslands = Object.keys(manifest).length > 0;

    // 3. islands: bundle the client boot script (only when there is an island to hydrate).
    const clientScript = hasIslands
      ? await bundleClient(workDir, compiledPath, manifest, bundleOpts)
      : undefined;

    // 4. assemble one self-contained .html.
    const html = assembleHtml({ bodyHtml, manifest, clientScript, title });
    return { html, manifest, hasIslands };
  } finally {
    try {
      rmSync(workDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup; never mask a build error */
    }
  }
}

/** Read a `.nota` file and {@link buildNota} it (convenience for the CLI entry / tests). */
export async function buildNotaFile(
  inputPath: string,
  options: Omit<BuildOptions, "sourcePath"> = {}
): Promise<BuildOutput> {
  const source = readFileSync(inputPath, "utf8");
  return buildNota(source, { ...options, sourcePath: inputPath });
}
