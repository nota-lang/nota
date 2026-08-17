/**
 * The Barnes-Hut diagram as one declarative Solid component. d3 supplies the math (d3-force
 * for the layout physics, d3-quadtree via ./quadtree for the spatial index); Solid owns the
 * DOM: every layer of the SVG is a memo over the reactive inputs, so the component has no
 * update methods — the document just changes state, exactly like the prose does.
 *
 * Reactive props (all driven live by the document):
 * - `size`       inserted-point count 0..77 — the quadtree-construction step;
 * - `theta`      the Barnes-Hut θ threshold for force estimation;
 * - `charge`     force strength (negative repels, positive attracts);
 * - `layout`     run the live force-directed layout (nodes draggable);
 * - `estimate`   show the force-estimation probe (click/drag to move it);
 * - `accumulate` a counter — each bump replays the center-of-mass animation.
 *
 * SSR-safe by construction: the settled layout is deterministic, the simulation only starts
 * in `onMount`, and every animation is CSS driven by state, so the server and the client
 * render the same bytes and the static page is a faithful still.
 */

import type { ForceManyBody } from "d3-force";
import {
  batch,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  onMount,
  Show
} from "solid-js";
import { createStore } from "solid-js/store";
import { type BodyNode, CENTER, SIZE, settledNetwork } from "./network";
import {
  accumulate as accumulateMass,
  type Box,
  buildTree,
  type ComCell,
  cellBoxes,
  comGroups,
  estimateAt,
  insertionStep,
  type Pt
} from "./quadtree";

export interface BarnesHutProps {
  size: number;
  theta: number;
  charge: number;
  layout: boolean;
  estimate: boolean;
  accumulate?: number;
}

const BASE_RADIUS = 4;
const DEFAULT_PROBE: Pt = { x: CENTER + 64, y: CENTER + 64 };
/** Per-depth-group stage length of the accumulation animation (ms). */
const ACCUM_STEP = 1400;

