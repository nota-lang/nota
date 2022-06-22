import { peerImports } from "@nota-lang/nota-components/dist/peer-imports.js";
import _ from "lodash";

export let GLOBAL_NAME = "__exports";

export let dynamicLoad = (config: {
  script: string;
  url?: string;
  imports?: { [key: string]: any };
}) => {
  let imports = config.imports || {};
  let require = (path: string): any => {
    if (path == "@nota-lang/nota-components/dist/peer-imports.js") {
      return { peerImports };
    }
    if (path in imports) {
      return imports[path];
    }
    if (path in peerImports) {
      return peerImports[path];
    }
    throw `Cannot import ${path}`;
  };

  let lines = config.script.trim().split("\n");
  let insertIndex = lines.length;
  if (lines.length > 0 && _.last(lines)!.startsWith("//#")) {
    insertIndex -= 1;
  }

  lines.splice(insertIndex, 0, `return ${GLOBAL_NAME};`);

  if (config.url) {
    lines.push(`//# sourceURL=${config.url}`);
  }

  let f = new Function("require", lines.join("\n"));
  return f(require);
};
