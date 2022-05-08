/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, waitFor, screen, getByText } from "@testing-library/react";
import "@testing-library/jest-dom";

import { $, texDef, texRef } from "@nota-lang/nota-components/dist/tex";
import { DefinitionsPlugin } from "@nota-lang/nota-components/dist/definitions";

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
    await waitFor(() => screen.getByText("z"));

    let def = baseElement.querySelector<HTMLElement>(`[data-def="x"]`)!;
    let ref = baseElement.querySelector<HTMLElement>(`[data-ref="x"]`)!;
    getByText(def, "y");
    getByText(ref, "z");
  });
});
