import fs from "fs";
import path from "path";

let OUTPUT_DIR = "dist";
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR);
}
fs.copyFileSync(path.join("css", "index.scss"), path.join(OUTPUT_DIR, "index.scss"));
