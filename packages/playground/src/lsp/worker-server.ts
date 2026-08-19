/** Dynamically loaded browser language-server implementation. */

import { startBrowserServer } from "@nota-lang/language-server/browser";

export const tsLibs = import.meta.glob<string>(
  "/node_modules/typescript/lib/lib.*.d.ts",
  { query: "?raw", import: "default", eager: true }
);

export function boot(): void {
  startBrowserServer({ tsLibs });
}
