import fs from "fs/promises";
import cp from 'child_process';
import * as components from "@nota-lang/nota-components";

async function main() {
  await fs.mkdir("dist", {recursive: true});
  cp.execSync('lezer-generator lib/nota.grammar -o dist/nota.grammar.js');
  await fs.copyFile('lib/js_tokens.js', 'dist/js_tokens.js');

  let component_map = {};
  for (let k of Object.keys(components)) {
    for (let k2 of Object.keys(components[k])) {
      component_map[k2] = k;
    }
  }

  await fs.writeFile('dist/components.js', `
export default ${JSON.stringify(component_map)}
  `);
}

main();