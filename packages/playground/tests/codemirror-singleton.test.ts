/**
 * CM6 requires exactly ONE copy of `@codemirror/state` in the bundle: `EditorState.update()`
 * accepts a selection via `sel instanceof EditorSelection`, so a selection built by a *second*
 * copy silently falls through to `EditorSelection.single(sel.anchor, sel.head)` — and an
 * `EditorSelection` has no `.anchor`/`.head`, so the cursor lands at `undefined` and the next
 * DOM sync throws "No tile at position undefined".
 *
 * This regressed once already: `@codemirror/commands` bumped its floor to state `^6.7.0` while
 * the lockfile still pinned everything else to 6.6.0, so arrow-key navigation crashed the editor.
 * `pnpm dedupe` collapsed them. These tests fail loudly if the graph splits again.
 */

import { selectLine } from "@codemirror/commands";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

describe("@codemirror/state is a singleton", () => {
  it("dispatches a commands-built EditorSelection intact", () => {
    // `selectLine` is the cheapest command that crosses the boundary: it needs no view/layout,
    // and it dispatches an `EditorSelection` *instance* built by @codemirror/commands' own
    // resolution of @codemirror/state.
    const state = EditorState.create({
      doc: "abc\ndef",
      selection: { anchor: 5 }
    });
    let next: EditorState | undefined;
    selectLine({ state, dispatch: tr => (next = tr.state) });

    const main = next?.selection.main;
    expect(main?.anchor).toBe(4);
    expect(main?.head).toBe(7);
  });

  it("shares one EditorSelection class with @codemirror/view", () => {
    // The view reads `state.selection.main` on every DOM sync; if its `@codemirror/state` differs
    // from ours, `EditorView.state`'s selection is not our `EditorSelection`.
    const view = new EditorView({
      state: EditorState.create({ doc: "abc", selection: { anchor: 1 } })
    });
    try {
      expect(view.state.selection).toBeInstanceOf(EditorSelection);
      expect(view.state.selection.main.anchor).toBe(1);
    } finally {
      view.destroy();
    }
  });
});
