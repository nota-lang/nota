import { getManifest } from "@nota-lang/esbuild-utils";
import fs from "fs/promises";
import _ from "lodash";
import ts from "typescript";

let getComponents = () => {
  let host = ts.createCompilerHost({});
  let options = ts.getParsedCommandLineOfConfigFile("./tsconfig.json", undefined, host).options;
  let program = ts.createProgram({ rootNames: ["lib/index.ts"], options, host });
  let tc = program.getTypeChecker();
  let indexSym = tc.getSymbolAtLocation(program.getSourceFile("lib/index.ts"));
  let getComment = node => {
    let parts = node.getDocumentationComment(tc);
    if (parts.length > 0) {
      return parts[0].text;
    } else {
      return undefined;
    }
  };

  let components = {};
  ts.forEachChild(program.getSourceFile("lib/index.ts"), child => {
    if (ts.isExportDeclaration(child)) {
      let module = child.exportClause.name.escapedText;
      let comment = child.jsDoc ? child.jsDoc[0].comment : undefined;
      components[module] = { comment, members: [] };
    }
  });

  // for each module in src/index.ts...
  tc.getExportsOfModule(indexSym).forEach(exprt => {
    let decl = exprt.declarations[0];
    let declTy = tc.getTypeAtLocation(decl);

    // for each exported member of the module...
    declTy.getProperties().forEach(member => {
      let memberTy = tc.getTypeOfSymbolAtLocation(member, member.valueDeclaration);
      if (memberTy.getSymbol().getName() != "FunctionComponent") return;

      // assuming the component has the type React.FC<Props>, get the Props
      let propsTy = memberTy.aliasTypeArguments[0];

      // extract description of props
      let propTys = propsTy.getProperties();
      let props = propTys.map(tySym => {
        let propName = _.camelCase(tySym.getName());
        let required = true;
        let ty = tc.getTypeOfSymbolAtLocation(tySym, tySym.valueDeclaration);
        if (ty.flags & ts.TypeFlags.UnionOrIntersection) {
          required = !ty.types.some(fieldTy => fieldTy.flags & ts.TypeFlags.Undefined);
        }

        return { name: propName, comment: getComment(tySym), required };
      });

      // extract description of component
      components[exprt.getName()].members.push({
        name: member.getName(),
        comment: getComment(member),
        props,
      });
    });
  });

  return Object.keys(components).map(module => ({ module, ...components[module] }));
};

let main = async () => {
  await fs.mkdir("dist", { recursive: true });

  let manifest = getManifest();
  let modules = Object.keys(manifest.peerDependencies).concat(["react-dom/client"]);

  let peerDependencies = JSON.stringify(modules.concat(["@nota-lang/nota-components"]));
  await fs.writeFile("dist/peer-dependencies.d.mts", `export const peerDependencies: string[];`);
  await fs.writeFile(
    "dist/peer-dependencies.mjs",
    `export let peerDependencies = ${peerDependencies};`
  );

  let toImport = modules
    .map(name => ({ src: name, dst: name }))
    .concat([
      { src: "./index.js", dst: "@nota-lang/nota-components" },
      { src: "./component-meta.js", dst: "@nota-lang/nota-components/dist/component-meta.js" },
    ]);
  let imports = toImport
    .map(({ src }, i) => `import * as _${i} from ${JSON.stringify(src)};`)
    .join("\n");
  let export_ = `export let peerImports = {${toImport
    .map(({ dst }, i) => `${JSON.stringify(dst)}: _${i}`)
    .join(",")}}`;
  await fs.writeFile("dist/peer-imports.d.ts", `export const peerImports: {[mod: string]: any};`);
  await fs.writeFile("dist/peer-imports.js", imports + "\n" + export_);

  let components = getComponents();
  await fs.writeFile(
    "dist/component-meta.d.ts",
    `
export interface ComponentPropMeta {
  name: string;
  required: boolean;
  comment?: string;
}

export interface ComponentMeta {
  name: string;
  comment?: string;
  props: ComponentPropMeta[];
}

export interface ComponentModuleMeta {
  module: string;
  comment?: string;
  members: ComponentMeta[];
}

export const componentMeta: ComponentModuleMeta[];`.trim()
  );
  await fs.writeFile(
    "dist/component-meta.js",
    `export let componentMeta = ${JSON.stringify(components)}`
  );
};

main();
