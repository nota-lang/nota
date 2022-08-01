import { peerImports } from "@nota-lang/nota-components/dist/peer-imports.js";
import _ from "lodash";

export let dynamicLoad = (config: {
  script: string;
  url?: string;
  imports?: { [key: string]: any };
}): any => {
  let imports = config.imports || {};
  let require = (path: string): any => {
    if (path == "@nota-lang/nota-components/dist/peer-imports.js") {
      return { peerImports };
    }
    if (path == "@nota-lang/nota-components/dist/index.css") {
      return;
    }

    if (path in imports) {
      return imports[path];
    }
    if (path in peerImports) {
      return peerImports[path];
    }
    throw new Error(`Cannot import ${path}`);
  };

  let script = config.script.trim();
  if (config.url) {
    script += `\n//# sourceURL=${config.url}`;
  }

  let f = new Function("require", "exports", "module", script);
  let module: any = { exports: {} };
  f(require, module.exports, module);
  return module.exports;
};
