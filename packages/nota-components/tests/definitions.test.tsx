/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

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

    await waitFor(() => screen.getByText("hello world"));
    screen.getByText("override");
    screen.getByText("a def");

    screen.getByText("hello world").click();
    await waitFor(() => screen.getByText("tooltip"));
  });
});
