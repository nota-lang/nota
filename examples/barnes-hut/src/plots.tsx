/** Interactive Solid SVG charts over the recorded Barnes-Hut benchmarks. */

import {
  createMemo,
  createSignal,
  For,
  Index,
  type JSX,
  type ParentProps,
  Show
} from "solid-js";
import { PERFORMANCE } from "./performance-data";

export interface ThetaSeries {
  theta: number;
  label: string;
  color: string;
}

export const THETA_SERIES: ThetaSeries[] = [
  { theta: 0, label: "Naïve", color: "#0d366b" },
  { theta: 0.5, label: "θ = 0.5", color: "#1c5cab" },
  { theta: 1, label: "θ = 1", color: "#3987e5" },
  { theta: 1.5, label: "θ = 1.5", color: "#86b6ef" }
];

export const seriesFor = (theta: number): ThetaSeries | undefined =>
  THETA_SERIES.find(s => s.theta === theta);

export interface FocusProps {
  focus: number | null;
  setFocus: (theta: number | null) => void;
}

/** Inline prose reference that focuses the matching chart series on hover. */
export function ThetaRef(
  props: ParentProps & FocusProps & { theta: number }
): JSX.Element {
  const color = () => seriesFor(props.theta)?.color ?? "currentColor";
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover-to-focus is a redundant enhancement; the chart legends expose the same control as keyboard-reachable buttons
    <span
      class="theta-ref"
      classList={{ "is-focused": props.focus === props.theta }}
      style={{ "--series-color": color() }}
      onMouseEnter={() => props.setFocus(props.theta)}
      onMouseLeave={() => props.setFocus(null)}
    >
      <span class="theta-ref-swatch" aria-hidden="true" />
      {props.children}
    </span>
  );
}

const W = 640;
const H = 230;
const M = { top: 30, right: 70, bottom: 34, left: 46 };
const IW = W - M.left - M.right;
const IH = H - M.top - M.bottom;

const NODE_COUNTS = [...new Set(PERFORMANCE.map(d => d.nodes))].sort(
  (a, b) => a - b
);

interface Scale {
  (v: number): number;
  ticks: number[];
}

function linearScale(
  domain: [number, number],
  range: [number, number],
  ticks: number[]
): Scale {
  const f = (v: number) =>
    range[0] +
    ((v - domain[0]) / (domain[1] - domain[0])) * (range[1] - range[0]);
  return Object.assign(f, { ticks });
}

const fmtCount = (n: number) => n.toLocaleString("en-US");

interface PlotDef {
  title: string;
  metric: (d: { time: number; error: number }) => number;
  thetas: number[];
  y: Scale;
  yFormat: (v: number) => string;
  tooltipFormat: (v: number) => string;
}

const TIME_PLOT: PlotDef = {
  title: "Average running time (milliseconds)",
  metric: d => d.time,
  thetas: [0, 0.5, 1, 1.5],
  y: linearScale([0, 200], [IH, 0], [0, 50, 100, 150, 200]),
  yFormat: v => `${v}`,
  tooltipFormat: v => `${v.toFixed(1)} ms`
};

const ERROR_PLOT: PlotDef = {
  title: "Average error, relative to naïve calculation (pixels)",
  metric: d => d.error,
  thetas: [0.5, 1, 1.5],
  y: linearScale([0.048, 0.056], [IH, 0], [0.048, 0.05, 0.052, 0.054, 0.056]),
  yFormat: v => v.toFixed(3),
  tooltipFormat: v => `${v.toFixed(4)} px`
};

const X = linearScale([0, 10000], [0, IW], [0, 2000, 4000, 6000, 8000, 10000]);

function seriesPoints(def: PlotDef, theta: number): [number, number][] {
  return PERFORMANCE.filter(d => d.theta === theta).map(d => [
    d.nodes,
    def.metric(d)
  ]);
}

