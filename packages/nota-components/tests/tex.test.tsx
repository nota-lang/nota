/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { getByText, render, screen } from "@testing-library/react";
import React from "react";

import { DefinitionsPlugin } from "../dist/definitions";
import { $, texDef, texRef } from "../dist/tex";

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
          {texDef(["x"], ["y"])}
          {texRef(["x"], ["z"])}
        </$>
      </DefinitionsPlugin.Provide>
    );
    await screen.findByText("z");

    let def = baseElement.querySelector<HTMLElement>(`[data-def="x"]`)!;
    let ref = baseElement.querySelector<HTMLElement>(`[data-ref="x"]`)!;
    getByText(def, "y");
    getByText(ref, "z");
  });
});
