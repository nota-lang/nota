/**
 * The BarnesHut component through the SSG driver: every document phase SSRs deterministically
 * (no DOM, no timers, byte-identical repeat renders — the hydration-parity precondition), and
 * each phase bakes the layers the prose promises. Live behavior (simulation ticks, dragging,
 * probe moves, the accumulation animation) is exercised in the built page by the e2e test.
 */
import { NotaDoc, renderDocument } from "@nota-lang/core";
import { describe, expect, test } from "vitest";
import { BarnesHut } from "../src/barnes-hut";
import { NODE_COUNT } from "../src/network";

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

const render = (p: {
  size?: number;
  theta?: number;
  charge?: number;
  layout?: boolean;
  estimate?: boolean;
}) =>
  renderDocument(() => (
    <NotaDoc>
      <BarnesHut
        size={p.size ?? 0}
        theta={p.theta ?? 0}
        charge={p.charge ?? -30}
        layout={p.layout ?? true}
        estimate={p.estimate ?? false}
        accumulate={0}
      />
    </NotaDoc>
  )).html;

describe("BarnesHut SSR", () => {
  test("initial network phase: all nodes and links, no quadtree", () => {
    const html = render({ layout: true });
    expect(count(html, /<circle /g)).toBe(NODE_COUNT);
    expect(count(html, /<line /g)).toBe(254);
    expect(count(html, /<rect /g)).toBe(0);
    expect(html).toContain('fill-opacity="1"');
  });

  test("repeat renders are byte-identical (deterministic settle)", () => {
    expect(render({ layout: true })).toBe(render({ layout: true }));
  });

  test("the initial settled layout uses the requested charge", () => {
    expect(render({ layout: true, charge: -100 })).not.toBe(
      render({ layout: true, charge: -30 })
    );
  });

  test("construction phase: quadtree cells, insertion flash, dimmed tail", () => {
    const html = render({ size: 5, layout: false });
    // Cells drawn (root + splits), the flash layer, and the newest point's pop.
    expect(count(html, /<rect /g)).toBeGreaterThan(4);
    expect(html).toContain('class="bh-insertion"');
    expect(html).toContain('class="bh-inserted"');
    // Inserted points are full-strength, the rest dimmed.
    expect(html).toContain('fill-opacity="1"');
    expect(html).toContain('fill-opacity="0.25"');
  });

  test("estimation phase: probe, force vector, considered masses", () => {
    const html = render({ estimate: true, theta: 1, layout: false });
    expect(html).toContain('class="bh-probe"');
    expect(html).toContain('class="bh-force-vector"');
    expect(count(html, /class="bh-charge"/g)).toBeGreaterThan(0);
    expect(count(html, /class="bh-force-line"/g)).toBeGreaterThan(0);
    // θ=1 approximates: some considered masses are cells, i.e. fewer than N charges.
    expect(count(html, /class="bh-charge"/g)).toBeLessThan(NODE_COUNT);
    expect(count(html, /class="bh-used-cell"/g)).toBeGreaterThan(0);
  });

  test("θ=0 estimation considers every point individually", () => {
    const html = render({ estimate: true, theta: 0, layout: false });
    expect(count(html, /class="bh-charge"/g)).toBe(NODE_COUNT);
    expect(count(html, /class="bh-used-cell"/g)).toBe(0);
  });
});
