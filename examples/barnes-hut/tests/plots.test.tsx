/**
 * The performance figures through the SSG driver: both charts SSR deterministically with the
 * right series (the error plot omits the naïve baseline), ink-token end labels, legend
 * buttons for keyboard focus, and dimming driven by the shared focus value.
 */
import { NotaDoc, renderDocument } from "@nota-lang/core";
import { describe, expect, test } from "vitest";
import { ErrorPlot, THETA_SERIES, ThetaRef, TimePlot } from "../src/plots";

const count = (html: string, re: RegExp) => (html.match(re) ?? []).length;

const render = (focus: number | null) =>
  renderDocument(() => (
    <NotaDoc>
      <TimePlot focus={focus} setFocus={() => {}} />
      <ErrorPlot focus={focus} setFocus={() => {}} />
      {"Compare "}
      <ThetaRef theta={1} focus={focus} setFocus={() => {}}>
        {"θ = 1"}
      </ThetaRef>
      {" with the rest."}
    </NotaDoc>
  )).html;

describe("performance plots SSR", () => {
  test("time plot has all four series; error plot omits the naïve baseline", () => {
    const html = render(null);
    expect(count(html, /class="plot-line"/g)).toBe(4 + 3);
    expect(count(html, /class="plot-end-dot"/g)).toBe(7);
    // End labels present, series identified by text (never color alone).
    expect(count(html, />Naïve</g)).toBeGreaterThanOrEqual(2); // legend + end label
    expect(count(html, />θ = 1\.5</g)).toBeGreaterThanOrEqual(4);
    // Legend items are real buttons (keyboard-reachable focus control).
    expect(count(html, /<button[^>]*class="plot-legend-item[^"]*"/g)).toBe(7);
  });

  test("focus dims the other series in both charts and in prose", () => {
    const html = render(1);
    // 4+3 series, 2 of them (θ=1 in each chart) focused: 5 dimmed groups.
    expect(count(html, /plot-series is-dimmed/g)).toBe(5);
    expect(html).toContain("theta-ref is-focused");
  });

  test("prose reference wears ink + swatch, not colored text", () => {
    const html = render(null);
    expect(html).toMatch(
      /class="theta-ref[^"]*"[^>]*style="--series-color:#3987e5"/
    );
    expect(html).toContain('class="theta-ref-swatch"');
  });

  test("repeat renders are byte-identical", () => {
    expect(render(null)).toBe(render(null));
  });

  test("the ordinal ramp is monotone dark→light with θ", () => {
    const lum = (hex: string) =>
      Number.parseInt(hex.slice(1, 3), 16) +
      Number.parseInt(hex.slice(3, 5), 16) +
      Number.parseInt(hex.slice(5, 7), 16);
    const ls = THETA_SERIES.map(s => lum(s.color));
    expect([...ls].sort((a, b) => a - b)).toEqual(ls);
  });
});
