/**
 * **The 2026-08 prose-sugar surface, executed** — build `integration/prose-sugars.nota` through
 * the CLI static path and assert the *rendered HTML* for each sugar. The fixture is pinned as
 * emitted text elsewhere (reader goldens, codemirror span slices — do not edit it); this suite
 * closes the reader↔runtime seam: the sugars must also *render* right.
 */

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { buildNotaFile } from "../src/build";

const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, "..");
const integrationDir = join(here, "..", "..", "..", "integration");

const tmpBase = mkdtempSync(join(tmpdir(), "nota-sugars-test-"));
afterAll(() => rmSync(tmpBase, { recursive: true, force: true }));

const clean = (h: string) =>
  h.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

let html = "";
beforeAll(async () => {
  const out = await buildNotaFile(join(integrationDir, "prose-sugars.nota"), {
    resolveFrom: pkgRoot,
    outDir: join(tmpBase, "sugars"),
    static: true
  });
  html = clean(out.html);
});

describe("prose sugars render", () => {
  test("~~strike~~ and the --- thematic break render as <s> / <hr>", () => {
    expect(html).toContain("<s>struck</s>");
    expect(html).toContain("<hr>");
  });

  test("comments leave no phantom paragraph break", () => {
    // The comment-only first line is consumed with its newline: the document opens straight
    // into the section — no paragraph precedes the heading.
    expect(html).toMatch(
      /<article class="nota-doc"><section class="nota-section"><h1/
    );
    // The interior block comment merges its neighbors into ONE paragraph…
    const first = /<p class="nota-para">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? "";
    expect(first).toContain("stay literal prose.");
    expect(first).toContain("// stays literal slashes");
    // …and exactly three paragraphs form (intro, smart-punct, closing) — a phantom break
    // anywhere would split one and bump the count.
    expect(html.match(/<p class="nota-para/g)).toHaveLength(3);
    // No comment text leaks (line, block — nested — or trailing-in-item).
    expect(html).not.toContain("comment-only line");
    expect(html).not.toContain("a nested");
    expect(html).not.toContain("trailing comment");
  });

  test("escapes render the literal characters", () => {
    expect(html).toContain(
      "// stays literal slashes, ~~ stays tildes, [not: attrs]."
    );
  });

  test("heading attrs hoist onto the <h1>", () => {
    expect(html).toMatch(/<h1[^>]*id="sugars"[^>]*class="demo\b[^"]*"/);
    expect(html).toContain(">Prose sugars</h1>");
  });

  test("list-item attrs land on the <li>", () => {
    expect(html).toMatch(/<li class="hot ?" data-list="ul">item one<\/li>/);
    expect(html).toMatch(/<li data-list="ul">item <s>two<\/s><\/li>/);
  });

  test("paragraph attrs group joins the formed <p>'s class — the marker never renders", () => {
    expect(html).toMatch(
      /<p class="nota-para note\s*">A closing paragraph with attrs\./
    );
    // The <Attrs> marker is stripped by Reforest: no remnant, no literal tag, no source text.
    expect(html).not.toContain("data-nota-attrs");
    expect(html).not.toContain("<Attrs");
    expect(html).not.toContain('[class: "note"]');
  });

  test("smart punctuation transforms prose but leaves code/math raw", () => {
    // Curly quotes/apostrophe, en/em dashes (spacing untouched), ellipsis — and the source's
    // literal em dash is a fixed point, spacing included.
    expect(html).toContain(
      "material — “quotes”, ‘singles’, it’s 5 – or 6 — dots…"
    );
    // Inside `code` and $math$ the same characters stay raw (excluded regions).
    expect(html).toContain('>"code" -- ...</code>');
    expect(html).toContain(
      '<annotation encoding="application/x-tex">a -- b</annotation>'
    );
  });

  test("links/images are element forms; markdown shapes stay literal prose", () => {
    expect(html).toMatch(
      /<a href="https:\/\/example\.com\/a_b">the\n<strong>docs<\/strong><\/a>/
    );
    expect(html).toMatch(/<img src="sample\.svg" alt="An owl">/);
    expect(html).toContain("[these](here.html) stay literal prose.");
  });
});
