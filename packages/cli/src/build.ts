/**
 * **The CLI build pipeline.**
 *
 * `buildNotaFile(doc.nota) → BuildOutput`: one `.nota` file → a **document directory**
 * (`index.html` + `assets/`), produced by **two programmatic Vite builds** over one default config:
 *
 * ```
 * doc.nota
 *   → vite build #1 (SSR):    a virtual wiring entry — import Doc from <doc.nota>;
 *                             setAdapter(adapter); export const result = render(Doc)
 *                             — bundled for Node (ssr.noExternal), assets emitted
 *                             (ssrEmitAssets); the bundle is import()ed → { html, manifest }
 *   → if islands:  vite build #2 (client): the replay entry (hydrateDocument(Doc),
 *                             generateClientEntry) → one IIFE chunk at assets/index.js
 *                             + the doc's CSS/assets, written into the out dir
 *   → merge the SSR build's emitted assets; assemble + write index.html
 *     (css <link>s; <script src> + manifest debug JSON only when islands)
 * ```
 *
 * The **real `.nota` path is the module-graph entry** (Vite `root` = the doc's directory), so
 * doc-relative imports, `?url` asset imports, and CSS imports resolve exactly as in any Vite app —
 * that is the point of this pipeline. The `@nota-lang/vite` transform plugin compiles `.nota`
 * inside the graph; both builds share the same plugins/config so the SSR-rendered HTML and the
 * client replay agree byte-for-byte (asset URLs included — see `renderBuiltUrl` below).
 *
 * **Client hydration is replay-driven (design/decode.md §Replay hydration).** The client bundle
 * imports `Doc` and calls `hydrateDocument(Doc)`: the runtime re-executes the document in capture
 * mode — recovering each island's live component (closures over document state intact), live props
 * (functions legal), and recomputed slot — and hydrates each `[data-hydration-id]` marker. No
 * per-island data crosses the wire; the manifest is inlined only as debug metadata and gates
 * `hasIslands`.
 *
 * ## The ambient prelude
 *
 * The reader emits `useState` and the whole prelude surface as **free identifiers** ("the prelude
 * should be a prelude") and reports them as free-name metadata; the compiler shim binds them by
 * prepending one import from the plugin's `preludeModule`. The CLI points that at
 * {@link AMBIENT_ID}, a virtual module re-exporting
 * React's hooks + the `@nota-lang/prelude` surface ({@link AMBIENT_SOURCE}), and passes the hook
 * names via the plugin's `extraAmbientNames` (they are not part of the built-in prelude lists —
 * which framework supplies hooks is integrator policy).
 *
 * ## Properties preserved
 * - **Zero-JS for island-free docs.** No islands ⇒ empty manifest ⇒ **no `<script>`** and no client
 *   build: a pure static page ({@link BuildOutput.hasIslands} is `false`).
 * - **Relocatable output.** `base: "./"` + page-relative asset URLs: the out dir can be served from
 *   any path (and mostly works over `file://` — the island script is a classic IIFE, not a module).
 */

import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { Manifest } from "@nota-lang/runtime";
import { generateClientEntry, nota } from "@nota-lang/vite";
import type { InlineConfig, Plugin as VitePlugin } from "vite";

/**
 * This module's directory, resolved in a way that works **both** when shipped as the rollup
 * CJS bundle (`dist/cli.cjs`) and when loaded as ESM under vitest (`src/build.ts`). Vite's lib-CJS
 * build rewrites `import.meta.url` to `undefined`, so a bare `fileURLToPath(import.meta.url)` throws
 * there; under CJS the `__dirname` global is correct instead. The `typeof` guard makes
 * `__dirname` safe to test in ESM (where it is not defined).
 */
const MODULE_DIR =
  typeof __dirname !== "undefined"
    ? __dirname
    : dirname(fileURLToPath(import.meta.url));