function pathOf(def: PlotDef, pts: [number, number][]): string {
  return pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${X(x)},${def.y(y)}`)
    .join("");
}

function LinePlot(props: FocusProps & { def: PlotDef }): JSX.Element {
  const series = () =>
    THETA_SERIES.filter(s => props.def.thetas.includes(s.theta));
  const lines = createMemo(() =>
    series().map(s => {
      const pts = seriesPoints(props.def, s.theta);
      return { s, pts, d: pathOf(props.def, pts), end: pts[pts.length - 1] };
    })
  );
  const dimmed = (theta: number) =>
    props.focus !== null && props.focus !== theta;

  // Spread colliding end labels vertically.
  const labelYs = createMemo<Map<number, number>>(() => {
    const entries = lines()
      .map(l => ({ theta: l.s.theta, y: props.def.y(l.end[1]) }))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < entries.length; i++) {
      const prev = entries[i - 1];
      if (entries[i].y - prev.y < 14) {
        entries[i].y = prev.y + 14;
      }
    }
    return new Map(entries.map(e => [e.theta, e.y]));
  });

  const [cursor, setCursor] = createSignal<number | null>(null);
  const onMove = (e: PointerEvent) => {
    const svg = e.currentTarget as SVGSVGElement;
    const ctm = svg.getScreenCTM();
    if (!ctm) {
      return;
    }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    const x = p.x - M.left;
    if (x < -8 || x > IW + 8) {
      setCursor(null);
      return;
    }
    let best = NODE_COUNTS[0];
    for (const n of NODE_COUNTS) {
      if (Math.abs(X(n) - x) < Math.abs(X(best) - x)) {
        best = n;
      }
    }
    setCursor(best);
  };
  const readout = createMemo(() => {
    const n = cursor();
    if (n === null) {
      return null;
    }
    return {
      nodes: n,
      rows: lines().map(l => ({
        s: l.s,
        value: l.pts.find(([x]) => x === n)?.[1] ?? 0
      }))
    };
  });

  return (
    <figure class="plot">
      <div class="plot-legend">
        <For each={series()}>
          {s => (
            <button
              type="button"
              class="plot-legend-item"
              classList={{ "is-dimmed": dimmed(s.theta) }}
              onMouseEnter={() => props.setFocus(s.theta)}
              onMouseLeave={() => props.setFocus(null)}
              onFocus={() => props.setFocus(s.theta)}
              onBlur={() => props.setFocus(null)}
            >
              <span
                class="plot-legend-key"
                style={{ background: s.color }}
                aria-hidden="true"
              />
              {s.label}
            </button>
          )}
        </For>
      </div>
      <svg
        class="plot-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={props.def.title}
        onPointerMove={onMove}
        onPointerLeave={() => setCursor(null)}
      >
        <text class="plot-title" x={0} y={14}>
          {props.def.title}
        </text>
        <g transform={`translate(${M.left},${M.top})`}>
          <For each={props.def.y.ticks}>
            {t => (
              <g transform={`translate(0,${props.def.y(t)})`}>
                <line class="plot-grid" x1={0} x2={IW} />
                <text class="plot-tick plot-tick-y" x={-8} y={4}>
                  {props.def.yFormat(t)}
                </text>
              </g>
            )}
          </For>
          <For each={X.ticks}>
            {t => (
              <text class="plot-tick plot-tick-x" x={X(t)} y={IH + 20}>
                {fmtCount(t)}
              </text>
            )}
          </For>
          <line class="plot-baseline" x1={0} x2={IW} y1={IH} y2={IH} />
          <text class="plot-axis-label" x={IW / 2} y={IH + 33}>
            Number of points
          </text>

          <Show when={cursor() !== null}>
            <line
              class="plot-crosshair"
              x1={X(cursor() as number)}
              x2={X(cursor() as number)}
              y1={0}
              y2={IH}
            />
          </Show>

          <For each={lines()}>
            {l => (
              // biome-ignore lint/a11y/noStaticElementInteractions: line hover mirrors the keyboard-reachable legend buttons
              <g
                class="plot-series"
                classList={{ "is-dimmed": dimmed(l.s.theta) }}
                onMouseEnter={() => props.setFocus(l.s.theta)}
                onMouseLeave={() => props.setFocus(null)}
              >
                <path class="plot-line-hit" d={l.d} />
                <path class="plot-line" d={l.d} stroke={l.s.color} />
                <circle
                  class="plot-end-dot"
                  cx={X(l.end[0])}
                  cy={props.def.y(l.end[1])}
                  r={4}
                  fill={l.s.color}
                />
                <Show
                  when={
                    Math.abs(
                      (labelYs().get(l.s.theta) ?? 0) - props.def.y(l.end[1])
                    ) > 5
                  }
                >
                  <line
                    class="plot-leader"
                    x1={X(l.end[0]) + 6}
                    y1={props.def.y(l.end[1])}
                    x2={X(l.end[0]) + 9}
                    y2={(labelYs().get(l.s.theta) ?? 0) - 4}
                  />
                </Show>
                <text
                  class="plot-end-label"
                  x={X(l.end[0]) + 10}
                  y={(labelYs().get(l.s.theta) ?? props.def.y(l.end[1])) + 4}
                >
                  {l.s.label}
                </text>
              </g>
            )}
          </For>

          <Show when={readout()}>
            {r => (
              <Index each={r().rows}>
                {row => (
                  <circle
                    class="plot-cursor-dot"
                    cx={X(r().nodes)}
                    cy={props.def.y(row().value)}
                    r={4}
                    fill={row().s.color}
                  />
                )}
              </Index>
            )}
          </Show>
        </g>
      </svg>

      <Show when={readout()}>
        {r => (
          <div
            class="plot-tooltip"
            style={{
              left: `${((M.left + X(r().nodes)) / W) * 100}%`,
              "--flip": X(r().nodes) > IW * 0.72 ? "1" : "0"
            }}
          >
            <div class="plot-tooltip-title">{fmtCount(r().nodes)} points</div>
            <For each={r().rows}>
              {row => (
                <div
                  class="plot-tooltip-row"
                  classList={{ "is-dimmed": dimmed(row.s.theta) }}
                >
                  <span
                    class="plot-legend-key"
                    style={{ background: row.s.color }}
                    aria-hidden="true"
                  />
                  <strong>{props.def.tooltipFormat(row.value)}</strong>
                  <span class="plot-tooltip-series">{row.s.label}</span>
                </div>
              )}
            </For>
          </div>
        )}
      </Show>
    </figure>
  );
}

export function TimePlot(props: FocusProps): JSX.Element {
  return (
    <LinePlot def={TIME_PLOT} focus={props.focus} setFocus={props.setFocus} />
  );
}

export function ErrorPlot(props: FocusProps): JSX.Element {
  return (
    <LinePlot def={ERROR_PLOT} focus={props.focus} setFocus={props.setFocus} />
  );
}
