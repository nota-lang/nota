import cp from "child_process";
import fs from "fs/promises";

async function main() {
  await fs.mkdir("dist/parse", { recursive: true });
  await fs.mkdir("dist/translate", { recursive: true });
  await fs.copyFile("lib/parse/js_tokens.js", "dist/parse/js_tokens.js");
  cp.execSync("lezer-generator lib/parse/notajs.grammar -o dist/parse/notajs.grammar.js");
}

main();
