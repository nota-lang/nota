/** Assert server registration avoids Solid's SERVER_WRITE diagnostics. */

import { isServer, renderToString } from "@solidjs/web";
import { createComponent } from "solid-js";
import { describe, expect, test, vi } from "vitest";
import { collectDocState, createDocState } from "../src/lib";
import { Doc } from "./fixtures/host-doc";

describe("doc-state on the server", () => {
  test("registering facts trips no [SERVER_WRITE] deprecation", () => {
    expect(isServer).toBe(true);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const state = createDocState();
      state.register("heading", { id: "a" });
      state.trailer("colophon", () => null);
      state.flag("notes-placed");
      // ...and through the real driver, whose passes register from component bodies.
      const seed = collectDocState(Doc);
      // ...and through the SELF-HOSTED path, where `NotaDoc` runs the fixpoint itself from
      // inside an enclosing render (its nested passes register from component bodies too).
      const page = renderToString(() => createComponent(Doc, {}));

      const messages = [...warn.mock.calls, ...error.mock.calls]
        .flat()
        .map(String);
      expect(messages.filter(m => m.includes("SERVER_WRITE"))).toEqual([]);

      // The mutations the skipped write would have announced still landed.
      expect(state.read("heading")).toEqual([{ id: "a", location: "m:1" }]);
      expect(state.trailers()).toHaveLength(1);
      expect(state.hasFlag("notes-placed")).toBe(true);
      expect(
        seed
          .filter(entry => entry.kind === "heading")
          .map(entry => entry.fact.id)
      ).toEqual(["alpha", "beta"]);
      expect(page).toContain('class="nota-doc"');
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });
});
