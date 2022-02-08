/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, waitFor, screen, getByText } from "@testing-library/react";
import { zipExn } from "@nota-lang/nota-common";
import "@testing-library/jest-dom";

import { Document, Section, Subsection, Footnote } from "@nota-lang/nota-components";

describe("document", () => {
  it("automatically puts top-level content into paragraphs", () => {
    let { baseElement } = render(
      <Document>
        {["A B", "\n", "C", "\n", "\n", "D", "\n", "\n", "E", <span key={"F"}>F</span>]}
      </Document>
    );

    let paragraphs = baseElement.querySelectorAll<HTMLElement>(".nota-document-inner > p");
    let contents = ["A B\nC", "D", "E<span>F</span>"];
    zipExn(paragraphs, contents).map(([p, html]) => {
      expect(p.innerHTML).toBe(html);
    });
  });

  it("turns a list of sections into a hierarchy", () => {
    let { baseElement } = render(
      <Document>
        <Section>Introduction</Section>
        <p>In this paper...</p>
        <Subsection>Contributions</Subsection>
        <p>We are contributing...</p>
        <Section>Conclusion</Section>
        <p>We have shown...</p>
      </Document>
    );

    let [intro, conclusion] = baseElement.querySelectorAll<HTMLElement>(
      ".nota-document-inner > section"
    );
    getByText(intro, "Introduction");
    getByText(intro, "In this paper...");
    getByText(intro, "We are contributing...");

    let contributions = intro.querySelector<HTMLElement>("section");
    getByText(contributions, "We are contributing...");

    getByText(conclusion, "We have shown...");
  });

  it("supports footnotes", async () => {
    let { baseElement } = render(
      <Document>
        This is a quick<Footnote>footnote</Footnote>. And{" "}
        <Footnote>
          <strong>another</strong>
        </Footnote>
        .
      </Document>
    );

    await waitFor(() => expect(baseElement.querySelector("sup")).not.toBeNull());

    screen.getByText("footnote");
    screen.getByText("another");
    expect(baseElement.querySelector("sup").textContent).toBe("0");
  });
});
