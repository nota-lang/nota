/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { References, BibliographyPlugin } from "@nota-lang/nota-components/dist/bibliography";
import { DefinitionsPlugin, Ref } from "@nota-lang/nota-components/dist/definitions";

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
      <DefinitionsPlugin.Provide>
        <BibliographyPlugin.Provide>
          <Ref>ab94</Ref>
          <References bibtex={bibtex} />
        </BibliographyPlugin.Provide>
      </DefinitionsPlugin.Provide>
    );

    await waitFor(() => screen.getByText("Aliprantis and Border 1994"));
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
