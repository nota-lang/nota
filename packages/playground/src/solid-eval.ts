/** Compile emitted Solid JSX and evaluate it against the playground's module map. */

import * as Babel from "@babel/standalone";
import * as notaCore from "@nota-lang/core";
import * as prelude from "@nota-lang/prelude";
import solidPreset from "babel-preset-solid";
import * as solidJs from "solid-js";
import * as solidWeb from "solid-js/web";

/** Modules available to evaluated documents. */
export const MODULE_MAP: Record<string, Record<string, unknown>> = {
  "solid-js": solidJs as unknown as Record<string, unknown>,
  "solid-js/web": solidWeb as unknown as Record<string, unknown>,
  "@nota-lang/core": notaCore as unknown as Record<string, unknown>,
  "@nota-lang/prelude": prelude as unknown as Record<string, unknown>
};

/** Compile emitted JSX to Solid's DOM runtime. */
export function babelCompile(jsxModule: string): string {
  const out = Babel.transform(jsxModule, {
    filename: "doc.tsx",
    presets: [
      ["typescript", { isTSX: true, allExtensions: true }],
      [solidPreset, { generate: "dom", hydratable: false }]
    ],
    sourceType: "module"
  });
  if (typeof out?.code !== "string") {
    throw new Error("babel: no output for the compiled document");
  }
  return out.code;
}

/** Minimal Babel AST shape used by the import/export rewrite. */
interface AstNode {
  type: string;
  name?: string;
  value?: string;
  source?: AstNode | null;
  specifiers?: AstNode[];
  imported?: AstNode;
  local?: AstNode;
  declaration?: AstNode | null;
  declarations?: { id: AstNode }[];
  id?: AstNode | null;
}

interface AstPath {
  node: AstNode;
  remove(): void;
  replaceWith(node: AstNode): void;
}

interface AstVisitor {
  ImportDeclaration(path: AstPath): void;
  ExportDefaultDeclaration(path: AstPath): void;
  ExportNamedDeclaration(path: AstPath): void;
}

interface ExportCollector {
  defaultName: string | null;
  named: string[];
}

/** Rewrite imports into scope bindings and collect declaration exports. */
function importExportPlugin(
  scope: Map<string, unknown>,
  exported: ExportCollector,
  problem: { specifier: string | null }
): { visitor: AstVisitor } {
  return {
    visitor: {
      ImportDeclaration(path) {
        if (problem.specifier !== null) {
          return;
        }
        const specifier = path.node.source?.value;
        if (specifier === undefined) {
          return;
        }
        const mod = MODULE_MAP[specifier];
        if (!mod) {
          problem.specifier = specifier;
          return;
        }
        for (const spec of path.node.specifiers ?? []) {
          const local = spec.local?.name;
          if (!local) {
            continue;
          }
          if (spec.type === "ImportDefaultSpecifier") {
            scope.set(local, mod.default);
          } else if (spec.type === "ImportNamespaceSpecifier") {
            scope.set(local, mod);
          } else {
            const importedName = spec.imported?.name ?? spec.imported?.value;
            if (importedName) {
              scope.set(local, mod[importedName]);
            }
          }
        }
        path.remove();
      },
      ExportDefaultDeclaration(path) {
        const decl = path.node.declaration;
        const name = decl?.id?.name;
        if (
          decl &&
          (decl.type === "FunctionDeclaration" ||
            decl.type === "ClassDeclaration") &&
          name
        ) {
          exported.defaultName = name;
          path.replaceWith(decl);
        } else {
          path.remove();
        }
      },
      ExportNamedDeclaration(path) {
        const { declaration, source } = path.node;
        if (declaration) {
          if (declaration.type === "VariableDeclaration") {
            for (const d of declaration.declarations ?? []) {
              if (d.id.type === "Identifier" && d.id.name) {
                exported.named.push(d.id.name);
              }
            }
          } else if (declaration.id?.name) {
            exported.named.push(declaration.id.name);
          }
          path.replaceWith(declaration);
        } else if (!source) {
          path.remove();
        }
      }
    }
  };
}

export type DocFn = () => unknown;

/** Evaluate compiled code and return its declaration exports. */
export function evalModule(compiled: string): Record<string, unknown> {
  const scope = new Map<string, unknown>();
  const exported: ExportCollector = { defaultName: null, named: [] };
  const problem: { specifier: string | null } = { specifier: null };

  const out = Babel.transform(compiled, {
    filename: "compiled.js",
    sourceType: "module",
    plugins: [importExportPlugin(scope, exported, problem)]
  });

  if (problem.specifier !== null) {
    throw new Error(
      `The playground can only resolve imports of ${Object.keys(MODULE_MAP)
        .map(s => `"${s}"`)
        .join(", ")} — "${problem.specifier}" is not available here. ` +
        "A real build can resolve arbitrary modules."
    );
  }
  if (typeof out?.code !== "string") {
    throw new Error("babel: no output for the import/export rewrite");
  }
  const body = out.code;

  const entries = [
    ...(exported.defaultName ? [`default: ${exported.defaultName}`] : []),
    ...exported.named
  ].join(", ");

  // eslint-disable-next-line @typescript-eslint/no-implied-eval -- intentional: run the compiled document.
  const factory = new Function(
    ...scope.keys(),
    `"use strict";\n${body}\n;return { ${entries} };`
  );
  return factory(...scope.values()) as Record<string, unknown>;
}

/** Compile and evaluate an emitted document module. */
export function compileAndEval(jsxModule: string): {
  compiled: string;
  Doc: DocFn;
} {
  const compiled = babelCompile(jsxModule);
  const mod = evalModule(compiled);
  const Doc = mod.default as DocFn | undefined;
  if (typeof Doc !== "function") {
    throw new Error(
      "the compiled document has no default-export Doc component"
    );
  }
  return { compiled, Doc };
}
