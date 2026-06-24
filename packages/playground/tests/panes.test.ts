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
import { compileNota, compileNotaRaw, ensureCompiler } from "../src/compiler";
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
});

describe("pipeline: Generated-JS survives an SSG error", () => {
  afterEach(() => vi.restoreAllMocks());

  // `\`hello\`` (backtick-wrapped inline code) lowers to a CodeInline, which currently throws during
  // SSG — a compile-succeeds-but-SSG-throws doc. If the premise test below ever fails, that bug was
  // fixed; swap in another such fixture.
  const INLINE_CODE = "`hello`";

  it("a CodeInline doc compiles but throws during SSG", () => {
    expect(() => compileNotaRaw(INLINE_CODE)).not.toThrow();
    expect(() => runSSG(compileNota(INLINE_CODE))).toThrow();
  });

  it("shows this run's emitted JS (not the prior run's) and surfaces the error", () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    // A prior good run, whose JS would wrongly persist if the SSG-error path kept `prev.code`.
    const prev = { ...EMPTY, code: "STALE", full: "STALE-FULL" };

    const result = runPipeline(INLINE_CODE, prev);

    // The Generated-JS pane shows *this* run's compile, not the stale prior run.
    expect(result.code).toBe(compileNotaRaw(INLINE_CODE));
    expect(result.code).not.toBe("STALE");
    expect(result.full).toBe(compileNota(INLINE_CODE));
    // The error is surfaced to the UI and logged (with its stack) to the console.
    expect(result.error).toBeTruthy();
    expect(logged).toHaveBeenCalled();
  });

  it("keeps the last-good render under the error", () => {
    const good = runPipeline(GOLDEN_NOTA, EMPTY);
    expect(good.error).toBeNull();

    vi.spyOn(console, "error").mockImplementation(() => {});
    const result = runPipeline(INLINE_CODE, good);

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
