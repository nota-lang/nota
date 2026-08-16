/**
 * The **browser worker** entry of the Nota Volar language server.
 *
 * Runs the same server core as the node flavor, but inside a Web Worker speaking LSP over
 * `postMessage` (`@volar/language-server/browser` = `BrowserMessageReader/Writer(self)`), so any
 * postMessage LSP client — the playground's CodeMirror via `@codemirror/lsp-client` — can drive it.
 *
 * **Filesystem story.** Volar's browser `createTypeScriptProject` is the same implementation as
 * node's (path-browserify): it builds a `ts.System` via `@volar/typescript`'s `createSys`, which
 * routes **all reads through `server.fileSystem`** (the base `ts.sys` is `undefined` in a browser
 * `typescript` build and is only consulted for trivia). So the whole filesystem is the in-memory
 * {@link memFileSystem} installed here, which serves exactly two things:
 *
 * 1. `/tsconfig.json` — a fixed config for the single-document project (tsconfig discovery walks
 *    up from the document URI through `sys.fileExists` → our memfs);
 * 2. the TypeScript **default lib `.d.ts`** files, matched by *basename* wherever TS resolves them
 *    (`/node_modules/typescript/lib/lib.*.d.ts` in a browser build — volar's fallback when
 *    `ts.getDefaultLibFilePath` throws without `ts.sys` — or the real tsdk path under node tests),
 *    supplied by the embedder ({@link BrowserServerOptions.tsLibs}) since a worker has no disk.
 *
 * Everything else the TS service needs is already resolution-independent: the typing preamble is
 * baked into the virtual `.tsx` (see `preamble-gen.ts`), and the `.nota` documents themselves are
 * open documents synced over the connection (open docs shadow the fs in Volar).
 *
 * The wasm reader is the bundler-target build vendored in `@nota-lang/compiler` (ESM `.wasm`
 * import, instantiated when the worker's module graph loads) — the same artifact the playground's
 * main thread already uses.
 */

import {
  createConnection,
  createServer,
  createTypeScriptProject,
  type FileStat,
  type FileSystem,
  FileType
} from "@volar/language-server/browser.js";
import ts from "typescript";
import type { URI } from "vscode-uri";
import { notaLanguagePlugin } from "./language-plugin.js";
import { initializeNotaServer } from "./server-core.js";

/** Options for {@link startBrowserServer}. */
export interface BrowserServerOptions {
  /**
   * The TypeScript default library files, `basename → contents` (e.g. `"lib.es2022.d.ts" → "…"`).
   * The embedder supplies them (bundled as assets — e.g. vite `import.meta.glob` over
   * `typescript/lib/lib.*.d.ts`); the server serves them at whatever path TS resolves default libs
   * to, by basename. Missing libs degrade to TS "Cannot find global type" noise, so ship the full
   * `lib.*.d.ts` set.
   */
  tsLibs: Record<string, string>;
}

/** The fixed single-document project config (mirrors the repo's tsconfig surface). */
const TSCONFIG = JSON.stringify({
  compilerOptions: {
    module: "esnext",
    moduleResolution: "bundler",
    target: "es2022",
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    // The virtual emit is Solid JSX; "preserve" + the preamble's global JSX namespace types it
    // with classic resolution — no jsx-runtime module lookup, so still disk-free.
    jsx: "preserve"
  }
});

/**
 * The in-memory {@link FileSystem}: `/tsconfig.json` + the TS default libs by basename. Everything
 * else does not exist (the `.nota` docs are open documents, which shadow the fs in Volar).
 */
function memFileSystem(tsLibs: Record<string, string>): FileSystem {
  // Normalize provided keys to basenames (tolerates full paths from asset globs).
  const libs = new Map<string, string>();
  for (const [key, text] of Object.entries(tsLibs)) {
    libs.set(key.split("/").pop() ?? key, text);
  }
  const contents = (uri: URI): string | undefined => {
    if (uri.path === "/tsconfig.json") {
      return TSCONFIG;
    }
    const base = uri.path.split("/").pop() ?? "";
    if (base.startsWith("lib.") && base.endsWith(".d.ts")) {
      return libs.get(base);
    }
    return undefined;
  };
  return {
    stat(uri): FileStat | undefined {
      const text = contents(uri);
      if (text !== undefined) {
        return { type: FileType.File, ctime: 0, mtime: 0, size: text.length };
      }
      return undefined;
    },
    readFile(uri): string | undefined {
      return contents(uri);
    },
    readDirectory(): [string, FileType][] {
      return [];
    }
  };
}

/**
 * Boot the Nota language server inside a Web Worker: `postMessage` connection on `self`, the
 * in-memory filesystem, and the browser-safe TS project over the virtual `.tsx`. Call once from the
 * worker entry module; the embedder connects an LSP client to the worker's message port.
 */
export function startBrowserServer(options: BrowserServerOptions): void {
  const connection = createConnection();
  const server = createServer(connection);
  server.fileSystem.install("file", memFileSystem(options.tsLibs));
  initializeNotaServer(
    connection,
    server,
    createTypeScriptProject(ts, undefined, () => ({
      languagePlugins: [notaLanguagePlugin]
    })),
    ts
  );
}
