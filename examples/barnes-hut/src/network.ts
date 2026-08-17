/**
 * The example network: Les Misérables character co-occurrences (77 nodes), the same graph the
 * original Idyll article and the Living Papers port use (data after Knuth's Stanford GraphBase,
 * via jheer/barnes-hut, BSD-3-Clause).
 *
 * {@link settledNetwork} places nodes deterministically (d3-force's phyllotaxis initialization,
 * recentered on the canvas) and pre-settles the force layout with synchronous ticks — the same
 * positions on every run, so the server-rendered SVG and the hydrating client agree, and the
 * zero-JS static page already shows a laid-out network rather than an unformed spiral.
 */

import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  type Simulation
} from "d3-force";

/** Canvas geometry shared by the network, the quadtree, and the component. */
export const EXTENT: [[number, number], [number, number]] = [
  [1, 1],
  [513, 513]
];
export const SIZE = 514;
export const CENTER = SIZE / 2;

export interface BodyNode {
  index: number;
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface BodyLink {
  source: BodyNode;
  target: BodyNode;
}

// prettier-ignore
const LINKS: [number, number][] = [
  [1, 0],
  [2, 0],
  [3, 0],
  [3, 2],
  [4, 0],
  [5, 0],
  [6, 0],
  [7, 0],
  [8, 0],
  [9, 0],
  [11, 10],
  [11, 3],
  [11, 2],
  [11, 0],
  [12, 11],
  [13, 11],
  [14, 11],
  [15, 11],
  [17, 16],
  [18, 16],
  [18, 17],
  [19, 16],
  [19, 17],
  [19, 18],
  [20, 16],
  [20, 17],
  [20, 18],
  [20, 19],
  [21, 16],
  [21, 17],
  [21, 18],
  [21, 19],
  [21, 20],
  [22, 16],
  [22, 17],
  [22, 18],
  [22, 19],
  [22, 20],
  [22, 21],
  [23, 16],
  [23, 17],
  [23, 18],
  [23, 19],
  [23, 20],
  [23, 21],
  [23, 22],
  [23, 12],
  [23, 11],
  [24, 23],
  [24, 11],
  [25, 24],
  [25, 23],
  [25, 11],
  [26, 24],
  [26, 11],
  [26, 16],
  [26, 25],
  [27, 11],
  [27, 23],
  [27, 25],
  [27, 24],
  [27, 26],
  [28, 11],
  [28, 27],
  [29, 23],
  [29, 27],
  [29, 11],
  [30, 23],
  [31, 30],
  [31, 11],
  [31, 23],
  [31, 27],
  [32, 11],
  [33, 11],
  [33, 27],
  [34, 11],
  [34, 29],
  [35, 11],
  [35, 34],
  [35, 29],
  [36, 34],
  [36, 35],
  [36, 11],
  [36, 29],
  [37, 34],
  [37, 35],
  [37, 36],
  [37, 11],
  [37, 29],
  [38, 34],
  [38, 35],
  [38, 36],
  [38, 37],
  [38, 11],
  [38, 29],
  [39, 25],
  [40, 25],
  [41, 24],
  [41, 25],
  [42, 41],
  [42, 25],
  [42, 24],
  [43, 11],
  [43, 26],
  [43, 27],
  [44, 28],
  [44, 11],
  [45, 28],
  [47, 46],
  [48, 47],
  [48, 25],
  [48, 27],
  [48, 11],
  [49, 26],
  [49, 11],
  [50, 49],
  [50, 24],
  [51, 49],
  [51, 26],
  [51, 11],
  [52, 51],
  [52, 39],
  [53, 51],
  [54, 51],
  [54, 49],
  [54, 26],
  [55, 51],
  [55, 49],
  [55, 39],
  [55, 54],
  [55, 26],
  [55, 11],
  [55, 16],
  [55, 25],
  [55, 41],
  [55, 48],
  [56, 49],
  [56, 55],
  [57, 55],
  [57, 41],
  [57, 48],
  [58, 55],
  [58, 48],
  [58, 27],
  [58, 57],
  [58, 11],
  [59, 58],
  [59, 55],
  [59, 48],
  [59, 57],
  [60, 48],
  [60, 58],
  [60, 59],
  [61, 48],
  [61, 58],
  [61, 60],
  [61, 59],
  [61, 57],
  [61, 55],
  [62, 55],
  [62, 58],
  [62, 59],
  [62, 48],
  [62, 57],
  [62, 41],
  [62, 61],
  [62, 60],
  [63, 59],
  [63, 48],
  [63, 62],
  [63, 57],
  [63, 58],
  [63, 61],
  [63, 60],
  [63, 55],
  [64, 55],
  [64, 62],
  [64, 48],
  [64, 63],
  [64, 58],
  [64, 61],
  [64, 60],
  [64, 59],
  [64, 57],
  [64, 11],
  [65, 63],
  [65, 64],
  [65, 48],
  [65, 62],
  [65, 58],
  [65, 61],
  [65, 60],
  [65, 59],
  [65, 57],
  [65, 55],
  [66, 64],
  [66, 58],
  [66, 59],
  [66, 62],
  [66, 65],
  [66, 48],
  [66, 63],
  [66, 61],
  [66, 60],
  [67, 57],
  [68, 25],
  [68, 11],
  [68, 24],
  [68, 27],
  [68, 48],
  [68, 41],
  [69, 25],
  [69, 68],
  [69, 11],
  [69, 24],
  [69, 27],
  [69, 48],
  [69, 41],
  [70, 25],
  [70, 69],
  [70, 68],
  [70, 11],
  [70, 24],
  [70, 27],
  [70, 41],
  [70, 58],
  [71, 27],
  [71, 69],
  [71, 68],
  [71, 70],
  [71, 11],
  [71, 48],
  [71, 41],
  [71, 25],
  [72, 26],
  [72, 27],
  [72, 11],
  [73, 48],
  [74, 48],
  [74, 73],
  [75, 69],
  [75, 68],
  [75, 25],
  [75, 48],
  [75, 41],
  [75, 70],
  [75, 71],
  [76, 64],
  [76, 65],
  [76, 66],
  [76, 63],
  [76, 62],
  [76, 48],
  [76, 58]
];

export const NODE_COUNT = 77;

/** d3-force's deterministic phyllotaxis initialization, recentered on the canvas. */
function initialNodes(): BodyNode[] {
  const initialRadius = 10;
  const initialAngle = Math.PI * (3 - Math.sqrt(5));
  return Array.from({ length: NODE_COUNT }, (_, i) => {
    const radius = initialRadius * Math.sqrt(0.5 + i);
    const angle = i * initialAngle;
    return {
      index: i,
      x: CENTER + radius * Math.cos(angle),
      y: CENTER + radius * Math.sin(angle)
    };
  });
}

export interface SettledNetwork {
  nodes: BodyNode[];
  links: BodyLink[];
  simulation: Simulation<BodyNode, BodyLink>;
}

/**
 * Build the network and settle it: a stopped simulation ticked synchronously — deterministic
 * (no coincident points, so d3-force never reaches for its jiggle RNG) and timer-free, safe to
 * run during SSG. The returned simulation is NOT running; the client restarts it for the live
 * layout.
 */
export function settledNetwork(charge = -30): SettledNetwork {
  const nodes = initialNodes();
  const links = LINKS.map(([s, t]) => ({
    source: nodes[s],
    target: nodes[t]
  }));
  const simulation = forceSimulation(nodes)
    .force("link", forceLink<BodyNode, BodyLink>(links))
    .force("charge", forceManyBody().strength(charge))
    .force("center", forceCenter(CENTER, CENTER))
    .stop();
  simulation.tick(150);
  return { nodes, links, simulation };
}
