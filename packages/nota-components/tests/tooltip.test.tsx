/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { act, render, screen } from "@testing-library/react";
import React from "react";

import { Portal, PortalPlugin } from "../dist/portal";
import { Tooltip, TooltipPlugin } from "../dist/tooltip";

describe("tooltip", () => {
  it("can render the inside and open on click", async () => {
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
          <Tooltip Popup={() => <>popup 3</>}>FC as popup</Tooltip>
          <Portal />
        </PortalPlugin.Provide>
      </TooltipPlugin.Provide>
    );

    let children = ["Node as child", "FC as child", "FC as popup"];
    for (let text of children) {
      await screen.findByText(text);
    }

    act(() => {
      children.forEach(text => {
        screen.getByText(text).click();
      });
    });

    let popup = ["popup 1", "popup 2", "popup 3"];
    for (let text of popup) {
      await screen.findByText(text);
    }
  });
});