/**
 * The ambient prelude source — the single source of truth for it, served as the virtual module
 * {@link AMBIENT_ID} in both builds. The reader emits `useState` and the whole prelude surface as
 * **free identifiers**: the slots `Tex` / `CodeInline` / `CodeBlock` / `Heading` (from `#` sugar) /
 * `Toc` / `Label` / `Ref` / `Footnote` / `FootnoteMark` / `FootnoteText` / `Footnotes` /
 * `FootnotesList` / `Cite` / `Bibliography` (the last family from `<x>` / `&x` / `[^x]` / `[^x]:`
 * doc-state sugar) and the config fns `lstset` / `mathset` / `secset` / `bibset`; the integrator
 * supplies them, and the transform plugin prepends an import of the referenced ones from here.
 * (`Tex`, not `Math` — the injection binds free refs, so exporting a `Math` would capture
 * `Math.floor` in embedded JS.)
 */
export const AMBIENT_SOURCE = `export { useState, useEffect, useRef, useReducer, useMemo, useCallback } from "react";
export { Tex, CodeInline, CodeBlock, Heading, Title, Toc, Label, Ref, Definition, Footnote, FootnoteMark, FootnoteText, Footnotes, FootnotesList, Cite, Bibliography, lstset, mathset, secset, bibset, texRef, registerComponents } from "@nota-lang/prelude";
`;

/**
 * The names beyond the compiler's built-in `AMBIENT_PRELUDE_NAMES` that {@link AMBIENT_ID} also
 * supplies — React's hooks + `registerComponents` — passed as the plugin's `extraAmbientNames`
 * (injected iff the emit references them free). Which framework supplies hooks is integrator
 * policy, so neither the plugin nor the compiler hardcodes these.
 */
const AMBIENT_CALL_NAMES = [
  "useState",
  "useEffect",
  "useRef",
  "useReducer",
  "useMemo",
  "useCallback",
  "registerComponents"
];

/** Virtual module ids (resolved/loaded by {@link virtualsPlugin}). */
const AMBIENT_ID = "virtual:nota-ambient-prelude";
const SSR_ENTRY_ID = "virtual:nota-ssr-entry";
const CLIENT_ENTRY_ID = "virtual:nota-client-entry";

/** Options for {@link buildNotaFile} / {@link buildNota}. */
export interface BuildOptions {
  /**
   * Source path of the `.nota` — only meaningful for {@link buildNota} (inline source), where it
   * names the materialized temp file (compiler diagnostics + default `<title>`). Need not exist.
   */
  sourcePath?: string;
  /** Document `<title>` (default: the input basename, else `"Nota Document"`). */
  title?: string;
  /**
   * Adapter package specifier for both builds (default `"@nota-lang/react"`). One per build.
   */
  adapterModule?: string;
  /**
   * Package root whose `node_modules` pins the **framework-owned** bare specifiers (`react`,
   * `react-dom`, `@nota-lang/{runtime,react,prelude}`) — see {@link cliResolverPlugin}. Defaults to
   * this package's root — the parent of the `src/` (tests) or `dist/` (shipped) directory holding
   * this module. Everything else (the doc's own imports) resolves from the doc's directory, as in
   * any Vite app.
   */
  resolveFrom?: string;
  /**
   * Build with `NODE_ENV=development` (React's non-minified build → readable hydration warnings;
   * client bundle unminified). Default `false` (production: smaller, quiet). Mainly a debugging aid.
   */
  dev?: boolean;
  /**
   * Path to a **site setup module** (the `--setup` flag; registry overrides + doc-global config —
   * design/decode.md §The registry & config), imported for side effects before render in the SSR
   * entry (and in the client entry when islands exist): `registerComponents({…})` overrides +
   * `lstset`/`mathset` site config (baked as the per-render baseline). Absolute path, or relative
   * to the caller's cwd.
   */
  setupModule?: string;
  /**
   * Output directory (`index.html` + `assets/`). Default: the input path with its extension
   * stripped (`doc.nota → doc/`). The directory is created if missing; only its `assets/` subdir
   * is cleared between builds (never the whole directory). For {@link buildNota} (inline source)
   * the default is an **ephemeral** temp dir deleted on return — set `outDir` to keep the files.
   */
  outDir?: string;
}

