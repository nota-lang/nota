/**
 * Node utilities for integrating Nota with esbuild.
 * @module
 */

export { log } from "./log.js";
export { SsrPluginOptions, ssrPlugin } from "./ssr.js";
export { CopyPluginOptions, copyPlugin } from "./copy.js";
export { ExecutablePluginOptions, executablePlugin } from "./executable.js";
export { EsmExternalsPluginOptions, esmExternalsPlugin } from "./esm-externals.js";
export { tscPlugin } from "./tsc.js";
export { cli, CliOptions } from "./cli.js";

//@ts-ignore
import esMain from "es-main";
import fs from "fs";
import _ from "lodash";
import type { IPackageJson } from "package-json-type";

/** Asynchronously check if a file exists, returning true if so.
 * @param path Path to the file.
 */
export let fileExists = async (path: string): Promise<boolean> => {
  try {
    await fs.promises.access(path, fs.constants.F_OK);
    return true;
  } catch (_e) {
    return false;
  }
};

/** Check if the current file is the entrypoint to a Node.js application.
 * @param meta The `import.meta` for the current file.
 */
export let isMain: (meta: ImportMeta) => boolean = esMain;

/** Synchronously loads the current package's manifest (package.json) as a JS object.
 * Returns an empty object if package.json does not exist.
 */
export let getManifest = (): IPackageJson => {
  let pkgPath = "./package.json";
  return fs.existsSync(pkgPath) ? JSON.parse(fs.readFileSync("./package.json", "utf-8")) : {};
};
