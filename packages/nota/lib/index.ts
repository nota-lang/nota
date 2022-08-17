import "@cspotcode/source-map-support/register.js";
import { fileExists } from "@nota-lang/esbuild-utils";
import { log } from "@nota-lang/esbuild-utils/dist/log.js";
import { Command, program } from "commander";
import esbuild from "esbuild";
import path from "path";
import { fileURLToPath } from "url";

import * as builder from "./builder.js";
import * as server from "./server.js";

export interface CommonOptions {
  file: string;
  config: esbuild.BuildOptions;
  verbose: boolean;
}

let commonOpts = (cmd: Command): Command =>
  cmd
    .argument("<file>")
    .option("-c, --config <path>", "Path to config file")
    .option("-v, --verbose");

let loadConfig = async (configPath?: string): Promise<esbuild.BuildOptions> => {
  if (!configPath && (await fileExists("nota.config.mjs"))) {
    configPath = "nota.config.mjs";
  }

  if (!configPath) {
    return {};
  }

  // Note: if imported path is relative, this seemed to cause script to get executed twice??
  // No idea why, but path.resolve fixes the issue.
  let mod = await import(path.resolve(configPath));
  return mod.default;
};

export let __filename = fileURLToPath(import.meta.url);
export let __dirname = path.dirname(__filename);

export let nodePaths = [path.resolve(path.join(__dirname, "..", "node_modules"))];
if (process.env.NODE_PATH) {
  nodePaths.push(process.env.NODE_PATH);
}

// @ts-ignore
program.version(VERSION);

commonOpts(program.command("build"))
  .option("-w, --watch", "Watch for changes and rebuild")
  .option("-g, --debug", "Build in debug mode")
  .option("-p, --port <port>", "Port to run SSR server", parseInt)
  .action(async (file, { config, verbose, ...opts }) => {
    if (verbose) log.level = "debug";
    await builder.main({ file, config: await loadConfig(config), ...opts });
  });

commonOpts(program.command("edit"))
  .option("-p, --port <port>", "Port to run local server", parseInt)
  .option("-s, --static <dir>", "Directory to serve static files")
  .action(async (file, { config, verbose, ...opts }) => {
    if (verbose) log.level = "debug";
    await server.main({
      file,
      config: await loadConfig(config),
      ...opts,
    });
  });

program.parseAsync(process.argv);