/** Result of {@link buildNotaFile} / {@link buildNota}. */
export interface BuildOutput {
  /** The `index.html` document string (also written to {@link outDir}). */
  html: string;
  /** The island manifest (`{}` when island-free). */
  manifest: Manifest;
  /** Whether the document has any islands (⇒ a client bundle was built + `<script>` emitted). */
  hasIslands: boolean;
  /** Absolute path of the output directory the page was written into. */
  outDir: string;
  /** Absolute path of the client island bundle (`assets/index.js`), when islands exist. */
  clientJsPath?: string;
  /** `outDir`-relative paths of the CSS files linked in `<head>` (empty when the doc has none). */
  cssFiles: string[];
}

/** `{ html, manifest }` produced by the SSR step. */
interface SsrResult {
  html: string;
  manifest: Manifest;
}

/** Everything the two builds share. */
interface PipelineContext {
  absDocPath: string;
  workDir: string;
  adapterModule: string;
  resolveFrom: string;
  nodeEnv: string;
  setupModule?: string;
}

// ---------------------------------------------------------------------------------------------
// The default Vite config (shared by both builds)
// ---------------------------------------------------------------------------------------------

/** Serve string sources as virtual modules (`resolveId` → `\0`-prefixed, `load` → the source). */
function virtualsPlugin(map: Record<string, string>): VitePlugin {
  return {
    name: "nota-cli:virtuals",
    resolveId(id: string) {
      return id in map ? `\0${id}` : null;
    },
    load(id: string) {
      if (!id.startsWith("\0")) return null;
      return map[id.slice(1)] ?? null;
    }
  };
}

/**
 * Pin the framework-owned bare specifiers to the CLI's own dependency copies: `react`, `react-dom`,
 * and `@nota-lang/{runtime,react,prelude}` (+ subpaths) resolve via `require.resolve` from
 * {@link BuildOptions.resolveFrom}. This is what lets `nota build` work on a doc **anywhere** —
 * including inside a foreign JS project, whose own React copy must not split the island tree's
 * (one React per page). Everything else resolves from the doc's directory as usual.
 */
function cliResolverPlugin(resolveFrom: string): VitePlugin {
  // A phantom importer inside the CLI package: `this.resolve` walks node_modules up from here.
  const anchor = join(resolveFrom, "package.json");
  const pinned =
    /^(?:react|react-dom|@nota-lang\/(?:runtime|react|prelude))(?:\/|$)/;
  return {
    name: "nota-cli:pinned-resolver",
    enforce: "pre",
    async resolveId(id, _importer, opts) {
      if (!pinned.test(id)) return null;
      // Delegate to the FULL resolver pipeline (Vite's conditional-exports resolution — browser
      // conditions in the client build, node in the SSR build; a `createRequire().resolve` here
      // would force node editions like react-dom/server.node.js into the browser bundle), just
      // re-anchored at the CLI package. `skipSelf` keeps the delegation out of this hook.
      return await this.resolve(id, anchor, { ...opts, skipSelf: true });
    }
  };
}

/** The SSR wiring entry (mirrored by the client entry from {@link generateClientEntry}). */
function ssrEntrySource(ctx: PipelineContext): string {
  // The setup module runs for its side effects before render — it must mutate the *bundle's*
  // runtime/prelude instances (registry + lstset config); the config it set is then baked as the
  // per-render reset baseline.
  const setupImports =
    ctx.setupModule !== undefined
      ? `import ${JSON.stringify(ctx.setupModule)};
import { bakeConfigBaseline } from "@nota-lang/prelude";
`
      : "";
  const setupBake =
    ctx.setupModule !== undefined ? "bakeConfigBaseline();\n" : "";
  return `${setupImports}import Doc from ${JSON.stringify(ctx.absDocPath)};
import { render, setAdapter } from "@nota-lang/runtime";
import adapter from ${JSON.stringify(ctx.adapterModule)};
setAdapter(adapter);
${setupBake}export const result = render(Doc);
`;
}

