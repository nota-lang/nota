/**
 * The Barnes-Hut math, rendering-free: deterministic settled layout, center-of-mass
 * accumulation, subdivision boxes, insertion paths, force estimation (naïve agreement at
 * θ = 0, aggressive approximation at large θ), and the accumulation animation's groups.
 */
import { describe, expect, test } from "vitest";
import { CENTER, NODE_COUNT, settledNetwork } from "../src/network";
import {
  accumulate,
  buildTree,
  cellBoxes,
  comGroups,
  estimateAt,
  insertionStep
} from "../src/quadtree";

describe("settledNetwork", () => {
  test("is deterministic and centered", () => {
    const a = settledNetwork();
    const b = settledNetwork();
    expect(a.nodes.map(n => [n.x, n.y])).toEqual(b.nodes.map(n => [n.x, n.y]));
    const cx = a.nodes.reduce((s, n) => s + n.x, 0) / NODE_COUNT;
    const cy = a.nodes.reduce((s, n) => s + n.y, 0) / NODE_COUNT;
    expect(Math.abs(cx - CENTER)).toBeLessThan(1);
    expect(Math.abs(cy - CENTER)).toBeLessThan(1);
    // The simulation is stopped: no timers keep an SSG process alive.
    expect(a.links.length).toBeGreaterThan(200);
  });
});

describe("accumulate", () => {
  test("root center of mass is the point average; strengths count points", () => {
    const points = [
      { x: 100, y: 100 },
      { x: 400, y: 100 },
      { x: 100, y: 400 },
      { x: 400, y: 400 }
    ];
    const tree = accumulate(buildTree(points));
    const root = tree.root() as unknown as {
      x: number;
      y: number;
      value: number;
    };
    expect(root.value).toBe(4);
    expect(root.x).toBeCloseTo(250);
    expect(root.y).toBeCloseTo(250);
  });
});

describe("cellBoxes", () => {
  test("two points: the power-of-two root cover plus the splits separating them", () => {
    const tree = buildTree([
      { x: 100, y: 100 },
      { x: 400, y: 400 }
    ]);
    const boxes = cellBoxes(tree);
    // d3-quadtree covers [1,513] with a 1024-wide root ([1,1025) — right-exclusive), so both
    // points share its NW quadrant and separating them takes two splits: 1 + 4 + 4 cells.
    expect(boxes).toHaveLength(9);
    expect(boxes[0]).toMatchObject({ w: 1024, depth: 0 });
    expect(boxes.filter(b => b.depth === 1)).toHaveLength(4);
    expect(boxes.filter(b => b.depth === 2)).toHaveLength(4);
  });

  test("empty tree has no boxes", () => {
    expect(cellBoxes(buildTree([]))).toHaveLength(0);
  });
});

describe("insertionStep", () => {
  const points = [
    { x: 100, y: 100 },
    { x: 400, y: 400 },
    { x: 410, y: 410 }
  ];

  test("k=0: empty tree, nothing inserted", () => {
    const s = insertionStep(points, 0);
    expect(s.inserted).toBeUndefined();
    expect(s.newBoxes).toHaveLength(0);
  });

  test("k=1: the first point claims the root cell", () => {
    const s = insertionStep(points, 1);
    expect(s.inserted).toBe(points[0]);
    expect(s.newBoxes).toHaveLength(1);
    expect(s.newBoxes[0].w).toBe(1024); // the full power-of-two root cover
  });

  test("a nearby third point forces deeper subdivision than a distant second", () => {
    const second = insertionStep(points, 2);
    const third = insertionStep(points, 3);
    // Point 3 is close to point 2: separating them subdivides further down.
    expect(third.newBoxes.length).toBeGreaterThan(0);
    const minW = (boxes: { w: number }[]) => Math.min(...boxes.map(b => b.w));
    expect(minW(third.newBoxes)).toBeLessThan(minW(second.newBoxes));
  });
});

describe("estimateAt", () => {
  const { nodes } = settledNetwork();
  const probe = { x: CENTER + 64, y: CENTER + 64 };

  test("θ=0 matches the naïve pairwise sum", () => {
    const tree = accumulate(buildTree(nodes));
    const est = estimateAt(tree, probe, 0);
    expect(est.charges).toHaveLength(NODE_COUNT);
    expect(est.boxes).toHaveLength(0);
    let fx = 0;
    let fy = 0;
    for (const n of nodes) {
      const dx = n.x - probe.x;
      const dy = n.y - probe.y;
      const l = dx * dx + dy * dy;
      fx += dx / l;
      fy += dy / l;
    }
    expect(est.fx).toBeCloseTo(fx, 10);
    expect(est.fy).toBeCloseTo(fy, 10);
  });

  test("larger θ considers fewer masses but approximates the same force", () => {
    const tree = accumulate(buildTree(nodes));
    const exact = estimateAt(tree, probe, 0);
    const approx = estimateAt(tree, probe, 1);
    expect(approx.charges.length).toBeLessThan(exact.charges.length);
    expect(approx.boxes.length).toBeGreaterThan(0);
    // Total mass is conserved across the approximation.
    const mass = (e: typeof exact) => e.charges.reduce((s, c) => s + c.v, 0);
    expect(mass(approx)).toBe(mass(exact));
    // The approximate force points the same general way (small relative error).
    const mag = Math.hypot(exact.fx, exact.fy);
    const err = Math.hypot(approx.fx - exact.fx, approx.fy - exact.fy);
    expect(err / mag).toBeLessThan(0.2);
  });

  test("huge θ collapses everything into the root's center of mass", () => {
    const tree = accumulate(buildTree(nodes));
    const est = estimateAt(tree, { x: 510, y: 510 }, 10);
    expect(est.charges).toHaveLength(1);
    expect(est.charges[0].v).toBe(NODE_COUNT);
  });
});

describe("comGroups", () => {
  test("groups sort deepest-first and cover every internal cell once", () => {
    const { nodes } = settledNetwork();
    const tree = accumulate(buildTree(nodes));
    const groups = comGroups(tree);
    const widths = groups.map(g => g[0].box.w);
    expect([...widths].sort((a, b) => a - b)).toEqual(widths);
    // The last (widest) group is the root's, alone, holding all mass.
    const rootGroup = groups[groups.length - 1];
    expect(rootGroup).toHaveLength(1);
    expect(rootGroup[0].value).toBe(NODE_COUNT);
    // Every cell's mass equals the sum of its children's.
    for (const cell of groups.flat()) {
      const sum = cell.children.reduce((s, c) => s + c.value, 0);
      expect(sum).toBe(cell.value);
    }
  });
});
