/**
 * Output-pane parity tests: the **Generated-JS** pane equals the compiler output, and
 * the **SSG-output** pane equals `render`'s output — over the project golden (`integration/golden.nota`,
 * the Colorized island). Runs headless in jsdom: the wasm compiler is instantiated from the `.wasm`
 * **bytes** (jsdom has no `file://` `fetch`), and `render` runs in jsdom (react-dom/server is sync).
 */

import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { compile as wasmCompile } from "nota_wasm";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import {
  compileNota,
  compileNotaRaw,
  ensureCompiler,
  parseNotaAst
} from "../src/compiler";
import { DEFAULT_SNIPPET } from "../src/default-snippet";
import { GOLDEN_NOTA } from "../src/golden";
import { EMPTY, runPipeline } from "../src/pipeline";
import { runSSG } from "../src/ssg";

beforeAll(async () => {
  // Resolve the `.wasm` next to the pkg's JS and feed the bytes to the wasm init (Node path).
  const require = createRequire(import.meta.url);
  const wasmJs = require.resolve("nota_wasm");
  const wasmPath = wasmJs.replace(/nota_wasm\.js$/, "nota_wasm_bg.wasm");
  const bytes = readFileSync(wasmPath);
  await ensureCompiler(bytes);
});

describe("Generated-JS pane", () => {
  it("equals the raw wasm compiler output", () => {
    // The pane shows `compileNotaRaw` (no runtime import); it must be byte-identical to the backend.
    expect(compileNotaRaw(GOLDEN_NOTA)).toBe(wasmCompile(GOLDEN_NOTA).code);
  });

  it("prepends the runtime import for the SSG/iframe-fed `full` form", () => {
    const full = compileNota(GOLDEN_NOTA);
    expect(full.startsWith("import { h, decode, Fragment")).toBe(true);
    expect(full).toContain(compileNotaRaw(GOLDEN_NOTA));
  });

  it("emits the hoisted+exported island component the registry imports by name", () => {
    // The manifest's `comp` must be an exported binding of the emitted module.
    const code = compileNotaRaw(GOLDEN_NOTA);
    expect(code).toMatch(/export\s+(const|let|var|function)\s+Colorized/);
  });
});

describe("AST pane", () => {
  // The faithful Nota tree as ESTree JSON: a `Program` whose body is the Nota document, carrying the
  // node kinds the seed exercises — a heading, elements, a `%` statement, and a `@for` loop.
  // biome-ignore lint/suspicious/noExplicitAny: walking arbitrary ESTree JSON for the kind set.
  const collectTypes = (node: any, out = new Set<string>()): Set<string> => {
    if (Array.isArray(node)) for (const el of node) collectTypes(el, out);
    else if (node && typeof node === "object") {
      if (typeof node.type === "string") out.add(node.type);
      for (const v of Object.values(node)) collectTypes(v, out);
    }
    return out;
  };

  // biome-ignore lint/suspicious/noExplicitAny: ad-hoc ESTree walk to the first node of a type.
  const findNode = (node: any, type: string): any => {
    if (Array.isArray(node)) {
      for (const el of node) {
        const hit = findNode(el, type);
        if (hit) return hit;
      }
    } else if (node && typeof node === "object") {
      if (node.type === type) return node;
      for (const v of Object.values(node)) {
        const hit = findNode(v, type);
        if (hit) return hit;
      }
    }
    return undefined;
  };

  it("serializes the post-parse Nota AST to ESTree JSON (parser stage, no lowering)", () => {
    const tree = JSON.parse(parseNotaAst(DEFAULT_SNIPPET));
    expect(tree.type).toBe("Program");
    const types = collectTypes(tree);
    for (const kind of [
      "NotaHeading",
      "NotaElement",
      "NotaStatement",
      "NotaFor"
    ]) {
      expect(types.has(kind)).toBe(true);
    }
    // Parser stage only: no lowered hyperscript — there are no `CallExpression` `h(...)` nodes.
    expect(types.has("CallExpression")).toBe(false);
  });

  it("every node carries `start`/`end` offsets the tree slices previews from", () => {
    const tree = JSON.parse(parseNotaAst(DEFAULT_SNIPPET));
    const heading = findNode(tree, "NotaHeading");
    expect(typeof heading.start).toBe("number");
    // The heading spans `# Hello, Nota`; its source slice is what the tree row previews.
    expect(DEFAULT_SNIPPET.slice(heading.start, heading.end)).toContain(
      "Hello, Nota"
    );
  });

  it("throws on a Nota parse error (same surface as compile)", () => {
    // An unterminated element body (`Expected \`}\``) is a parse diagnostic; `parseAst` rejects with
    // the rendered message, exactly as `compile*` does.
    expect(() => parseNotaAst("@em{unterminated")).toThrow();
  });

  it("the pipeline carries a fresh AST paired with the source that produced it", () => {
    const result = runPipeline(DEFAULT_SNIPPET, EMPTY);
    expect(result.error).toBeNull();
    expect(result.ast).toBe(parseNotaAst(DEFAULT_SNIPPET));
    expect(result.astSource).toBe(DEFAULT_SNIPPET);
  });
});

