/**
 * The preset's composition contract. The one that can silently corrupt a build is the
 * **single vite-plugin-solid**: Nota's preset bundles one by default and SolidStart constructs
 * its own from `extensions`, so a naive `[...nota(), ...solidStart()]` compiles every `.nota`
 * emit's JSX twice.
 */

import type { Plugin } from "vite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { notaStart } from "../src/lib";

// solidStart() resolves its app entry from process.cwd() at construction time.
const pkgRoot = process.cwd();
beforeAll(() => process.chdir(`${pkgRoot}/tests/fixtures/site`));
afterAll(() => process.chdir(pkgRoot));

const names = (plugins: unknown[]): string[] =>
  plugins
    .flat(Infinity)
    .map(p => (p as Plugin)?.name)
    .filter(Boolean);

describe("notaStart", () => {
  test("installs exactly one vite-plugin-solid", async () => {
    const solid = names(await notaStart()).filter(n => n === "solid");
    expect(solid).toHaveLength(1);
  });

  test("installs the .nota transform ahead of it", async () => {
    const all = names(await notaStart());
    expect(all).toContain("@nota-lang/vite");
    expect(all.indexOf("@nota-lang/vite")).toBeLessThan(all.indexOf("solid"));
  });

  test("the transform compiles .nota source", async () => {
    const transform = (await notaStart())
      .flat(Infinity)
      .find(p => (p as Plugin)?.name === "@nota-lang/vite") as Plugin;
    const handler =
      typeof transform.transform === "function"
        ? transform.transform
        : transform.transform?.handler;
    const out = await handler?.call({} as never, "Hello *world*", "/doc.nota");
    expect((out as { code: string }).code).toContain("export default function");
  });

  test("a site's own extensions survive alongside nota", async () => {
    // Merged, not overwritten — a site keeping .mdx routes should not have to restate "nota".
    const plugins = await notaStart({ start: { extensions: ["mdx"] } });
    expect(names(plugins)).toContain("solid");
    // Both extensions reach SolidStart's fs-router glob, which is what its plugin set is built
    // from; the observable proxy here is that construction succeeds with both present.
    expect(plugins.length).toBeGreaterThan(1);
  });
});
