/**
 * DOM half of the shared adapter-conformance matrix (runs in the `dom` vitest project — jsdom env,
 * browser export conditions, so both frameworks' client builds power `hydrate`). See
 * {@link "./conformanceMatrix"}.
 */
import { runHydrateMatrix } from "./conformanceMatrix";

runHydrateMatrix();
