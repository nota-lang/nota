/** Browser-worker server backed by an in-memory tsconfig and TypeScript libs. */

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

export interface BrowserServerOptions {
  /** TypeScript default libraries keyed by basename or path. */
  tsLibs: Record<string, string>;
}

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    module: "esnext",
    moduleResolution: "bundler",
    target: "es2022",
    // Explicit, not defaulted from `target`. A bare `target: "es2022"` resolves to
    // `lib.es2022.full.d.ts`, whose closure drags in scripthost and webworker.importscripts, and
    // it leaves the host guessing which `lib.*.d.ts` files it must supply — this server's host
    // is an in-memory filesystem in a Web Worker (see `tsLibs`), so "which files" is a bundling
    // decision that has to be written down somewhere. Here is that somewhere.
    lib: ["es2022", "dom", "dom.iterable"],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    jsx: "preserve"
  }
});

/** Serve `/tsconfig.json` and TypeScript's default libs. */
function memFileSystem(tsLibs: Record<string, string>): FileSystem {
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

/** Start the Nota language server in the current Web Worker. */
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
