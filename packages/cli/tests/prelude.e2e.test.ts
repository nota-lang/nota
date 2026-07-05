/**
 * CLI e2e for contract R14: the ambient prelude defaults (KaTeX math, shiki code) render during
 * SSG, and the `--setup` module overrides them — statically (a plain tag stays zero-JS) and as a
 * hydration island (a registered marked component SSRs + gets a client bundle whose boot resolves
 * the component from the runtime registry, not the module's exports).
 */

import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, test } from "vitest";
import { buildNota } from "../src/build";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, ".."); // packages/cli — its node_modules has the deps linked

const setupDir = mkdtempSync(join(tmpdir(), "nota-setup-"));
afterAll(() => rmSync(setupDir, { recursive: true, force: true }));

/** Materialize a setup module and return its absolute path. */
function setupFile(name: string, source: string): string {
  const p = join(setupDir, name);
  writeFileSync(p, source);
  return p;
}

const MATH_CODE_DOC = `# Math and code

Euler: $e^{i\\pi} = -1$ and inline \`f(x)\`.

\`\`\`python
def f(x):
    return x
\`\`\`
`;

// =============================================================================================
// defaults
// =============================================================================================

describe("prelude defaults (R14c): KaTeX MathML + shiki, still zero-JS", () => {
  test("math renders to MathML, the fence highlights, and no script ships", async () => {
    const out = await buildNota(MATH_CODE_DOC, { resolveFrom: pkgRoot });
    expect(out.hasIslands).toBe(false);
    expect(out.html).not.toMatch(/<script/i);
    // KaTeX → MathML inside the inline host, joined into the paragraph.
    expect(out.html).toContain('<span class="nota-tex">');
    expect(out.html).toContain("<math");
    // The python fence went through shiki (block wrapper + tokenized <pre>).
    expect(out.html).toContain(
      '<div class="nota-code-block"><pre class="shiki'
    );
    // Inline code stays a plain <code> (no global language configured).
    expect(out.html).toContain('<code class="nota-code-inline">f(x)</code>');
  });
});

// =============================================================================================
// --setup: static override + site config
// =============================================================================================

describe("--setup (R14b/d): site-wide overrides and config", () => {
  test("a registered host-tag override replaces the Tex default, still static", async () => {
    const setup = setupFile(
      "kbd.setup.mjs",
      `import { registerComponents } from "@nota-lang/prelude";
registerComponents({ Tex: "kbd" });
`
    );
    const out = await buildNota("Euler: $e^x$\n", {
      resolveFrom: pkgRoot,
      setupModule: setup
    });
    expect(out.hasIslands).toBe(false);
    expect(out.html).toContain("<kbd>e^x</kbd>");
    expect(out.html).not.toContain("<math");
  });

  test("lstset({language}) in setup is the baked baseline: a bare fence highlights", async () => {
    const setup = setupFile(
      "lang.setup.mjs",
      `import { lstset } from "@nota-lang/prelude";
lstset({ language: "python" });
`
    );
    const out = await buildNota("```\ndef f(x): pass\n```\n", {
      resolveFrom: pkgRoot,
      setupModule: setup
    });
    expect(out.html).toContain('<pre class="shiki');
  });
});

// =============================================================================================
// --setup: islanded override (requirement b, the hydrating path)
// =============================================================================================

describe("--setup: a registered marked component islands (R14b)", () => {
  test("Tex override via inlineComponent → SSR island + client bundle resolves via the registry", async () => {
    const setup = setupFile(
      "island.setup.mjs",
      `import { registerComponents } from "@nota-lang/prelude";
import { h, inlineComponent } from "@nota-lang/runtime";
const LiveTex = inlineComponent(
  children => h("span", { className: "live-tex" }, children),
  "LiveTex"
);
registerComponents({ Tex: LiveTex });
`
    );
    const out = await buildNota("Value: $x$\n", {
      resolveFrom: pkgRoot,
      setupModule: setup
    });
    // The slot resolved to a boundary: one island, named by the registered component.
    expect(out.hasIslands).toBe(true);
    expect(Object.values(out.manifest)).toEqual([
      { comp: "LiveTex", props: {} }
    ]);
    // SSR shell inside the island marker, inline in the paragraph.
    expect(out.html).toMatch(
      /<p>Value: <nota-island data-hydration-id="1"><span class="live-tex">x<\/span><\/nota-island><\/p>/
    );
    // A client bundle shipped — and it could only have bundled by resolving LiveTex through the
    // runtime registry (doc.compiled.mjs does not export it; a named import would have failed).
    expect(out.html).toMatch(/<script/i);
  });
});
