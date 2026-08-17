/**
 * **The CLI build pipeline** (design/solid.md §SSG).
 *
 * `buildNotaFile(doc.nota) → BuildOutput`: one `.nota` file → a **document directory**
 * (`index.html` + `assets/`), produced by **two programmatic Vite builds** over one default
 * config (the `@nota-lang/vite` preset — `.nota → Solid JSX → per-target solid compile`):
 *
 * ```
 * doc.nota
 *   → vite build #1 (SSR):    a virtual wiring entry — import Doc; renderDocument(Doc)
 *                             (two passes, forward references converged) — bundled for Node,
 *                             assets emitted; the bundle is import()ed → html + state + the
 *                             Solid hydration script
 *   → unless --static: vite build #2 (client): a 3-line hydrateDocument entry → one IIFE
 *                             chunk at assets/index.js + the doc's CSS/assets
 *   → merge assets; assemble + write index.html
 *     (css <link>s; when hydrating: the Solid hydration script in <head>, the doc-state
 *     snapshot <script type="application/json">, and the client <script src>)
 * ```
 *
 * The **real `.nota` path is the module-graph entry** (Vite `root` = the doc's directory), so
 * doc-relative imports, `?url` asset imports, and CSS imports resolve exactly as in any Vite
 * app. Both builds share the same plugins/config, so the SSR HTML and the client hydration
 * agree byte-for-byte (asset URLs included — see `renderBuiltUrl`).
 *
 * **Hydration is standard Solid** — the whole document hydrates as one app, claiming the
 * build-time-reforested DOM (no islands, no manifest, no replay). `--static` skips the client
 * build entirely: a zero-JS page, fully readable, definition references degrading to anchor
 * jumps, widgets/tooltips inert.
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
import { FRAMEWORK_PACKAGES } from "@nota-lang/compiler";
import { nota } from "@nota-lang/vite";
import type { InlineConfig, Plugin as VitePlugin } from "vite";

/** This module's directory (ESM everywhere: the `dist/cli.js` bundle and vitest both load ESM). */
const MODULE_DIR = dirname(fileURLToPath(import.meta.url));

/** Virtual module ids (resolved/loaded by {@link virtualsPlugin}). */
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
   * Package root whose `node_modules` pins the **framework-owned** bare specifiers
   * (`FRAMEWORK_PACKAGES` — `@nota-lang/core`, `@nota-lang/prelude`, `solid-js`) — see
   * {@link cliResolverPlugin}. Defaults to this package's root. Everything else (the doc's own
   * imports) resolves from the doc's directory, as in any Vite app.
   */
  resolveFrom?: string;
  /**
   * Build with `NODE_ENV=development` (unminified client bundle, Solid dev warnings). Default
   * `false`. Mainly a debugging aid.
   */
  dev?: boolean;
  /**
   * Path to a **site setup module** (the `--setup` flag): imported for side effects before
   * render in the SSR entry and in the client entry — `lstset`/`mathset`/`secset`/`bibset` site
   * config, baked as the reset baseline. Absolute path, or relative to the caller's cwd.
   */
  setupModule?: string;
  /**
   * Skip the client build and every script tag: a zero-JS static page (the `--static` flag).
   * Default `false` — the document hydrates as a Solid app.
   */
  static?: boolean;
  /**
   * Output directory (`index.html` + `assets/`). Default: the input path with its extension
   * stripped (`doc.nota → doc/`). Only its `assets/` subdir is cleared between builds. For
   * {@link buildNota} (inline source) the default is an **ephemeral** temp dir deleted on
   * return — set `outDir` to keep the files.
   */
  outDir?: string;
}

/** Result of {@link buildNotaFile} / {@link buildNota}. */
export interface BuildOutput {
  /** The `index.html` document string (also written to {@link outDir}). */
  html: string;
  /** Whether a client bundle was built + scripts emitted (`false` under `static`). */
  hydrated: boolean;
  /** Absolute path of the output directory the page was written into. */
  outDir: string;
  /** Absolute path of the client bundle (`assets/index.js`), when hydrated. */
  clientJsPath?: string;
  /** `outDir`-relative paths of the CSS files linked in `<head>` (empty when the doc has none). */
  cssFiles: string[];
}

/** What the SSR bundle exports. */
interface SsrResult {
  html: string;
  stateScript: string;
  hydrationScript: string;
}