/**
 * The shared default config. Hermetic on purpose: no `vite.config` / `.env` / `public/` discovery
 * from the doc's directory — a doc inside a foreign Vite project must not inherit that project's
 * build policy. (PostCSS config discovery is Vite-internal and deliberately left on — it is how a
 * doc project customizes its CSS.)
 */
function sharedConfig(ctx: PipelineContext): InlineConfig {
  return {
    configFile: false,
    envFile: false,
    logLevel: "silent",
    // Doc-relative imports resolve against the REAL doc dir — the point of this pipeline.
    root: dirname(ctx.absDocPath),
    mode: ctx.nodeEnv,
    publicDir: false,
    base: "./",
    experimental: {
      // Bake asset URLs into JS as literal page-relative strings (`./assets/x-H.ext`) in BOTH
      // builds: (a) the SSR bundle must not embed `import.meta.url`-relative (file:///tmp/…) URLs
      // into the rendered HTML, and (b) the client replay must recompute byte-identical URLs for
      // hydration. `index.html` sits at the out-dir root, so page-relative is correct; CSS-hosted
      // URLs keep Vite's handling — but see `copySsrAssets`, which repairs the SSR build's
      // root-absolute css URLs at copy time (rolldown-vite emits `/assets/…` there regardless of
      // the relative base, and ignores a `{ relative: true }` answer from this hook).
      renderBuiltUrl: (filename, { hostType }) =>
        hostType === "js" ? `./${filename}` : undefined
    },
    // React's render paths read NODE_ENV (production → clean SSR output + minified client).
    define: { "process.env.NODE_ENV": JSON.stringify(ctx.nodeEnv) },
    plugins: [
      nota({
        preludeModule: AMBIENT_ID,
        extraAmbientNames: AMBIENT_CALL_NAMES
      }),
      virtualsPlugin({
        [AMBIENT_ID]: AMBIENT_SOURCE,
        [SSR_ENTRY_ID]: ssrEntrySource(ctx),
        [CLIENT_ENTRY_ID]: generateClientEntry({
          moduleId: ctx.absDocPath,
          adapterModule: ctx.adapterModule,
          // Re-run the site setup on the client (registerComponents/lstset) + bake the baseline,
          // so the replay's reset() restores the same config and slot bytes match the server's.
          setupModule: ctx.setupModule
        })
      }),
      cliResolverPlugin(ctx.resolveFrom)
    ]
  };
}

// ---------------------------------------------------------------------------------------------
// The two builds
// ---------------------------------------------------------------------------------------------

/** The chunk/asset file names of one build, out-dir-relative. */
interface EmittedFiles {
  cssFiles: string[];
  assetFiles: string[];
  entryChunk?: string;
}

/** Pick the css/asset/entry file names out of a `vite build` result. */
function emittedOf(result: unknown): EmittedFiles {
  const first = Array.isArray(result) ? result[0] : result;
  const output =
    (
      first as {
        output?: Array<{ type: string; fileName: string; isEntry?: boolean }>;
      }
    )?.output ?? [];
  const files: EmittedFiles = { cssFiles: [], assetFiles: [] };
  for (const o of output) {
    if (o.type === "asset") {
      (o.fileName.endsWith(".css") ? files.cssFiles : files.assetFiles).push(
        o.fileName
      );
    } else if (o.type === "chunk" && o.isEntry) {
      files.entryChunk = o.fileName;
    }
  }
  return files;
}

