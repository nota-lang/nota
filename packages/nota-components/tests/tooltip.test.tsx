/**
 * @jest-environment jsdom
 */

import React from "react";
import { render, waitFor, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { TooltipPlugin, PortalPlugin, Portal, Tooltip } from "@nota-lang/nota-components";

describe("tooltip", () => {
  it("has defs, refs, and tooltips", async () => {
    render(
      <TooltipPlugin.Provide>
        <PortalPlugin.Provide>
          <Tooltip Popup={"popup 1"}>Node as child</Tooltip>
          <Tooltip Popup={"popup 2"}>
            {React.forwardRef<HTMLElement, any>(({ onClick }, ref) => (
              <span ref={ref} onClick={onClick}>
                FC as child
              </span>
            ))}
          </Tooltip>
          <Tooltip Popup={() => "popup 3"}>FC as popup</Tooltip>
          <Portal />
        </PortalPlugin.Provide>
      </TooltipPlugin.Provide>
    );

    let children = ["Node as child", "FC as child", "FC as popup"];
    for (let text of children) {
      await waitFor(() => screen.getByText(text));
    }

    children.forEach(text => {
      screen.getByText(text).click();
    });

    let popup = ["popup 1", "popup 2", "popup 3"];
    for (let text of popup) {
      await waitFor(() => screen.getByText(text));
    }
  });
});
