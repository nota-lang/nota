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
  FootnoteMark,
  FootnoteText,
  Heading,
  Label,
  Ref,
  resetConfigForTest,
  secset
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

  test("a FootnoteMark ahead of its FootnoteText shows ? in the list and self-heals", () => {
    const [show, setShow] = createSignal(false);
    const Doc = () => (
      <NotaDoc>
        {"Note"}
        <FootnoteMark label="n" />
        <Show when={show()}>
          <FootnoteText label="n">{"the labeled body"}</FootnoteText>
        </Show>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    // The mark numbers immediately; the entry body is pending.
    expect(root.querySelector("sup.nota-fnref")?.textContent).toBe("1");
    expect(root.querySelector(".nota-fn-content")?.textContent).toContain("?");

    setShow(true);
    const content = root.querySelector(".nota-fn-content");
    expect(content?.textContent).toContain("the labeled body");
    expect(content?.textContent).not.toContain("?");
  });
});

describe("live renumbering (unmount-before-later-consumer)", () => {
  test("a later heading's id/num re-derive after an earlier heading unmounts", () => {
    secset({ numberDepth: 1 });
    const [show, setShow] = createSignal(true);
    const Doc = () => (
      <NotaDoc>
        <Show when={show()}>
          <Heading rank={1}>First</Heading>
        </Show>
        <Heading rank={1}>Second</Heading>
        <Heading rank={1}>Third</Heading>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    const headingsBefore = Array.from(root.querySelectorAll("h1"));
    expect(headingsBefore.map(h => h.id)).toEqual(["first", "second", "third"]);
    expect(
      headingsBefore.map(h => h.querySelector(".nota-secnum")?.textContent)
    ).toEqual(["1", "2", "3"]);

    setShow(false); // unmount "First" — Second and Third re-sequence underneath it

    const headingsAfter = Array.from(root.querySelectorAll("h1"));
    expect(
      headingsAfter.map(h => h.textContent?.replace(/^\d+\s*/, ""))
    ).toEqual(["Second", "Third"]);
    // Both id() and num() must re-derive against the NEW positions, not the mount-time index.
    expect(headingsAfter.map(h => h.id)).toEqual(["second", "third"]);
    expect(
      headingsAfter.map(h => h.querySelector(".nota-secnum")?.textContent)
    ).toEqual(["1", "2"]);
  });

  test("a later footnote mark's number re-derives after an earlier footnote unmounts", () => {
    const [show, setShow] = createSignal(true);
    const Doc = () => (
      <NotaDoc>
        <Show when={show()}>
          <Footnote>{"first note"}</Footnote>
        </Show>
        <Footnote>{"second note"}</Footnote>
        <Footnote>{"third note"}</Footnote>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    const supsBefore = Array.from(root.querySelectorAll("sup.nota-fnref"));
    expect(supsBefore.map(s => s.textContent)).toEqual(["1", "2", "3"]);

    setShow(false); // unmount the first footnote mark

    const supsAfter = Array.from(root.querySelectorAll("sup.nota-fnref"));
    expect(supsAfter.map(s => s.textContent)).toEqual(["1", "2"]);
    const hrefs = supsAfter.map(s =>
      s.querySelector("a")?.getAttribute("href")
    );
    expect(hrefs).toEqual(["#fn-1", "#fn-2"]);
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
