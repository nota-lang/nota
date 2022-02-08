/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, screen } from "@testing-library/react";
import { javascript } from "@codemirror/lang-javascript";
import "@testing-library/jest-dom";

import { Listing, ListingPlugin, ListingConfigure } from "@nota-lang/nota-components";

describe("code", () => {
  it("can render blocks", async () => {
    render(
      <ListingPlugin.Provide>
        <ListingConfigure language={javascript()} />
        <Listing>let x = "hello world";</Listing>
      </ListingPlugin.Provide>
    );

    screen.getByText("let");
    screen.getByText('"hello world"');
  });
});