/**
 * Rolldown wraps a plugin error (the reader's compile diagnostic) in its own build error; keep the
 * reader's message reachable (the CLI's `/failed to compile/` surface) by preferring a cause that
 * carries it.
 */
function rethrowBuildError(err: unknown): never {
  if (err instanceof Error && !/failed to compile/i.test(err.message)) {
    for (
      let cause = (err as { cause?: unknown }).cause;
      cause instanceof Error;
      cause = (cause as { cause?: unknown }).cause
    ) {
      if (/failed to compile/i.test(cause.message)) throw cause;
    }
  }
  throw err;
}

/**
 * Build #1 (SSR): bundle the SSR wiring entry for Node (workspace deps bundled in —
 * `ssr.noExternal` — because the runtime `dist` uses bundler-style extensionless ESM imports Node
 * can't resolve), emitting the doc's CSS/assets (`ssrEmitAssets`), then `import()` the bundle and
 * read the rendered `{ html, manifest }`. `render` is synchronous, so the result is available at
 * module-load time. A fresh work dir per build keeps the ESM cache honest.
 */
async function ssrRender(
  ctx: PipelineContext
): Promise<{ result: SsrResult } & EmittedFiles> {
  const { build } = await import("vite");
  const ssrOutDir = join(ctx.workDir, "ssr");
  // The input's key is the chunk name, which names chunk-derived assets: a static doc's CSS lands
  // as assets/<docStem>-<hash>.css rather than leaking the internal entry name.
  const docStem =
    basename(ctx.absDocPath)
      .replace(/\.[^.]+$/, "")
      .replace(/[^\w-]/g, "_") || "doc";
  let res: unknown;
  try {
    res = await build({
      ...sharedConfig(ctx),
      build: {
        ssr: true,
        outDir: ssrOutDir,
        emptyOutDir: false,
        ssrEmitAssets: true,
        // Never data-URI-inline assets: the SSR and client builds must make the SAME decision for
        // every asset URL (a divergence would break hydration byte-parity), and "?url emits a
        // file" is the CLI's documented behavior. Same setting in both builds.
        assetsInlineLimit: 0,
        minify: false,
        rollupOptions: {
          input: { [docStem]: SSR_ENTRY_ID },
          output: {
            format: "es",
            entryFileNames: "ssr-entry.mjs",
            assetFileNames: "assets/[name]-[hash][extname]"
          }
        }
      },
      ssr: { noExternal: true }
    });
  } catch (err) {
    rethrowBuildError(err);
  }
  const mod = (await import(
    pathToFileURL(join(ssrOutDir, "ssr-entry.mjs")).href
  )) as { result: SsrResult };
  return { result: mod.result, ...emittedOf(res) };
}

/**
 * Build #2 (client, islands only): bundle the replay entry for the browser straight into the final
 * out dir — one **IIFE** chunk at `assets/index.js` (a classic `<script src>`: eval-able in the
 * hydration e2e, and not subject to `file://` module-CORS), plus the doc's CSS/assets.
 */
async function buildClient(
  ctx: PipelineContext,
  outDir: string
): Promise<EmittedFiles> {
  const { build } = await import("vite");
  let res: unknown;
  try {
    res = await build({
      ...sharedConfig(ctx),
      build: {
        outDir,
        emptyOutDir: false,
        assetsDir: "assets",
        modulePreload: false,
        assetsInlineLimit: 0, // mirror the SSR build — see ssrRender
        minify: ctx.nodeEnv !== "development",
        rollupOptions: {
          input: { index: CLIENT_ENTRY_ID },
          output: {
            // IIFE implies no code-splitting (rolldown: codeSplitting=false), so dynamic imports
            // inline automatically — one self-contained chunk.
            format: "iife",
            entryFileNames: "assets/[name].js",
            assetFileNames: "assets/[name]-[hash][extname]"
          }
        }
      }
    });
  } catch (err) {
    rethrowBuildError(err);
  }
  return emittedOf(res);
}

