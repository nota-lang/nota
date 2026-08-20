/**
 * Pure-CSR semantics (dom project) — what the dev server / playground / SSG pass 1 run: an
 * **unseeded** store, so a forward reference legitimately renders the `?` placeholder and
 * self-heals reactively when its target registers (the resolution-error policy's CSR half).
 * Plus the client/DOM-node path of armed shiki decorations (SSR chunks are the other half,
 * covered in render.test.tsx).
 */
import { NotaDoc } from "@nota-lang/core";
import javascript from "shiki/langs/javascript.mjs";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import {
  CodeBlock,
  Def,
  Heading,
  Label,
  lstset,
  Note,
  Ref,
  resetConfigForTest,
  secset
} from "../src/lib";

let dispose: (() => void) | null = null;
let root: HTMLDivElement | null = null;

beforeEach(() => {
  resetConfigForTest();
  // Grammars are opt-in (src/langs.ts); register the one the shiki cases below assume.
  lstset({ langs: [javascript] });
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
  test("each definition reference renders its own rich label", () => {
    const RichLabel = () => {
      const [presses, setPresses] = createSignal(0);
      return (
        <em class="term-label" onMouseDown={() => setPresses(n => n + 1)}>
          Term {presses()}
        </em>
      );
    };
    const Doc = () => (
      <NotaDoc>
        <Def id="term" Label={RichLabel}>
          {"The definition."}
        </Def>
        <Ref id="term" />
        <Ref id="term" />
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    const labels = root.querySelectorAll("a.nota-def-ref > .term-label");
    expect(labels).toHaveLength(2);
    expect(labels[0]).not.toBe(labels[1]);
    labels[0]?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(labels[0]?.textContent).toBe("Term 1");
    expect(labels[1]?.textContent).toBe("Term 0");
  });

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
    const slot = pending?.parentElement;
    expect(slot?.classList.contains("nota-ref-slot")).toBe(true);

    // The target mounts → the label/heading facts register → the ref heals reactively.
    setShow(true);
    const healed = root.querySelector("a.nota-ref");
    expect(healed?.textContent).toBe("Target");
    expect(healed?.getAttribute("href")).toBe("#target");
    expect(healed?.parentElement).toBe(slot);
  });

  test("a note ref ahead of its @Note shows ? and becomes the mark when it mounts", () => {
    const [show, setShow] = createSignal(false);
    const Doc = () => (
      <NotaDoc>
        {"Note"}
        <Ref id="n" />
        <Show when={show()}>
          <Note id="n">{"the labeled body"}</Note>
        </Show>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    // Unseeded + unresolved: the ref can't even know it's a note yet — the generic
    // pending placeholder, no mark, no list.
    expect(root.querySelector("a.nota-ref")?.textContent).toBe("?");
    expect(root.querySelector("sup.nota-noteref")).toBeNull();
    expect(root.querySelector(".nota-note-content")).toBeNull();

    // The definition mounts → the ref re-dispatches into the note arm and the list fills.
    setShow(true);
    expect(root.querySelector("sup.nota-noteref")?.textContent).toBe("1");
    const content = root.querySelector(".nota-note-content");
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

  test("a later note mark's number re-derives after an earlier note unmounts", () => {
    const [show, setShow] = createSignal(true);
    const Doc = () => (
      <NotaDoc>
        <Show when={show()}>
          <Note>{"first note"}</Note>
        </Show>
        <Note>{"second note"}</Note>
        <Note>{"third note"}</Note>
      </NotaDoc>
    );
    if (!root) throw new Error("no root");
    dispose = render(() => <Doc />, root);

    const supsBefore = Array.from(root.querySelectorAll("sup.nota-noteref"));
    expect(supsBefore.map(s => s.textContent)).toEqual(["1", "2", "3"]);

    setShow(false); // unmount the first note mark

    const supsAfter = Array.from(root.querySelectorAll("sup.nota-noteref"));
    expect(supsAfter.map(s => s.textContent)).toEqual(["1", "2"]);
    const hrefs = supsAfter.map(s =>
      s.querySelector("a")?.getAttribute("href")
    );
    expect(hrefs).toEqual(["#note-1", "#note-2"]);
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
