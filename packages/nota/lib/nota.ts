#!/usr/bin/env -S node -r @cspotcode/source-map-support/register

import { program } from "commander";
import * as server from "./server";

program.command("build <file>").action(_opts => {
  throw `Not yet implemented!`;
});

program
  .command("edit")
  .argument("<file>")
  .option("-c, --config <path>", "Path to config file")
  .option("-p, --port <port>", "Port to run local server", parseInt)
  .action((file, opts) =>
    server.main({
      file,
      ...opts,
    })
  );

program.parse(process.argv);
