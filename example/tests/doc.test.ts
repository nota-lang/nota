/**
 * Smoke test for the packed pipeline: `hello.nota` travels vite-plugin → compiler → wasm reader →
 * runtime decode/serialize, all resolved from the `../pack/*.tgz` tarballs (no workspace symlinks).
 */

import { describe, expect, it } from "vitest";
import Doc from "../src/hello.nota";

describe("hello.nota through the packed @nota-lang pipeline", () => {
  it("compiles and renders to an HTML string", () => {
    const html = Doc();
    expect(typeof html).toBe("string");
    expect(html).toContain("Hello Nota");
    expect(html).toContain("A second section");
  });

  it("decodes list items into a real <ul>", () => {
    const html = Doc();
    expect(html).toContain("<ul>");
    expect(html).toContain("first item");
    expect(html).toContain("third item");
  });
});
