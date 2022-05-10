import fs from "fs";
import path from "path";

let OUTPUT_DIR = "dist";
fs.mkdirSync(OUTPUT_DIR, {recursive: true});
fs.copyFileSync(path.join("css", "index.scss"), path.join(OUTPUT_DIR, "index.scss"));
