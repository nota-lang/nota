/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import React from "react";

import { Definition, Ref } from "../dist/definitions";
import { Document } from "../dist/document";

describe("definitions", () => {
  it("has defs, refs, and tooltips", async () => {
    render(
      <Document>
        <Ref>foo</Ref>
        <Ref label={"override"}>foo</Ref>
        <Definition name="foo" label={"hello world"} tooltip={"tooltip"}>
          a def
        </Definition>
      </Document>
    );

    await screen.findByText("hello world");
    screen.getByText("override");
    screen.getByText("a def");

    act(() => screen.getByText("hello world").click());
    await screen.findByText("tooltip");
  });
});