/**
 * Copy emitted **asset files** (never chunks) from the SSR build into the final out dir, so every
 * `./assets/…` URL baked into the SSR HTML exists on disk. Asset names are content-hashed with the
 * same pattern in both builds, so an islands doc's client build writing the same assets is a
 * harmless overwrite.
 *
 * Copied **stylesheets are repaired to css-relative URLs**: the SSR build resolves css-hosted
 * asset references (a stylesheet's fonts — the KaTeX shape) to root-absolute `/assets/…`
 * regardless of the relative base, which breaks any non-root deploy. Every emitted asset lives
 * under the same `assets/` dir as the stylesheet itself, so `/assets/x` → `x` (css-relative
 * sibling) is exact under this pipeline's own naming scheme.
 */
function copySsrAssets(
  ssrOutDir: string,
  files: string[],
  outDir: string
): void {
  for (const rel of files) {
    const dest = join(outDir, rel);
    mkdirSync(dirname(dest), { recursive: true });
    if (rel.endsWith(".css")) {
      const css = readFileSync(join(ssrOutDir, rel), "utf8");
      writeFileSync(
        dest,
        css.replace(/url\((['"]?)\/assets\//g, "url($1"),
        "utf8"
      );
    } else {
      copyFileSync(join(ssrOutDir, rel), dest);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// HTML assembly
// ---------------------------------------------------------------------------------------------

/** HTML-escape for `<title>`/attribute splices. */
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
 * Assemble the `index.html` document. The island `<script>` is a classic `src` reference to the
 * IIFE bundle; the manifest is inlined as a `<script type="application/json">` **debug metadata**
 * view (hydration never reads it — the client replays `Doc` to recover per-island data). For an
 * island-free doc, **no `<script>` is emitted at all** (the zero-JS property).
 */
function assembleHtml(args: {
  bodyHtml: string;
  manifest: Manifest;
  title: string;
  cssHrefs: string[];
  scriptSrc?: string;
}): string {
  const { bodyHtml, manifest, title, cssHrefs, scriptSrc } = args;
  const head = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    ...cssHrefs.map(
      href => `<link rel="stylesheet" href="${escapeHtml(href)}" />`
    )
  ];

  const scripts: string[] = [];
  if (scriptSrc !== undefined) {
    // Manifest as inspectable JSON debug metadata (hydration never reads it — the replay does).
    scripts.push(
      `<script type="application/json" id="nota-manifest">${JSON.stringify(
        manifest
      )}</script>`
    );
    // The replay hydration bundle (IIFE — a classic script, after the DOM it hydrates).
    scripts.push(`<script src="${escapeHtml(scriptSrc)}"></script>`);
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

/** Default out dir: the input with its extension stripped (`doc.nota → doc/`). */
function defaultOutDir(absDocPath: string): string {
  const stripped = absDocPath.replace(/\.[^./\\]+$/, "");
  return stripped === absDocPath ? `${absDocPath}.out` : stripped;
}

/**
 * Build one `.nota` **file** into a document directory (`index.html` + `assets/`), written to
 * {@link BuildOptions.outDir} (default: the input with its extension stripped).
 *
 * @param inputPath path to the `.nota` file — the Vite module-graph entry, so its directory is
 *   what doc-relative imports resolve against
 * @param options {@link BuildOptions}
 * @returns {@link BuildOutput} — the HTML string, manifest, islands flag, and output paths
 */
export async function buildNotaFile(
  inputPath: string,
  options: Omit<BuildOptions, "sourcePath"> = {}
): Promise<BuildOutput> {
  const absDocPath = resolve(inputPath);
  if (!existsSync(absDocPath)) {
    throw new Error(`input file not found: ${inputPath}`);
  }
  const outDir = resolve(options.outDir ?? defaultOutDir(absDocPath));
  const title = options.title ?? baseTitle(absDocPath);
  const nodeEnv = options.dev ? "development" : "production";
  const ctx: PipelineContext = {
    absDocPath,
    workDir: mkdtempSync(join(tmpdir(), "nota-build-")),
    adapterModule: options.adapterModule ?? "@nota-lang/react",
    // `MODULE_DIR` is `<pkg>/src` (under vitest) or `<pkg>/dist` (shipped) — both one level under
    // the package root, whose `node_modules` has the pinned deps linked.
    resolveFrom: options.resolveFrom ?? join(MODULE_DIR, ".."),
    nodeEnv,
    setupModule:
      options.setupModule !== undefined
        ? resolve(options.setupModule)
        : undefined
  };

  try {
    // 1. SSR build + render.
    const ssr = await ssrRender(ctx);
    const { html: bodyHtml, manifest } = ssr.result;
    const hasIslands = Object.keys(manifest).length > 0;

    // Prepare the out dir: only `assets/` is ours to clear — never blanket-empty a directory the
    // user may own (`doc.nota → doc/` can pre-exist).
    mkdirSync(outDir, { recursive: true });
    rmSync(join(outDir, "assets"), { recursive: true, force: true });

    // 2. islands: client build straight into the out dir (island-free docs skip it — zero-JS).
    let cssFiles: string[];
    let clientJsRel: string | undefined;
    if (hasIslands) {
      const client = await buildClient(ctx, outDir);
      cssFiles = client.cssFiles;
      clientJsRel = client.entryChunk ?? "assets/index.js";
      // The client build owns CSS emission (skip the SSR copies — same content, maybe-different
      // hashes would orphan); non-CSS assets are copied so SSR-baked URLs exist even if hashes
      // ever diverged across builds.
      copySsrAssets(join(ctx.workDir, "ssr"), ssr.assetFiles, outDir);
    } else {
      copySsrAssets(
        join(ctx.workDir, "ssr"),
        [...ssr.assetFiles, ...ssr.cssFiles],
        outDir
      );
      cssFiles = ssr.cssFiles;
    }

    // 3. assemble + write index.html.
    const html = assembleHtml({
      bodyHtml,
      manifest,
      title,
      cssHrefs: cssFiles.map(f => `./${f}`),
      scriptSrc: clientJsRel !== undefined ? `./${clientJsRel}` : undefined
    });
    writeFileSync(join(outDir, "index.html"), html, "utf8");

    return {
      html,
      manifest,
      hasIslands,
      outDir,
      clientJsPath:
        clientJsRel !== undefined ? join(outDir, clientJsRel) : undefined,
      cssFiles
    };
  } finally {
    try {
      rmSync(ctx.workDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup; never mask a build error */
    }
  }
}

/**
 * Build a `.nota` **source string** (convenience for tests / inline docs): the source is
 * materialized in a temp dir and run through {@link buildNotaFile}. Because the temp dir is the
 * module-graph root, **doc-relative imports are meaningless here** — use {@link buildNotaFile} for
 * documents with local imports. Unless `options.outDir` is set, the output directory is ephemeral
 * (deleted on return): the returned `html`/`manifest` remain valid, the file paths do not.
 */
export async function buildNota(
  source: string,
  options: BuildOptions = {}
): Promise<BuildOutput> {
  const srcDir = mkdtempSync(join(tmpdir(), "nota-src-"));
  try {
    const docName = basename(options.sourcePath ?? "doc.nota");
    const docPath = join(srcDir, docName);
    writeFileSync(docPath, source, "utf8");
    return await buildNotaFile(docPath, {
      ...options,
      // Preserve the historical default title for pathless inline sources.
      title: options.title ?? baseTitle(options.sourcePath),
      outDir: options.outDir ?? join(srcDir, "out")
    });
  } finally {
    try {
      rmSync(srcDir, { recursive: true, force: true });
    } catch {
      /* best-effort cleanup */
    }
  }
}
