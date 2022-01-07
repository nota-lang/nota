import esbuild from "esbuild";
import { Command, program } from "commander";
import path from "path";
import { file_exists } from "@nota-lang/esbuild-utils";
import { fileURLToPath } from "url";
import "@cspotcode/source-map-support/register.js";

import * as server from "./server";
import * as builder from "./builder";

export interface CommonOptions {
  file: string;
  config: esbuild.BuildOptions;
}

let common_opts = (cmd: Command): Command =>
  cmd.argument("<file>").option("-c, --config <path>", "Path to config file");

let load_config = async (config_path?: string): Promise<esbuild.BuildOptions> => {
  if (!config_path && (await file_exists("nota.config.mjs"))) {
    config_path = "nota.config.mjs";
  }

  if (!config_path) {
    return {};
  }

  // Note: if imported path is relative, this seemed to cause script to get executed twice??
  // No idea why, but path.resolve fixes the issue.
  let mod = await import(path.resolve(config_path));
  return mod.default;
};

export let __filename = fileURLToPath(import.meta.url);
export let __dirname = path.dirname(__filename);

export let nodePaths = [path.resolve(path.join(__dirname, '..', 'node_modules'))];
if (process.env.NODE_PATH) {
  nodePaths.push(process.env.NODE_PATH);
}

common_opts(program.command("build")).action(async (file, { config, ...opts }) => {
  await builder.main({ file, config: await load_config(config), ...opts });
});

common_opts(program.command("edit"))
  .option("-p, --port <port>", "Port to run local server", parseInt)
  .option("-s, --static <dir>", "Directory to serve static files")
  .action(
    async (file, { config, ...opts }) =>
      await server.main({
        file,
        config: await load_config(config),
        ...opts,
      })
  );

program.parseAsync(process.argv);