describe("SSG-output pane", () => {
  it("equals `render`'s output: island HTML + manifest", () => {
    const { html, manifest } = runSSG(compileNota(GOLDEN_NOTA));

    // SSG-output shape: each Colorized boundary is an island wrapped in a runtime marker;
    // React serializes `style` as `color:red` (no space) and drops `onClick` from static HTML.
    expect(html).toContain('<nota-island data-hydration-id="1">');
    expect(html).toContain('<nota-island data-hydration-id="2">');
    expect(html).toContain('<span style="color:red">a</span>');
    expect(html).toContain('<span style="color:red">b</span>');
    expect(html).not.toContain("onClick");
    // The `- @Colorized{…}` list items group into a <ul> (the decode struct pass, runtime side).
    expect(html).toContain("<ul>");

    // Manifest: two islands, both the exported `Colorized`.
    const ids = Object.keys(manifest);
    expect(ids).toEqual(["1", "2"]);
    expect(manifest["1"].comp).toBe("Colorized");
    expect(manifest["2"].comp).toBe("Colorized");
  });

  it("is deterministic across runs (manifest reset between renders)", () => {
    const a = runSSG(compileNota(GOLDEN_NOTA));
    const b = runSSG(compileNota(GOLDEN_NOTA));
    expect(b.html).toBe(a.html);
    expect(Object.keys(b.manifest)).toEqual(Object.keys(a.manifest));
  });

  it("math + code render through the ambient prelude (R14)", () => {
    const { html } = runSSG(compileNota("Euler: $e^x$ and `f(x)`\n"));
    expect(html).toContain('<span class="nota-tex">');
    expect(html).toContain("<math");
    expect(html).toContain('<code class="nota-code-inline">f(x)</code>');
  });

  it("a user %import of the prelude resolves (no bundler in the playground)", () => {
    // The field repro: a %%% block importing lstset used to die with "import declarations may
    // only appear at top level of a module" (the import survived into the new Function script).
    const doc =
      '%%%\nimport { lstset } from "@nota-lang/prelude";\n\nlstset({ language: "rust" });\n%%%\n\n```\nfn main() {}\n```\n';
    const { html } = runSSG(compileNota(doc));
    expect(html).toContain('<pre class="shiki');
  });

  it("aliased and namespace import forms resolve; imports shadow the ambient binding", () => {
    // NB the blank line before the fence: R8 continues a `%` statement across single newlines
    // wherever JS grammar allows, and a following backtick fence would parse as a TAGGED TEMPLATE
    // on the call's result. (True in every integrator, not just here.)
    const aliased =
      '%import { lstset as set } from "@nota-lang/prelude"\n% set({ language: "python" })\n\n```\ndef f(): pass\n```\n';
    expect(runSSG(compileNota(aliased)).html).toContain('<pre class="shiki');
    const ns =
      '%import * as p from "@nota-lang/prelude"\n% p.lstset({ language: "python" })\n\n```\ndef f(): pass\n```\n';
    expect(runSSG(compileNota(ns)).html).toContain('<pre class="shiki');
  });

  it("an unresolvable import is a pointed error, not a parse error", () => {
    // The import must be *referenced*: the build path's TS-strip elides unused imports
    // (TypeScript semantics), so an unused `{ x }` never reaches the evaluator at all.
    const doc = '%import { x } from "./local.js"\n@p{@x}\n';
    expect(() => runSSG(compileNota(doc))).toThrow(
      /playground can only resolve imports of/
    );
  });
});

