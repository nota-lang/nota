/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import React from "react";

import { References } from "../dist/bibliography";
import { Ref } from "../dist/definitions";
import { Document } from "../dist/document";

describe("bibliography", () => {
  it("can do bibtex -> citation -> references", async () => {
    let bibtex = `@book{ab94,
      author = {Aliprantis, Charalambos D. and Border, Kim C.},
      year = {1994},
      title = {Infinite Dimensional Analysis},
      publisher = {Springer},
      address = {Berlin}
   }`;
    let { baseElement } = render(
      <Document>
        <Ref>ab94</Ref>
        <References bibtex={bibtex} />
      </Document>
    );

    await screen.findByText("Aliprantis and Border 1994");
    expect(
      baseElement
        .querySelector(".bib-reference")!
        .textContent!.includes("Infinite Dimensional Analysis")
    ).toBeTruthy();
  });

  // also to test:
  //  * different forms of citations (full, yearonly)
  //  * stress test to bibtex parsing
  //  * citations in bibtex but not references don't show in references section
});
