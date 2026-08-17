/**
 * Pure-CSR semantics (dom project) — what the dev server / playground / SSG pass 1 run: an
 * **unseeded** store, so a forward reference legitimately renders the `?` placeholder and
 * self-heals reactively when its target registers (the resolution-error policy's CSR half).
 * Plus the client/DOM-node path of armed shiki decorations (SSR chunks are the other half,
 * covered in render.test.tsx).
 */
import { NotaDoc } from "@nota-lang/core";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  CodeBlock,
  Footnote,
  Heading,
  Label,
  Ref,
  resetConfigForTest
} from "../src/lib";

let dispose: (() => void) | null = null;
let root: HTMLDivElement | null = null;

beforeEach(() => {
  resetConfigForTest();
  root = document.createElement("div");
  document.body.appendChild(root);
});

afterEach(() => {
  dispose?.();
  root?.remove();
  dispose = null;
  root = null;
});

describe("unseeded forward references (CSR)", () => {
  test("a Ref ahead of its target shows ? and self-heals when the target registers", () => {
    const [show, setShow] = createSignal(false);
    const Doc = () => (
      <NotaDoc>
        {"See "}
        <Ref id="here" />
        {" below."}
        <Show when={show()}>
          <Heading rank={1}>Target</Heading>
          <Label id="here" />
        </Show>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    // Unseeded + no target yet: the visible placeholder, not a throw.
    const pending = root.querySelector("a.nota-ref");
    expect(pending?.textContent).toBe("?");
    expect(pending?.getAttribute("href")).toBe("#");

    // The target mounts → the label/heading facts register → the ref heals reactively.
    setShow(true);
    const healed = root.querySelector("a.nota-ref");
    expect(healed?.textContent).toBe("Target");
    expect(healed?.getAttribute("href")).toBe("#target");
  });

  test("a footnote ref ahead of its @Footnote shows ? and becomes the mark when it mounts", () => {
    const [show, setShow] = createSignal(false);
    const Doc = () => (
      <NotaDoc>
        {"Note"}
        <Ref id="n" />
        <Show when={show()}>
          <Footnote id="n">{"the labeled body"}</Footnote>
        </Show>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    // Unseeded + unresolved: the ref can't even know it's a footnote yet — the generic
    // pending placeholder, no mark, no list.
    expect(root.querySelector("a.nota-ref")?.textContent).toBe("?");
    expect(root.querySelector("sup.nota-fnref")).toBeNull();
    expect(root.querySelector(".nota-fn-content")).toBeNull();

    // The definition mounts → the ref re-dispatches into the footnote arm and the list fills.
    setShow(true);
    expect(root.querySelector("sup.nota-fnref")?.textContent).toBe("1");
    const content = root.querySelector(".nota-fn-content");
    expect(content?.textContent).toContain("the labeled body");
    expect(content?.textContent).not.toContain("?");
  });
});

describe("armed shiki decorations (DOM-node path)", () => {
  test("an armed DOM element becomes a decoration over its text range", () => {
    const Doc = () => (
      <NotaDoc>
        <CodeBlock lang="js">
          {"let "}
          <span class="hl" data-note="target">
            {"x"}
          </span>
          {" = 1;"}
        </CodeBlock>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    const block = root.querySelector(".nota-code-block");
    expect(block?.querySelector("pre.shiki")).toBeTruthy();
    // The armed span's tag + attributes survive as the decoration…
    const deco = block?.querySelector("span.hl");
    expect(deco).toBeTruthy();
    expect(deco?.getAttribute("data-note")).toBe("target");
    expect(deco?.textContent).toBe("x");
    // …minus hydration bookkeeping.
    expect(deco?.hasAttribute("data-hk")).toBe(false);
    // The whole reconstructed source tokenized around it.
    expect(block?.textContent).toContain("let x = 1;");
  });
});
