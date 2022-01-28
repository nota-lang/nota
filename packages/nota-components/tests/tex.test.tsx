/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, waitFor, screen, getByText } from "@testing-library/react";
import "@testing-library/jest-dom";

import { $, tex_def, tex_ref, DefinitionsPlugin } from "@nota-lang/nota-components";

describe("tex", () => {
  it("can render basic tex", () => {
    let { baseElement } = render(<$>\pi</$>);
    let pi = baseElement.querySelector("span.mord.mathnormal")!;
    expect(pi.textContent).toBe("π");
  });

  it("supports definitions and references", async () => {
    let { baseElement } = render(
      <DefinitionsPlugin.Provide>
        <$>
          {tex_def(["x"], ["y"])}
          {tex_ref(["x"], ["z"])}
        </$>
      </DefinitionsPlugin.Provide>
    );
    await waitFor(() => screen.getByText("z"));

    let def = baseElement.querySelector<HTMLElement>(`[data-def="x"]`);
    let ref = baseElement.querySelector<HTMLElement>(`[data-ref="x"]`);
    getByText(def, "y");
    getByText(ref, "z");
  });
});
