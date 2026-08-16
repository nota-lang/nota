/**
 * The integration e2e: a real `astro build` over the fixture site (two pages importing the same
 * `.nota` document — one `client:load` island, one static), then assertions on the emitted HTML:
 *
 * - **hydrated page**: an `<astro-island>` carrying the renderId + converged doc-state snapshot
 *   as attributes, renderId-prefixed hydration keys, Solid's hydration bootstrap in `<head>`,
 *   and the forward Toc resolved in the static bytes;
 * - **static page**: the same converged document with NO island, NO hydration keys, and NO
 *   scripts — the zero-JS story as a per-page choice.
 */

import { readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, test } from "vitest";

const site = fileURLToPath(new URL("./fixtures/site/", import.meta.url));

let hydrated = "";
let staticPage = "";

/** Decode the entity escaping Astro applies to attribute values. */
const decodeAttr = (s: string): string =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

beforeAll(async () => {
  process.env.ASTRO_TELEMETRY_DISABLED = "1";
  rmSync(join(site, "dist"), { recursive: true, force: true });
  const { build } = await import("astro");
  await build({ root: site, logLevel: "error" });
  hydrated = readFileSync(join(site, "dist/index.html"), "utf8");
  staticPage = readFileSync(join(site, "dist/static/index.html"), "utf8");
}, 240_000);

describe("hydrated page (client:load island)", () => {
  test("the document renders inside an astro-island with the renderer's attrs", () => {
    expect(hydrated).toContain("<astro-island");
    expect(hydrated).toContain('data-nota-render-id="n0"');
    expect(hydrated).toMatch(/<article[^>]*class="nota-doc"/);
  });

  test("hydration keys are renderId-scoped and the bootstrap script rides in head", () => {
    expect(hydrated).toMatch(/data-hk="n00/);
    expect(hydrated).toContain("_$HY"); // generateHydrationScript via renderHydrationScript
  });

  test("the doc-state snapshot round-trips through the island attribute", () => {
    const m = /data-nota-doc-state="([^"]*)"/.exec(hydrated);
    expect(m).toBeTruthy();
    const state = JSON.parse(decodeAttr((m as RegExpExecArray)[1])) as Record<
      string,
      { title?: string }[]
    >;
    expect(state.heading?.map(h => h.title)).toEqual([
      "Introduction",
      "Usage"
    ]);
  });

  test("forward references are resolved in the static bytes (two-pass)", () => {
    const nav = /<nav[^>]*class="nota-toc"[^>]*>([\s\S]*?)<\/nav>/.exec(hydrated);
    expect(nav).toBeTruthy();
    expect((nav as RegExpExecArray)[1]).toContain("Introduction");
    expect((nav as RegExpExecArray)[1]).toContain("Usage");
    expect(hydrated.indexOf("<nav")).toBeLessThan(
      hydrated.indexOf('id="introduction"')
    );
  });
});

describe("static page (no directive)", () => {
  test("zero-JS: no island, no hydration keys, no scripts", () => {
    expect(staticPage).not.toContain("<astro-island");
    expect(staticPage).not.toContain("data-hk=");
    expect(staticPage).not.toContain("<script");
  });

  test("the document is still converged: forward Toc resolved, sections numbered", () => {
    const nav = /<nav[^>]*class="nota-toc"[^>]*>([\s\S]*?)<\/nav>/.exec(staticPage);
    expect(nav).toBeTruthy();
    expect((nav as RegExpExecArray)[1]).toContain("Usage");
    expect(staticPage.indexOf("<nav")).toBeLessThan(
      staticPage.indexOf('id="introduction"')
    );
    expect(staticPage).toContain("nota-secnum");
  });
});