export function BarnesHut(props: BarnesHutProps): JSX.Element {
  const net = settledNetwork();

  // Positions as a fine-grained store the simulation writes into on each tick.
  const [pts, setPts] = createStore(net.nodes.map(n => ({ x: n.x, y: n.y })));
  const syncPts = () =>
    batch(() => {
      for (let i = 0; i < net.nodes.length; i++) {
        setPts(i, "x", net.nodes[i].x);
        setPts(i, "y", net.nodes[i].y);
      }
    });

  const step = () =>
    Math.max(0, Math.min(Math.floor(props.size), net.nodes.length));

  // ------------------------------------------------------------------ the live simulation
  onMount(() => {
    net.simulation.on("tick", syncPts);
    if (props.layout) {
      net.simulation.alpha(0.3).restart();
    }
    onCleanup(() => net.simulation.stop());
  });

  createEffect(
    on(
      () => props.layout,
      run => {
        if (run) {
          net.simulation.alpha(0.5).alphaTarget(0).restart();
        } else {
          net.simulation.stop();
        }
      },
      { defer: true }
    )
  );

  createEffect(
    on(
      () => props.charge,
      c => {
        (net.simulation.force("charge") as ForceManyBody<BodyNode>).strength(c);
        if (props.layout) {
          net.simulation.alpha(0.5).alphaTarget(0).restart();
        }
      },
      { defer: true }
    )
  );

  // ------------------------------------------------------------------ pointer interaction
  let svgEl!: SVGSVGElement;
  const toLocal = (e: PointerEvent): Pt => {
    const ctm = svgEl.getScreenCTM();
    if (!ctm) {
      return { x: 0, y: 0 };
    }
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  };

  // Node dragging (layout mode).
  const dragNode = (node: BodyNode, e: PointerEvent) => {
    if (!props.layout) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const el = e.currentTarget as SVGCircleElement;
    el.setPointerCapture(e.pointerId);
    net.simulation.alphaTarget(0.3).restart();
    const move = (ev: PointerEvent) => {
      const p = toLocal(ev);
      node.fx = p.x;
      node.fy = p.y;
    };
    const up = () => {
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      net.simulation.alphaTarget(0);
      node.fx = null;
      node.fy = null;
    };
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    move(e);
  };

  // The estimation probe (estimate mode): click or drag anywhere.
  const [probe, setProbe] = createSignal<Pt>(DEFAULT_PROBE);
  const probeDown = (e: PointerEvent) => {
    if (!props.estimate) {
      return;
    }
    e.preventDefault();
    svgEl.setPointerCapture(e.pointerId);
    setProbe(toLocal(e));
    const move = (ev: PointerEvent) => setProbe(toLocal(ev));
    const up = () => {
      svgEl.removeEventListener("pointermove", move);
      svgEl.removeEventListener("pointerup", up);
    };
    svgEl.addEventListener("pointermove", move);
    svgEl.addEventListener("pointerup", up);
  };
  createEffect(
    on(
      () => props.estimate,
      active => {
        if (!active) {
          setProbe(DEFAULT_PROBE);
        }
      },
      { defer: true }
    )
  );

  // ------------------------------------------------------------------ derived geometry
  /** The construction-phase tree: the first `size` points, with the step's new cells. */
  const construction = createMemo(() => {
    if (props.estimate || step() === 0) {
      return undefined;
    }
    const points = pts.slice(0, step()).map(p => ({ x: p.x, y: p.y }));
    return insertionStep(points, points.length);
  });

  /** The estimation-phase tree: all points, accumulated, probed at θ. */
  const estimation = createMemo(() => {
    if (!props.estimate) {
      return undefined;
    }
    const tree = accumulateMass(buildTree(pts.map(p => ({ x: p.x, y: p.y }))));
    return {
      boxes: cellBoxes(tree),
      result: estimateAt(tree, probe(), props.theta)
    };
  });

  // ------------------------------------------------------------ the accumulation animation
  const [accumStage, setAccumStage] = createSignal(-1);
  const [accumShown, setAccumShown] = createSignal(false);
  const [gathered, setGathered] = createSignal(false);
  const accumGroupsMemo = createMemo<ComCell[][]>(() => {
    if (!accumShown()) {
      return [];
    }
    const tree = accumulateMass(buildTree(pts.map(p => ({ x: p.x, y: p.y }))));
    return comGroups(tree);
  });
  let timers: ReturnType<typeof setTimeout>[] = [];
  const clearTimers = () => {
    for (const t of timers) {
      clearTimeout(t);
    }
    timers = [];
  };
  onCleanup(clearTimers);

  createEffect(
    on(
      () => props.accumulate,
      () => {
        clearTimers();
        setAccumShown(true);
        setAccumStage(-1);
        const groups = accumGroupsMemo();
        groups.forEach((_, i) => {
          timers.push(
            setTimeout(
              () => {
                batch(() => {
                  setGathered(false);
                  setAccumStage(i);
                });
                timers.push(setTimeout(() => setGathered(true), 60));
              },
              600 + i * ACCUM_STEP
            )
          );
        });
        timers.push(
          setTimeout(
            () => setAccumStage(groups.length),
            600 + groups.length * ACCUM_STEP + 800
          )
        );
      },
      { defer: true }
    )
  );
  // Any other phase change dismisses the accumulation overlay.
  createEffect(
    on(
      [() => props.estimate, () => props.layout, step],
      () => {
        clearTimers();
        setAccumShown(false);
        setAccumStage(-1);
      },
      { defer: true }
    )
  );

  /** The full-tree cell boxes shown while the accumulation overlay is up. */
  const accumBoxes = createMemo<Box[]>(() => {
    if (!accumShown()) {
      return [];
    }
    return cellBoxes(buildTree(pts.map(p => ({ x: p.x, y: p.y }))));
  });

  // ------------------------------------------------------------------ display rules
  const quadBoxes = createMemo<Box[]>(() => {
    const est = estimation();
    if (est) {
      return est.boxes;
    }
    if (accumShown()) {
      return accumBoxes();
    }
    const c = construction();
    return c ? cellBoxes(c.tree) : [];
  });

  const nodeOpacity = (i: number): number => {
    if (props.estimate || accumShown()) {
      return 0.25;
    }
    if (props.layout) {
      return 1;
    }
    if (step() > 0) {
      return i < step() ? 1 : 0.25;
    }
    return 0.25;
  };

  const radius = (v: number) => BASE_RADIUS * (Math.sqrt(v) || 1);
  const lineWidth = (s: number) => Math.max(1, Math.min(5, s || 1));

  const forceTip = createMemo<Pt | undefined>(() => {
    const est = estimation();
    if (!est) {
      return undefined;
    }
    const p = probe();
    return { x: p.x - est.result.fx * 90, y: p.y - est.result.fy * 90 };
  });

  // ------------------------------------------------------------------ render
  return (
    <svg
      ref={svgEl}
      class="bh"
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Barnes-Hut diagram: a force-directed network over a quadtree"
      onPointerDown={probeDown}
      data-estimating={props.estimate ? "" : undefined}
      data-laying-out={props.layout ? "" : undefined}
    >
      {/* links */}
      <g class="bh-links">
        <For each={net.links}>
          {l => (
            <line
              x1={pts[l.source.index].x}
              y1={pts[l.source.index].y}
              x2={pts[l.target.index].x}
              y2={pts[l.target.index].y}
            />
          )}
        </For>
      </g>

      {/* quadtree cells */}
      <g class="bh-quads">
        <For each={quadBoxes()}>
          {b => <rect x={b.x + 0.5} y={b.y + 0.5} width={b.w} height={b.h} />}
        </For>
      </g>

      {/* insertion flash: the cells the newest point created, keyed by step so the
          animation replays on every slider move */}
      <Show when={construction()?.inserted !== undefined && step()} keyed>
        <g class="bh-insertion">
          <For each={construction()?.newBoxes ?? []}>
            {b => (
              <rect
                class="bh-flash-box"
                x={b.x}
                y={b.y}
                width={b.w}
                height={b.h}
              />
            )}
          </For>
          <circle
            class="bh-inserted"
            cx={construction()?.inserted?.x}
            cy={construction()?.inserted?.y}
            r={BASE_RADIUS}
          />
        </g>
      </Show>

      {/* force-component lines (under the nodes, like LP's lg layer) */}
      <Show when={estimation()}>
        {est => (
          <g class="bh-forces">
            <For each={est().result.boxes}>
              {b => (
                <rect
                  class="bh-used-cell"
                  x={b.x}
                  y={b.y}
                  width={b.w}
                  height={b.h}
                />
              )}
            </For>
            <For each={est().result.charges}>
              {c => (
                <line
                  class="bh-force-line"
                  x1={c.x}
                  y1={c.y}
                  x2={probe().x}
                  y2={probe().y}
                  stroke-width={lineWidth(c.s)}
                />
              )}
            </For>
          </g>
        )}
      </Show>

      {/* the bodies */}
      <g class="bh-nodes">
        <For each={pts}>
          {(p, i) => (
            <circle
              cx={p.x}
              cy={p.y}
              r={BASE_RADIUS}
              fill-opacity={nodeOpacity(i())}
              onPointerDown={e => dragNode(net.nodes[i()], e)}
            />
          )}
        </For>
      </g>

      {/* the masses considered, the probe, and the net force */}
      <Show when={estimation()}>
        {est => (
          <g class="bh-probe-layer">
            <For each={est().result.charges}>
              {c => (
                <circle class="bh-charge" cx={c.x} cy={c.y} r={radius(c.v)} />
              )}
            </For>
            <Show when={forceTip()}>
              {tip => (
                <line
                  class="bh-force-vector"
                  x1={probe().x}
                  y1={probe().y}
                  x2={tip().x}
                  y2={tip().y}
                />
              )}
            </Show>
            <circle
              class="bh-probe"
              cx={probe().x}
              cy={probe().y}
              r={BASE_RADIUS}
            />
          </g>
        )}
      </Show>

      {/* the center-of-mass accumulation animation */}
      <Show when={accumShown()}>
        <g class="bh-accum">
          {/* centers of mass from completed stages persist, dimmed */}
          <For each={accumGroupsMemo().slice(0, Math.max(0, accumStage()))}>
            {group => (
              <For each={group}>
                {cell => (
                  <circle
                    class="bh-com-done"
                    cx={cell.x}
                    cy={cell.y}
                    r={radius(cell.value)}
                  />
                )}
              </For>
            )}
          </For>
          {/* the active stage, keyed so its animations replay per stage */}
          <Show
            when={
              accumStage() >= 0 && accumStage() < accumGroupsMemo().length
                ? accumStage() + 1
                : undefined
            }
            keyed
          >
            <For each={accumGroupsMemo()[accumStage()]}>
              {cell => (
                <g>
                  <rect
                    class="bh-flash-box"
                    x={cell.box.x}
                    y={cell.box.y}
                    width={cell.box.w}
                    height={cell.box.h}
                  />
                  <For each={cell.children}>
                    {ch => (
                      <circle
                        class="bh-gather"
                        cx={gathered() ? cell.x : ch.x}
                        cy={gathered() ? cell.y : ch.y}
                        r={radius(ch.value)}
                      />
                    )}
                  </For>
                  <circle
                    class="bh-com-pop"
                    cx={cell.x}
                    cy={cell.y}
                    r={radius(cell.value)}
                  />
                </g>
              )}
            </For>
          </Show>
        </g>
      </Show>
    </svg>
  );
}
