import fs from "fs/promises";
import cp from 'child_process';
import * as components from "@nota-lang/nota-components";

async function main() {
  await fs.mkdir("dist/parse", {recursive: true});
  cp.execSync('lezer-generator lib/parse/notajs.grammar -o dist/parse/notajs.grammar.js');
  await fs.copyFile('lib/parse/js_tokens.js', 'dist/parse/js_tokens.js');

  let component_map = {};
  for (let k of Object.keys(components)) {
    for (let k2 of Object.keys(components[k])) {
      component_map[k2] = k;
    }
  }

  await fs.writeFile('dist/translate/components.js', `
export default ${JSON.stringify(component_map)}
  `);
}

main();