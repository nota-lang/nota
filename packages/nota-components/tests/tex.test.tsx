/**
 * @jest-environment jsdom
 */

import React from "react";
import { render } from "@testing-library/react";
import "@testing-library/jest-dom";

import { $ } from "@nota-lang/nota-components";


test("$", () => {
  let { baseElement } = render(<$>\pi</$>);
  let pi = baseElement.querySelector("span.mord.mathnormal")!;
  expect(pi.textContent).toBe("π");
});
