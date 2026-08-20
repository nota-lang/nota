/**
 * **The shipped binary** (`bin/nota.mjs` → `dist/cli.js`): build the dist bundle from source,
 * then spawn the bin under plain `node`.
 *
 * Three layers over one mega build:
 * - **packaging smoke** — the programmatic-API tests cannot catch packaging regressions (a
 *   CJS-format break and a missing runtime dep both shipped while the suite was green, because
 *   vitest resolves imports through its own pipeline instead of node's; this runs node's);
 * - **the mega surface, rendered** — `integration/mega.nota` pins every reader feature as
 *   emitted text elsewhere; here each section must also EXECUTE (one rendered marker per
 *   section, asserted over the built page);
 * - **the argv shell** — help/unknown-command/missing-input exit codes + stderr, the default
 *   `doc.nota → doc/` out dir, and `--title`.
 */

import { execFileSync, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Vitest runs with cwd = packages/cli.
const PKG = process.cwd();
const BIN = join(PKG, "bin/nota.mjs");
const MEGA = resolve(PKG, "../../integration/mega.nota");

const outDir = mkdtempSync(join(tmpdir(), "nota-bin-"));
afterAll(() => rmSync(outDir, { recursive: true, force: true }));

const clean = (h: string) =>
  h.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

let stdout = "";
let rawHtml = "";
let html = "";

beforeAll(() => {
  // Rebuild dist from the current source so the smoke never runs against a stale bundle.
  execFileSync(join(PKG, "node_modules/.bin/vite"), ["build"], {
    cwd: PKG,
    stdio: "pipe"
  });
  stdout = execFileSync("node", [BIN, "build", MEGA, "-o", outDir], {
    stdio: "pipe"
  }).toString();
  rawHtml = readFileSync(join(outDir, "index.html"), "utf8");
  html = clean(rawHtml);
});

describe("the nota bin", () => {
  it("builds the mega-test document via dist/cli.js under plain node", () => {
    expect(stdout).toContain("hydrating Solid app");
    expect(rawHtml).toContain('id="nota-doc-state"');
    expect(rawHtml).toContain('display="block"'); // the fence-form display math
    expect(rawHtml).toContain("The TeXbook"); // bibliography rendered
    expect(existsSync(join(outDir, "assets"))).toBe(true);
  });
});

describe("the mega surface, rendered", () => {
  it("elements & props: fragments, expressions, literal braces, spreads", () => {
    // `@{bare @b{fragment}}` and `@(1 + 2)` land inline in the flow paragraph.
    expect(html).toContain("Also a bare <b>fragment</b> and an expression 3.");
    expect(html).toContain("<em>a set {1, 2, 3}</em>");
    // `...rest` spread + bare boolean prop on a self-closing host tag.
    expect(html).toContain('<input type="text" disabled id="demo"/>');
  });

  it("dynamic tags produce their computed elements", () => {
    expect(html).toContain('<span class="chip">direct</span>');
    expect(html).toContain('<span class="chip">member</span>');
    expect(html).toMatch(/<em ?>call<\/em>/); // @(getTag()) — a computed host tag
    expect(html).toContain('<span class="chip">computed</span>');
  });

  it("control flow: the else-if chain takes one arm; @for destructures", () => {
    expect(html).toContain('<p class="nota-para">Many items.</p>');
    expect(html).toContain("<li>x</li><li>y</li><li>z</li>");
    expect(html).toContain("<li>a = 1</li><li>b = 2</li>"); // [key, val] of pairs
    expect(html).toContain("<li>row 1</li><li>row 2</li>"); // { id } of objects, @if-guarded
  });

  it("verbatim: the @pre|{…}| body is byte-exact, armed parts interpolate", () => {
    // Raw text (braces, `@`-forms) byte-exact; `|@…` escapes interpolate — the component child
    // renders (SSR bakes its signal-driven style) and the scalar splices.
    expect(html).toContain(
      '<pre>@foo{x} is raw; <span style="color:red">this is a child</span> and Will interpolates.</pre>'
    );
  });

  it("escapes render the literal characters", () => {
    expect(html).toContain(
      "Escapes render literally: * _ # $ @ { } and a backslash \\."
    );
  });

  it("math: armed parts interpolate into the TeX source, un-armed stay literal", () => {
    // `$b_|@i$` and `$c_|@(i + 1)$` interpolated; `$a_@i$` kept its literal `@`.
    expect(html).toContain(
      '<annotation encoding="application/x-tex">b_1</annotation>'
    );
    expect(html).toContain(
      '<annotation encoding="application/x-tex">c_2</annotation>'
    );
    expect(html).toContain(
      '<annotation encoding="application/x-tex">a_@i</annotation>'
    );
    // The fence-form display math interpolated its armed part too.
    expect(html).toContain(
      '<annotation encoding="application/x-tex">\\sum_3 x_i</annotation>'
    );
  });

  it("colon & block sugar produce their elements with props", () => {
    expect(html).toContain(
      "<summary>A one-line colon-sugar element.</summary>"
    );
    expect(html).toMatch(
      /<section class="tip"><p class="nota-para">A block-sugar body with a prop line\nand a soft-broken continuation\.<\/p><\/section>/
    );
    expect(html).toContain(
      '<aside class="x"><p class="nota-para">A styled colon-body aside; props compose with the colon.</p></aside>'
    );
  });

  it("doc-state sugars resolve: &ref numbers, shared note marks, flow entries", () => {
    // `&sec_flow` / `&sec-kebab` both anchor the enclosing heading (§1.7) — four plain refs
    // in that paragraph (one pins `&sec_flow.` keeping its dot literal; another pins
    // `&sec_flow[1]` keeping its non-props bracket prose), plus a custom-text ref.
    expect(html).toContain(
      '<a href="#doc-state-sugar" class="nota-ref">1.7</a>. keeps the'
    );
    expect(html).toContain(
      '<a href="#doc-state-sugar" class="nota-ref">1.7</a>[1] keeps'
    );
    expect(html).toContain(
      '<a href="#doc-state-sugar" class="nota-ref">this very section</a>'
    );
    expect(
      html.match(/<a href="#doc-state-sugar" class="nota-ref">1\.7<\/a>/g)
    ).toHaveLength(4);
    // Repeated &n1 shares number 1: the first use carries the backlink id, the repeat only
    // the href; &n2 numbers 2; the anonymous @Note and the element-form n3 follow.
    expect(html).toContain(
      '<sup class="nota-noteref"><a id="noteref-1" href="#note-1">1</a></sup>'
    );
    expect(html).toContain(
      '<sup class="nota-noteref"><a href="#note-1">1</a></sup>'
    );
    expect(html).toContain(
      '<sup class="nota-noteref"><a id="noteref-2" href="#note-2">2</a></sup>'
    );
    expect(html).toContain(
      '<sup class="nota-noteref"><a id="noteref-4" href="#note-4">4</a></sup>'
    );
    // The multi-paragraph [^n1]: definition decodes as flow inside one list entry.
    const fn1 = /<li id="note-1">([\s\S]*?)<\/li>/.exec(html)?.[1] ?? "";
    expect(fn1).toContain("The first note body, with <em>markup</em>.");
    expect(fn1).toContain("A second paragraph continues");
    // Guards: literal-prose tails stayed text.
    expect(html).toContain("Literal Vec&lt;T> and R&amp;D stay text;");
  });

  it("doc-state constructs: Toc, Cite/Bibliography", () => {
    const nav = /<nav class="nota-toc">([\s\S]*?)<\/nav>/.exec(html)?.[1] ?? "";
    expect(nav).toContain("1.7 Doc-state sugar");
    expect(nav).toContain("A level-6 heading"); // rank 6 > numberDepth 2: listed, unnumbered
    // The first citing site carries the citeref backlink id; the entry links back to it.
    expect(html).toContain(
      '<a id="citeref-1" href="#bib-knuth84" class="nota-cite">[1]</a>'
    );
    expect(html).toMatch(
      /<li id="bib-knuth84">Knuth\. The TeXbook\. 1984\. <a href="#citeref-1" class="nota-citebacklink">↩<\/a><\/li>/
    );
  });

  // BUG (reader↔runtime seam, found 2026-08-16): a markup-valued prop on a HOST element —
  // mega's `@figure[cap:@em{a caption}]` — serializes the compiled SSR chunk *unescaped* into
  // the attribute value:
  //   <figure data-hk="…" cap="<em data-hk="…">a caption</em>">
  // The inner quotes terminate the attribute — malformed HTML (a browser reparses the tail as
  // junk attributes/text). Solid's `escape()` passes non-string values through (by design, for
  // chunks in *content* position), so the emit/runtime needs to stringify-or-reject markup
  // values headed for a host attribute. Not test-side-fixable; pinned here.
  it.todo(
    "markup-valued prop on a HOST element should escape/stringify into the attribute (currently emits the raw SSR chunk)"
  );
});

describe("the argv shell", () => {
  const run = (args: string[], cwd?: string) => {
    const res = spawnSync("node", [BIN, ...args], { encoding: "utf8", cwd });
    return { status: res.status, stdout: res.stdout, stderr: res.stderr };
  };

  it("no arguments: usage on stdout, exit 1", () => {
    const r = run([]);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("Usage:");
    expect(r.stdout).toContain("nota build <doc.nota>");
  });

  it("--help / -h: usage on stdout, exit 0", () => {
    for (const flag of ["--help", "-h"]) {
      const r = run([flag]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("Usage:");
    }
  });

  it("unknown command: named on stderr, exit 1", () => {
    const r = run(["frobnicate", "x.nota"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain('unknown command "frobnicate"');
    expect(r.stderr).toContain("Usage:");
  });

  it("build without input: missing-input on stderr, exit 1", () => {
    const r = run(["build"]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("missing input file");
  });

  it("build with a nonexistent input: build-failed on stderr, exit 1", () => {
    const r = run(["build", join(outDir, "definitely-missing.nota")]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("build failed");
    expect(r.stderr).toContain("input file not found");
  });

  it("an unrecognized flag is read as the input positional (pinned wart)", () => {
    // The hand-rolled parser has no unknown-option diagnostic: `--dev` (not an argv flag,
    // though BuildOptions.dev exists programmatically) falls through to the positionals and
    // becomes the input path. Pinned so a future `unknown option` diagnostic shows up here.
    const r = run(["build", "--dev", MEGA]);
    expect(r.status).toBe(1);
    expect(r.stderr).toContain("input file not found: --dev");
  });

  it("default out dir is the input minus extension; --title sets <title>", () => {
    const dir = mkdtempSync(join(tmpdir(), "nota-argv-"));
    try {
      writeFileSync(join(dir, "doc.nota"), "Just *text*.\n", "utf8");
      const r = run(
        ["build", "doc.nota", "--static", "--title", "My Doc"],
        dir
      );
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("zero-JS (static)");
      const page = join(dir, "doc", "index.html");
      expect(existsSync(page)).toBe(true);
      expect(readFileSync(page, "utf8")).toContain("<title>My Doc</title>");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
