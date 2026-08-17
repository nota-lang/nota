/**
 * The language-server implementation module, dynamically imported by the worker bootstrap
 * (`./worker.ts`): boots the browser flavor of `@nota-lang/language-server` (Volar + the TS
 * language service over the reader's virtual `.tsx`) speaking LSP over `postMessage`. The wasm
 * reader instantiates when this module graph loads (bundler-target ESM `.wasm` import — same as
 * the main thread).
 *
 * The TypeScript default libs are bundled here as raw assets and served by the server's in-memory
 * filesystem (a worker has no disk; the typing preamble needs no other files by design).
 */

import { startBrowserServer } from "@nota-lang/language-server/browser";

/**
 * The TypeScript default-lib sources, bundled as raw assets by this exact `import.meta.glob`.
 * Exported so tests consume this real object instead of duplicating the glob pattern as a second
 * string literal that could silently drift from this one (`tests/lsp.test.ts`).
 */
export const tsLibs = import.meta.glob<string>(
  "/node_modules/typescript/lib/lib.*.d.ts",
  { query: "?raw", import: "default", eager: true }
);

/** Boot the server (attaches the connection's `onmessage` via `listen()`). */
export function boot(): void {
  startBrowserServer({ tsLibs });
}
