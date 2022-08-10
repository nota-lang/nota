import * as cp from "child_process";
import fs from "fs-extra";
import { promisify } from "util";

let exec = promisify(cp.exec);

async function main() {
  let watch = process.argv.includes("-w");
  await fs.mkdir("dist", { recursive: true });
  await fs.copyFile("lib/source-map.js", "dist/source-map.js");
  let sass = exec(`sass -I node_modules css/nota-editor.scss dist/index.css ${watch ? "-w" : ""}`);
  let tsc = exec(`tsc ${watch ? "-w" : ""}`);
  await Promise.all([sass, tsc]);
}

main();