/** Everything the two builds share. */
interface PipelineContext {
  absDocPath: string;
  workDir: string;
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
 * Pin the framework-owned bare specifiers (`FRAMEWORK_PACKAGES` — `@nota-lang/core`,
 * `@nota-lang/prelude`, `solid-js`; + subpaths) to the CLI's own dependency copies, resolved
 * from {@link BuildOptions.resolveFrom}. This is what lets `nota build` work on a doc
 * **anywhere** — including inside a foreign JS project, whose own solid-js copy must not split
 * the reactive runtime or the doc-state context (one instance per page). Everything else
 * resolves from the doc's directory as usual.
 */
function cliResolverPlugin(resolveFrom: string): VitePlugin {
  // A phantom importer inside the CLI package: `this.resolve` walks node_modules up from here.
  const anchor = join(resolveFrom, "package.json");
  // Derived from the compiler's framework-package list (the same family the vite plugin dedupes)
  // — the 2026-08 core rename slipped past this regex while it was hand-written.
  const escaped = FRAMEWORK_PACKAGES.map(p =>
    p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  );
  const pinned = new RegExp(`^(?:${escaped.join("|")})(?:\\/|$)`);
  return {
    name: "nota-cli:pinned-resolver",
    enforce: "pre",
    async resolveId(id, _importer, opts) {
      if (!pinned.test(id)) return null;
      // Delegate to the FULL resolver pipeline (Vite's conditional-exports resolution — browser
      // conditions in the client build, node in the SSR build), just re-anchored at the CLI
      // package. `skipSelf` keeps the delegation out of this hook.
      return await this.resolve(id, anchor, { ...opts, skipSelf: true });
    }
  };
}

/** The SSR wiring entry. */
function ssrEntrySource(ctx: PipelineContext): string {
  const setup =
    ctx.setupModule !== undefined
      ? `import ${JSON.stringify(ctx.setupModule)};
import { bakeConfigBaseline } from "@nota-lang/prelude";
bakeConfigBaseline();
`
      : "";
  return `${setup}import Doc from ${JSON.stringify(ctx.absDocPath)};
import { docStateScript, renderDocument } from "@nota-lang/core";
import { generateHydrationScript } from "solid-js/web";
const rendered = renderDocument(Doc);
export const result = {
  html: rendered.html,
  stateScript: docStateScript(rendered.state),
  hydrationScript: generateHydrationScript()
};
`;
}

/** The client wiring entry: seed from the page snapshot, hydrate the document. */
function clientEntrySource(ctx: PipelineContext): string {
  const setup =
    ctx.setupModule !== undefined
      ? `import ${JSON.stringify(ctx.setupModule)};
import { bakeConfigBaseline } from "@nota-lang/prelude";
bakeConfigBaseline();
`
      : "";
  return `${setup}import Doc from ${JSON.stringify(ctx.absDocPath)};
import { hydrateDocument } from "@nota-lang/core";
hydrateDocument(Doc);
`;
}

/**
 * The shared default config. Hermetic on purpose: no `vite.config` / `.env` / `public/`
 * discovery from the doc's directory — a doc inside a foreign Vite project must not inherit
 * that project's build policy.
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
      // Bake asset URLs into JS as literal page-relative strings in BOTH builds: the SSR HTML
      // and the client hydration must agree byte-for-byte on every URL.
      renderBuiltUrl: (filename, { hostType }) =>
        hostType === "js" ? `./${filename}` : undefined
    },
    define: { "process.env.NODE_ENV": JSON.stringify(ctx.nodeEnv) },
    plugins: [
      nota(),
      virtualsPlugin({
        [SSR_ENTRY_ID]: ssrEntrySource(ctx),
        [CLIENT_ENTRY_ID]: clientEntrySource(ctx)
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
 * Rolldown wraps a plugin error (the reader's compile diagnostic) in its own build error; keep
 * the reader's message reachable by preferring a cause that carries it. Walks the `.cause` chain
 * for the first error exposing `@nota-lang/compiler`'s programmatic `.diagnostics` (set by
 * `toCompileError` — every diagnostic `compile()` throws carries one); falls back to the old
 * `/failed to compile/i` message-text sniff for a wrapped error whose cause predates
 * `.diagnostics` (a stale compiler dist), and to the original error if neither matches.
 */
function rethrowBuildError(err: unknown): never {
  let textFallback: Error | undefined;
  for (
    let cause: unknown = err;
    cause instanceof Error;
    cause = (cause as { cause?: unknown }).cause
  ) {
    if (typeof (cause as { diagnostics?: unknown }).diagnostics === "string") {
      throw cause;
    }
    if (
      textFallback === undefined &&
      /failed to compile/i.test(cause.message)
    ) {
      textFallback = cause;
    }
  }
  throw textFallback ?? err;
}

/**
 * Build #1 (SSR): bundle the SSR wiring entry for Node (workspace deps bundled in —
 * `ssr.noExternal` — the dists use bundler-style extensionless ESM imports Node can't resolve),
 * emitting the doc's CSS/assets, then `import()` the bundle and read the rendered result.
 * `renderDocument` is synchronous, so the result is available at module-load time.
 */
async function ssrRender(
  ctx: PipelineContext
): Promise<{ result: SsrResult } & EmittedFiles> {
  const { build } = await import("vite");
  const ssrOutDir = join(ctx.workDir, "ssr");
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
        // Never data-URI-inline assets: both builds must make the SAME decision for every asset
        // URL (a divergence would break hydration byte-parity).
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
 * Build #2 (client, unless static): bundle the hydration entry for the browser straight into
 * the final out dir — one **IIFE** chunk at `assets/index.js` (a classic `<script src>`:
 * eval-able in the hydration e2e, and not subject to `file://` module-CORS), plus the doc's
 * CSS/assets.
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
            // IIFE implies no code-splitting, so dynamic imports inline — one chunk.
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
 * Copy emitted **asset files** (never chunks) from the SSR build into the final out dir, so
 * every `./assets/…` URL baked into the SSR HTML exists on disk. Copied **stylesheets are
 * repaired to css-relative URLs**: the SSR build resolves css-hosted asset references (a
 * stylesheet's fonts — the KaTeX shape) to root-absolute `/assets/…` regardless of the relative
 * base; every emitted asset lives under the same `assets/` dir as the stylesheet itself, so
 * `/assets/x` → `x` is exact under this pipeline's naming scheme.
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
 * Assemble the `index.html` document. The body is the SSR HTML inside `<div id="nota-root">`;
 * when hydrating, the Solid hydration script rides in `<head>`, the doc-state snapshot script
 * and the client IIFE `<script src>` after the root. A static page emits **no script at all**.
 */
function assembleHtml(args: {
  bodyHtml: string;
  title: string;
  cssHrefs: string[];
  hydration?: {
    stateScript: string;
    hydrationScript: string;
    scriptSrc: string;
  };
}): string {
  const { bodyHtml, title, cssHrefs, hydration } = args;
  const head = [
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${escapeHtml(title)}</title>`,
    ...cssHrefs.map(
      href => `<link rel="stylesheet" href="${escapeHtml(href)}" />`
    ),
    ...(hydration ? [hydration.hydrationScript] : [])
  ];

  const scripts = hydration
    ? [
        hydration.stateScript,
        `<script src="${escapeHtml(hydration.scriptSrc)}"></script>`
      ]
    : [];

  return `<!doctype html>
<html lang="en">
<head>
${head.map(h => `  ${h}`).join("\n")}
</head>
<body>
<div id="nota-root">${bodyHtml}</div>
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
  const hydrated = options.static !== true;
  const ctx: PipelineContext = {
    absDocPath,
    workDir: mkdtempSync(join(tmpdir(), "nota-build-")),
    // `MODULE_DIR` is `<pkg>/src` (under vitest) or `<pkg>/dist` (shipped) — both one level
    // under the package root, whose `node_modules` has the pinned deps linked.
    resolveFrom: options.resolveFrom ?? join(MODULE_DIR, ".."),
    nodeEnv,
    setupModule:
      options.setupModule !== undefined
        ? resolve(options.setupModule)
        : undefined
  };

  // Pin NODE_ENV to this pipeline's own mode for the duration of the builds. Vite derives
  // "is production" from process.env.NODE_ENV and only fills it from `mode` when UNSET — so an
  // ambient NODE_ENV (a test runner's "test", a CI stage's "development") would flip solid-js's
  // `development` export condition and silently bundle Solid's dev build into shipped output.
  // The CLI's own --dev flag is the one source of truth.
  const prevNodeEnv = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    // 1. SSR build + render.
    const ssr = await ssrRender(ctx);
    const { html: bodyHtml, stateScript, hydrationScript } = ssr.result;

    // Prepare the out dir: only `assets/` is ours to clear — never blanket-empty a directory
    // the user may own (`doc.nota → doc/` can pre-exist).
    mkdirSync(outDir, { recursive: true });
    rmSync(join(outDir, "assets"), { recursive: true, force: true });

    // 2. the client build (skipped under --static — zero-JS).
    let cssFiles: string[];
    let clientJsRel: string | undefined;
    if (hydrated) {
      const client = await buildClient(ctx, outDir);
      clientJsRel = client.entryChunk ?? "assets/index.js";
      if (client.cssFiles.length > 0) {
        // The client build owns CSS emission (skip the SSR copies — same content,
        // maybe-different hashes would orphan); non-CSS assets are copied so SSR-baked
        // URLs exist even if hashes ever diverged across builds.
        cssFiles = client.cssFiles;
        copySsrAssets(join(ctx.workDir, "ssr"), ssr.assetFiles, outDir);
      } else {
        // The IIFE client build emits no CSS assets under rolldown-vite (observed 8.1:
        // CSS in the graph is neither emitted nor JS-injected), so the SSR build's
        // emission is authoritative — copy + link it exactly like the static path.
        cssFiles = ssr.cssFiles;
        copySsrAssets(
          join(ctx.workDir, "ssr"),
          [...ssr.assetFiles, ...ssr.cssFiles],
          outDir
        );
      }
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
      title,
      cssHrefs: cssFiles.map(f => `./${f}`),
      hydration:
        hydrated && clientJsRel !== undefined
          ? {
              stateScript,
              hydrationScript,
              scriptSrc: `./${clientJsRel}`
            }
          : undefined
    });
    writeFileSync(join(outDir, "index.html"), html, "utf8");

    return {
      html,
      hydrated,
      outDir,
      clientJsPath:
        clientJsRel !== undefined ? join(outDir, clientJsRel) : undefined,
      cssFiles
    };
  } finally {
    if (prevNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = prevNodeEnv;
    }
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
 * module-graph root, **doc-relative imports are meaningless here** — use {@link buildNotaFile}
 * for documents with local imports. Unless `options.outDir` is set, the output directory is
 * ephemeral (deleted on return).
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
