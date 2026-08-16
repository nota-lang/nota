/**
 * The server entry's unit tests (ssr project): `check` dispatches EXACTLY on the vite
 * transform's brand (the emit's `export default function Doc(…)` followed by
 * `Doc.isNotaDoc = true;` — see @nota-lang/vite's transform), `renderToStaticMarkup` guards
 * against non-Nota components, and its two branches carry the documented shapes: static (no
 * directive) → NoHydration HTML with no attrs and no hydration keys; island (`client:*`) →
 * per-island renderId (n0, n1, … per render result) + the converged doc-state snapshot as
 * attributes, hydration keys scoped by the renderId.
 */
import { describe, expect, test } from "vitest";
import renderer from "../src/server";
import { Doc } from "./fixtures/doc";

/** Brand a component the way the `.nota` transform does (`Doc.isNotaDoc = true;`). */
const brand = (f: () => unknown) => Object.assign(f, { isNotaDoc: true });

const BrandedDoc = brand(() => Doc());

const ctx = () => ({ result: {} });

describe("check()", () => {
  test("true for a transform-branded document", async () => {
    expect(await renderer.check.call(ctx(), BrandedDoc)).toBe(true);
  });

  test("false for a plain Solid component function (falls through)", async () => {
    expect(await renderer.check.call(ctx(), () => null)).toBe(false);
    expect(await renderer.check.call(ctx(), Doc)).toBe(false); // unbranded document body
  });

  test("the brand is exact — truthy non-true does not count", async () => {
    expect(
      await renderer.check.call(
        ctx(),
        Object.assign(() => null, { isNotaDoc: 1 })
      )
    ).toBe(false);
  });

  test("false for non-functions", async () => {
    expect(await renderer.check.call(ctx(), undefined)).toBe(false);
    expect(await renderer.check.call(ctx(), null)).toBe(false);
    expect(await renderer.check.call(ctx(), "Doc")).toBe(false);
    expect(await renderer.check.call(ctx(), { isNotaDoc: true })).toBe(false);
  });
});

describe("renderToStaticMarkup()", () => {
  test("throws on a non-Nota component", async () => {
    await expect(
      renderer.renderToStaticMarkup.call(ctx(), () => null, {}, {})
    ).rejects.toThrow(
      "@nota-lang/astro: renderToStaticMarkup called on a non-Nota component"
    );
  });

  test("static branch (no directive): converged HTML, no attrs, no hydration keys", async () => {
    const res = await renderer.renderToStaticMarkup.call(
      ctx(),
      BrandedDoc,
      {},
      {}
    );
    expect(res.attrs).toBeUndefined();
    expect(res.html).toContain('class="nota-doc"');
    expect(res.html).not.toContain("data-hk=");
    // Forward Toc resolved in the static bytes.
    expect(res.html).toMatch(/<nav[^>]*class="toc"[^>]*>[\s\S]*Alpha/);
  });

  test("island branch: renderId n0/n1 per result, snapshot attr, scoped keys", async () => {
    const context = ctx();
    const meta = { hydrate: "load" };
    const first = await renderer.renderToStaticMarkup.call(
      context,
      BrandedDoc,
      {},
      {},
      meta
    );
    if (!first.attrs) throw new Error("island render carried no attrs");
    expect(first.attrs["data-nota-render-id"]).toBe("n0");
    const state = JSON.parse(first.attrs["data-nota-doc-state"]) as Record<
      string,
      { id?: string }[]
    >;
    expect(state.heading?.map(h => h.id)).toEqual(["alpha", "beta"]);
    expect(first.html).toContain('data-hk="n0');

    // Same render result → next island id; keys scoped to it.
    const second = await renderer.renderToStaticMarkup.call(
      context,
      BrandedDoc,
      {},
      {},
      meta
    );
    expect(second.attrs?.["data-nota-render-id"]).toBe("n1");
    expect(second.html).toContain('data-hk="n1');

    // A fresh render result (a new page) restarts the counter.
    const other = await renderer.renderToStaticMarkup.call(
      ctx(),
      BrandedDoc,
      {},
      {},
      meta
    );
    expect(other.attrs?.["data-nota-render-id"]).toBe("n0");
  });
});

describe("renderHydrationScript()", () => {
  test("emits Solid's hydration bootstrap", () => {
    expect(renderer.renderHydrationScript()).toContain("_$HY");
  });
});
