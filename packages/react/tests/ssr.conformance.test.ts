/**
 * SSR half of the shared adapter-conformance matrix (runs in the `ssr` vitest project — Node env,
 * server export conditions, so Solid's server build powers `renderToString`). See
 * {@link "./conformanceMatrix"}.
 */
import { runRenderMatrix } from "./conformanceMatrix";

runRenderMatrix();
