/**
 * `GOLDEN_NOTA` (`../src/golden`) is a hand-inlined copy of `integration/golden.nota` — inlined
 * rather than a `?raw` import across the package boundary so the tests don't depend on Vite's
 * `fs.allow` (golden.ts's docstring). That constraint doesn't apply here: this is a plain Node
 * `readFileSync` in a test, not a dev-server asset request, so this test reads the real fixture
 * and asserts the inlined copy hasn't drifted from it — a stale copy fails loudly instead of
 * silently diverging from what `integration/`'s own e2e suites compile.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GOLDEN_NOTA } from "../src/golden";

describe("GOLDEN_NOTA", () => {
  it("is byte-identical to integration/golden.nota", () => {
    // `dirname(fileURLToPath(import.meta.url))` (not `new URL(relative, import.meta.url)`): under
    // this package's jsdom test environment, the global `URL` is jsdom's own implementation, and
    // handing a jsdom URL instance to node:url's `fileURLToPath` throws ("The URL must be of
    // scheme file") — passing the plain string straight to `fileURLToPath` sidesteps it.
    const here = dirname(fileURLToPath(import.meta.url));
    const path = join(here, "..", "..", "..", "integration", "golden.nota");
    expect(GOLDEN_NOTA).toBe(readFileSync(path, "utf8"));
  });
});
