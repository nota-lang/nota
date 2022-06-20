import { peerImports } from "@nota-lang/nota-components/dist/peer-imports.js";

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

  let suffix = `\n; return ${GLOBAL_NAME};`;
  if (config.url) {
    suffix += `\n//# sourceURL=${config.url}`;
  }

  let f = new Function("require", config.script + suffix);
  return f(require);
};
