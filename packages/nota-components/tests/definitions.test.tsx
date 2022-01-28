/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, waitFor, screen, getByText } from "@testing-library/react";
import "@testing-library/jest-dom";

import { Definition, Ref, Document } from "@nota-lang/nota-components";

describe("definitions", () => {
  it("has defs, refs, and tooltips", async () => {
    let { baseElement } = render(
      <Document>
        <Ref>foo</Ref>
        <Ref Label={"override"}>foo</Ref>
        <Definition name="foo" Label={() => "hello world"} Tooltip={() => "tooltip"}>
          a def
        </Definition>
      </Document>
    );

    await waitFor(() => screen.getByText("hello world"));
    screen.getByText("override");
    screen.getByText("a def");

    screen.getByText("hello world").click();
    await waitFor(() => screen.getByText("tooltip"));
  });
});
