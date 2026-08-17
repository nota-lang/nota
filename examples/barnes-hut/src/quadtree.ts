/**
 * Barnes-Hut math over d3-quadtree, as pure functions from points to plain data — the
 * rendering-free port of the original article's quadtree.js (jheer/barnes-hut, BSD-3-Clause).
 * The Solid component derives its SVG from these in memos; nothing here touches the DOM.
 */

import { type Quadtree, quadtree } from "d3-quadtree";
import { EXTENT } from "./network";

export interface Pt {
  x: number;
  y: number;
}

/** A quadtree cell extent (plus subdivision depth, root = 0). */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
  depth: number;
}

/** A mass contributing to a force estimate: position, strength, display weight. */
export interface Charge {
  x: number;
  y: number;
  /** Accumulated strength (point count). */
  v: number;
  /** Display weight for the force-component line (5e3·v/dist², LP's constant). */
  s: number;
}

/** The result of one Barnes-Hut force estimation at a probe point. */
export interface Estimate {
  /** Masses considered — individual points and/or centers of mass. */
  charges: Charge[];
  /** Quadtree cells whose center of mass was used (the approximated regions). */
  boxes: Box[];
  /** Net force (unscaled sum of contributions). */
  fx: number;
  fy: number;
}

/** One internal cell's center of mass, with its children (for the accumulation animation). */
export interface ComCell {
  box: Box;
  x: number;
  y: number;
  value: number;
  children: { x: number; y: number; value: number }[];
}

/**
 * The annotations {@link accumulate} attaches to quadtree nodes — centers of mass on internal
 * nodes (plus their extent), point position + coincident count on leaves.
 */
interface Mass {
  x: number;
  y: number;
  value: number;
  x1: number;
  y1: number;
  w: number;
  h: number;
}

/* d3-quadtree's node union is awkward to thread through visit callbacks (internal nodes are
 * arrays, leaves are {data,next} — discriminated by `.length`), so the traversal helpers work
 * over this loose local view of a node. */
interface QNode<T> extends Partial<Mass> {
  length?: number;
  data?: T;
  next?: QNode<T>;
  [i: number]: QNode<T> | undefined;
}

function isInternal<T>(node: QNode<T>): boolean {
  return !!node.length;
}

export type BhTree<T extends Pt> = Quadtree<T>;

/** Build the article's quadtree over `points` (fixed canvas extent, x/y accessors). */
export function buildTree<T extends Pt>(points: readonly T[]): BhTree<T> {
  return quadtree<T>()
    .extent(EXTENT)
    .x(d => d.x)
    .y(d => d.y)
    .addAll(points as T[]);
}

/**
 * Compute centers of mass bottom-up (LP's `accumulate`): an internal cell's center is the
 * strength-weighted average of its children; a leaf carries its point (coincident points chain
 * on `next` and add strength). Annotates nodes in place; returns the tree.
 */
export function accumulate<T extends Pt>(tree: BhTree<T>): BhTree<T> {
  tree.visitAfter((node, x1, y1, x2, y2) => {
    const q = node as QNode<T>;
    let strength = 0;
    if (isInternal(q)) {
      let x = 0;
      let y = 0;
      for (let i = 0; i < 4; ++i) {
        const c = q[i];
        if (c?.value) {
          strength += c.value;
          x += c.value * (c.x as number);
          y += c.value * (c.y as number);
        }
      }
      q.x = x / strength;
      q.y = y / strength;
      q.x1 = x1;
      q.y1 = y1;
      q.w = x2 - x1;
      q.h = y2 - y1;
    } else {
      q.x = (q.data as T).x;
      q.y = (q.data as T).y;
      for (let c: QNode<T> | undefined = q; c; c = c.next) {
        strength += 1;
      }
    }
    q.value = strength;
  });
  return tree;
}

/**
 * Every cell extent of the tree's subdivision — the root plus, for each split, all four
 * quadrants (occupied or not; the empty siblings are what make the diagram read as a
 * subdivision of space). LP's `quads()`.
 */
export function cellBoxes<T extends Pt>(tree: BhTree<T>): Box[] {
  const boxes: Box[] = [];
  const root = tree.root() as QNode<T> | undefined;
  const extent = tree.extent();
  if (!root || !extent) {
    return boxes;
  }
  const [[x0, y0], [x1, y1]] = extent;
  boxes.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0, depth: 0 });
  const split = (
    node: QNode<T>,
    lo: [number, number],
    hi: [number, number],
    depth: number
  ) => {
    if (!isInternal(node)) {
      return;
    }
    const mx = (lo[0] + hi[0]) >> 1;
    const my = (lo[1] + hi[1]) >> 1;
    const quadrants: [[number, number], [number, number]][] = [
      [lo, [mx, my]],
      [
        [mx, lo[1]],
        [hi[0], my]
      ],
      [
        [lo[0], my],
        [mx, hi[1]]
      ],
      [[mx, my], hi]
    ];
    for (let i = 0; i < 4; ++i) {
      const [qlo, qhi] = quadrants[i];
      boxes.push({
        x: qlo[0],
        y: qlo[1],
        w: qhi[0] - qlo[0],
        h: qhi[1] - qlo[1],
        depth
      });
      const child = node[i];
      if (child) {
        split(child, qlo, qhi, depth + 1);
      }
    }
  };
  split(root, [x0, y0], [x1, y1], 1);
  return boxes;
}

