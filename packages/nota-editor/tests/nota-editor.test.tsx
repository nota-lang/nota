/**
 * @jest-environment jsdom
 */

import React from "react";
import { runInAction } from "mobx";
import { observer } from "mobx-react";
import { render, waitFor, screen } from "@testing-library/react";
import "@testing-library/jest-dom";

import { LocalState, StateContext, OutputView } from "..";

test("editor", async () => {
  // Create state and component
  let state = new LocalState("@h1{Hello world}");
  let Component = observer(() => (
    <StateContext.Provider value={state}>
      <OutputView result={state.translation} />
    </StateContext.Provider>
  ));
  let { container } = render(<Component />);

  // Header should be the initial contents
  let expectHeader = (contents: string) => {
    let header = container.querySelector(".nota-document h1");
    expect(header).not.toBeNull();
    expect(header!.textContent).toBe(contents);
  };
  await waitFor(() => screen.getByText("Hello world"));

  expectHeader("Hello world");

  // Simulate updating the contents
  runInAction(() => {
    state.contents = "@h1{Hello 世界}";
  });
  await waitFor(() => screen.getByText("Hello 世界"));

  // Header should reflect the new contents
  expectHeader("Hello 世界");
});
