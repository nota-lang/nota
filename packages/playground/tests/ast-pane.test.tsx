/**
 * AST tree-pane tests (the {@link AstPane} collapsible tree). Driven by a hand-built ESTree-shaped
 * JSON so the rendering logic is tested in isolation — no wasm needed:
 *   1. each node row shows its `type` and a one-line source preview sliced from `start`/`end`;
 *   2. the disclosure arrow toggles a node's children in/out (the "enter a node" interaction);
 *   3. a malformed/empty `ast` degrades to a placeholder instead of throwing.
 * Runs headless in jsdom.
 */

import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AstPane } from "../src/AstPane";

const SOURCE = "# Hello\n\nbye";
// Program → NotaHeading(level 1) → NotaText("Hello"); offsets index SOURCE.
const AST = JSON.stringify({
  type: "Program",
  start: 0,
  end: SOURCE.length,
  body: [
    {
      type: "NotaHeading",
      level: 1,
      start: 0,
      end: 7,
      children: [{ type: "NotaText", value: "Hello", start: 2, end: 7 }]
    }
  ]
});

describe("AstPane tree", () => {
  it("shows each node's type and a one-line source preview", () => {
    render(<AstPane ast={AST} source={SOURCE} />);
    expect(screen.getByText("Program")).toBeTruthy();
    expect(screen.getByText("NotaHeading")).toBeTruthy();
    expect(screen.getByText("NotaText")).toBeTruthy();
    // Preview = first line of the node's source slice (`# Hello` for the heading/program span).
    expect(screen.getAllByText("# Hello").length).toBeGreaterThan(0);
    // A scalar field shows as a dim prop row.
    expect(screen.getByText("level")).toBeTruthy();
  });

  it("collapses a node's children when its arrow is clicked, and restores them", () => {
    render(<AstPane ast={AST} source={SOURCE} />);
    // The NotaHeading row is a button (it has children); collapsing it hides NotaText.
    const headingRow = screen.getByText("NotaHeading").closest("button");
    if (!headingRow)
      throw new Error("expected NotaHeading to render as a button row");

    fireEvent.click(headingRow);
    expect(screen.queryByText("NotaText")).toBeNull();

    fireEvent.click(headingRow);
    expect(screen.queryByText("NotaText")).toBeTruthy();
  });

  it("renders a placeholder (not a crash) for an empty or malformed AST", () => {
    const { rerender } = render(<AstPane ast="" source="" />);
    expect(screen.getByText("No AST yet.")).toBeTruthy();
    rerender(<AstPane ast="{not json" source="" />);
    expect(screen.getByText("No AST yet.")).toBeTruthy();
  });
});