/** The chain of cell extents containing `p`, root first (LP's `getPath`). */
function pathTo<T extends Pt>(tree: BhTree<T>, p: Pt): Box[] {
  const path: Box[] = [];
  tree.visit((_node, x1, y1, x2, y2) => {
    if (p.x < x1 || p.x >= x2 || p.y < y1 || p.y >= y2) {
      return true; // p not in this cell: abandon the branch
    }
    path.push({ x: x1, y: y1, w: x2 - x1, h: y2 - y1, depth: path.length });
    return undefined;
  });
  return path;
}

/** One quadtree-construction step: the first `k` points inserted. */
export interface InsertionStep<T extends Pt> {
  /** The tree over points[0..k), accumulated. */
  tree: BhTree<T>;
  /** The point inserted at this step (undefined at k = 0). */
  inserted?: T;
  /** Cells newly created by this insertion (the subdivision the point forced). */
  newBoxes: Box[];
}

/**
 * Build the tree over the first `k` points and report which cells inserting point `k−1`
 * created (LP's `treeSize`: the path to the point after insertion, minus the path before).
 */
export function insertionStep<T extends Pt>(
  points: readonly T[],
  k: number
): InsertionStep<T> {
  const count = Math.max(0, Math.min(k, points.length));
  if (count === 0) {
    return { tree: buildTree<T>([]), newBoxes: [] };
  }
  const p = points[count - 1];
  const tree = buildTree(points.slice(0, count - 1));
  const before = pathTo(tree, p);
  tree.add(p);
  accumulate(tree);
  const newBoxes = pathTo(tree, p).slice(before.length);
  return { tree, inserted: p, newBoxes };
}

/**
 * Barnes-Hut force estimation at probe `p` (LP's `estimate`): walk the accumulated tree; an
 * internal cell whose width/distance ratio is below `theta` contributes its center of mass and
 * is not descended into; otherwise its points contribute individually. Repulsive convention —
 * the net force pushes the probe away from mass (the article draws `p − 90·f`).
 */
export function estimateAt<T extends Pt>(
  tree: BhTree<T>,
  p: Pt,
  theta: number
): Estimate {
  const theta2 = theta * theta;
  const charges: Charge[] = [];
  const boxes: Box[] = [];
  let fx = 0;
  let fy = 0;
  tree.visit((node, x1, y1, x2, y2) => {
    const q = node as QNode<T>;
    if (!q.value) {
      return true;
    }
    const x = (q.x as number) - p.x;
    const y = (q.y as number) - p.y;
    const w = x2 - x1;
    const l = x * x + y * y;

    // Far enough: use the cell's center of mass and stop descending.
    if (isInternal(q) && (w * w) / theta2 < l) {
      charges.push({
        x: q.x as number,
        y: q.y as number,
        v: q.value,
        s: (5e3 * q.value) / l
      });
      boxes.push({ x: x1, y: y1, w, h: y2 - y1, depth: 0 });
      fx += (x * q.value) / l;
      fy += (y * q.value) / l;
      return true;
    }

    // Too close (recurse into children), or the probe sits exactly on this leaf (skip).
    if (isInternal(q) || !l) {
      return undefined;
    }

    // A leaf: each (coincident) point contributes individually.
    for (let c: QNode<T> | undefined = q; c; c = c.next) {
      charges.push({
        x: (c.data as T).x,
        y: (c.data as T).y,
        v: 1,
        s: 5e3 / l
      });
      fx += x / l;
      fy += y / l;
    }
    return undefined;
  });
  return { charges, boxes, fx, fy };
}

/**
 * Internal cells grouped by ascending width — deepest first, the order the center-of-mass
 * pass merges upward (LP's `animateAccumulation` grouping). Each cell reports its own center
 * of mass and its (nonempty) children's, for the gather animation.
 */
export function comGroups<T extends Pt>(tree: BhTree<T>): ComCell[][] {
  const byWidth = new Map<number, ComCell[]>();
  tree.visitAfter((node, x1, y1, x2, y2) => {
    const q = node as QNode<T>;
    if (!isInternal(q)) {
      return;
    }
    const w = x2 - x1;
    const children: ComCell["children"] = [];
    for (let i = 0; i < 4; ++i) {
      const c = q[i];
      if (c?.value) {
        children.push({
          x: c.x as number,
          y: c.y as number,
          value: c.value
        });
      }
    }
    const cell: ComCell = {
      box: { x: x1, y: y1, w, h: y2 - y1, depth: 0 },
      x: q.x as number,
      y: q.y as number,
      value: q.value as number,
      children
    };
    const group = byWidth.get(w);
    if (group) {
      group.push(cell);
    } else {
      byWidth.set(w, [cell]);
    }
  });
  return [...byWidth.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
}
