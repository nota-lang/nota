/**
 * This explorable's interaction primitives through the SSG driver: the Slider's control markup and readout, the
 * Action's prose-button shape (and its inline categorization — it must land INSIDE the
 * paragraph Reforest forms), and the Sticky panel's offset knob. Interactive behavior (drag,
 * click, outside writes moving the thumb) is covered end-to-end by the barnes-hut example's
 * hydration test in barnes-hut.test.tsx, which drives the real built page.
 */
import { NotaDoc, renderDocument } from "@nota-lang/core";
import { createSignal } from "solid-js";
import { describe, expect, test } from "vitest";
import { Action, Slider } from "../src/inputs";
import { Sticky } from "../src/layout";

const clean = (h: string) =>
  h.replace(/\s*data-hk="[^"]*"/g, "").replace(/<!--\/?!?\$?-->/g, "");

describe("Slider", () => {
  test("renders label, range attributes, current value, and readout", () => {
    const [v, setV] = createSignal(1.5);
    const Doc = () => (
      <NotaDoc>
        <Slider
          value={v()}
          set={setV}
          min={0}
          max={2}
          step={0.1}
          label="Theta"
        />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toContain('<span class="nota-slider-label">Theta</span>');
    expect(html).toMatch(
      /<input type="range" min="0" max="2" step="0.1"[^>]* value="1.5"/
    );
    expect(html).toContain('<output class="nota-slider-value">1.5</output>');
  });

  test("defaults min/max/step; custom format; format=false hides the readout", () => {
    const noop = () => {};
    const Doc = () => (
      <NotaDoc>
        <Slider value={30} set={noop} format={v => `${v}%`} />
        <Slider value={5} set={noop} format={false} />
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    expect(html).toMatch(/min="0" max="100" step="1"/);
    expect(html).toContain(">30%</output>");
    expect(html).not.toContain(">5</output>");
    // No label prop → no label span at all.
    expect(html).not.toContain("nota-slider-label");
  });
});

describe("Action", () => {
  test("renders a type=button prose button and categorizes as inline", () => {
    const Doc = () => (
      <NotaDoc>
        {"Click "}
        <Action do={() => {}}>{"here"}</Action>
        {" to proceed."}
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // The run (text + button + text) forms ONE paragraph with the button inside it.
    expect(html).toMatch(
      /<p class="nota-para">Click <button type="button" class="nota-action">here<\/button> to proceed.<\/p>/
    );
  });
});

describe("Sticky", () => {
  test("renders the sticky panel; top prop becomes the CSS knob", () => {
    const Doc = () => (
      <NotaDoc>
        <Sticky>{"pinned"}</Sticky>
        <Sticky top="10vh">{"pinned lower"}</Sticky>
      </NotaDoc>
    );
    const html = clean(renderDocument(Doc).html);
    // Solid SSR renders a dynamic style prop as style="" when unset — accepted.
    expect(html).toContain('<div class="nota-sticky" style="">pinned</div>');
    expect(html).toContain(
      '<div class="nota-sticky" style="--nota-sticky-top:10vh">pinned lower</div>'
    );
  });
});