describe("SSG-output pane: the client hydration entry", () => {
  it("an islands doc carries the generated boot entry (what a build ships)", () => {
    const r = runPipeline(GOLDEN_NOTA, EMPTY);
    expect(r.error).toBeNull();
    // The exact generateClientEntry source the CLI esbuild-bundles: a DATA-ONLY entry — namespace
    // module import, THIS run's manifest embedded, and the runtime's slot-aware boot call (the
    // hydration logic itself lives in @nota-lang/runtime's boot.ts).
    expect(r.clientJs).toContain(
      'import * as _islandModule from "./doc.compiled.mjs"'
    );
    expect(r.clientJs).toContain(
      "bootIslandsWithSlots(manifest, islandRegistry(manifest, _islandModule));"
    );
    expect(r.clientJs).toContain(JSON.stringify(r.manifest));
    expect(r.clientJs).not.toContain("function bootIslandsWithSlots"); // logic not stamped in
  });

  it("an island-free doc has NO client JS (zero-JS, mirroring the CLI)", () => {
    const r = runPipeline("# Static\n\nJust prose.\n", EMPTY);
    expect(r.error).toBeNull();
    expect(r.manifest).toEqual({});
    expect(r.clientJs).toBe("");
  });
});

describe("pipeline: Generated-JS survives an SSG error", () => {
  afterEach(() => vi.restoreAllMocks());

  // A `%` statement calling an undefined function: compiles fine, throws at `Doc()` during SSG —
  // a compile-succeeds-but-SSG-throws doc. (The previous fixture, backtick inline code, stopped
  // qualifying when the playground gained the ambient prelude — CodeInline now renders.)
  const SSG_THROWS = "% boom()\nhi";

  it("the fixture compiles but throws during SSG (premise)", () => {
    expect(() => compileNotaRaw(SSG_THROWS)).not.toThrow();
    expect(() => runSSG(compileNota(SSG_THROWS))).toThrow();
  });

  it("shows this run's emitted JS (not the prior run's) and surfaces the error", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // A prior good run, whose JS would wrongly persist if the SSG-error path kept `prev.code`.
    const prev = { ...EMPTY, code: "STALE", full: "STALE-FULL" };

    const result = runPipeline(SSG_THROWS, prev);

    // The Generated-JS pane shows *this* run's compile, not the stale prior run.
    expect(result.code).toBe(compileNotaRaw(SSG_THROWS));
    expect(result.code).not.toBe("STALE");
    expect(result.full).toBe(compileNota(SSG_THROWS));
    // The error is surfaced to the UI and logged (with its stack) to the console.
    expect(result.error).toBeTruthy();
    expect(logged).toHaveBeenCalled();
  });

  it("keeps the last-good render under the error", () => {
    const good = runPipeline(GOLDEN_NOTA, EMPTY);
    expect(good.error).toBeNull();

    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = runPipeline(SSG_THROWS, good);

    // SSG failed this run, so the SSG/Rendered panes retain the last-good output.
    expect(result.html).toBe(good.html);
    expect(result.manifest).toBe(good.manifest);
    expect(result.registry).toBe(good.registry);
    expect(result.error).toBeTruthy();
  });
});

describe("editor default snippet", () => {
  it("compiles cleanly, so the playground never greets a visitor with an error", () => {
    expect(() => compileNotaRaw(DEFAULT_SNIPPET)).not.toThrow();
    // Sanity: it exercises a heading, an element, a statement, and a loop.
    const code = compileNotaRaw(DEFAULT_SNIPPET);
    expect(code).toContain('h("h1"');
    expect(code).toContain('h("strong"');
  });
});
