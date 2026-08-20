/**
 * The Reforest behavior suite (client build): paragraph inference, section NESTING (the Nota
 * divergence from the flat reforest spike), list coalescing + whitespace bridging, tight mode
 * (UlLi interiors), see-through categorization, and state preservation across restructuring.
 */
import type { JSX } from "solid-js";
import { createSignal, Show } from "solid-js";
import { render } from "solid-js/web";
import { afterEach, describe, expect, test } from "vitest";
import { Attrs, OlLi, Reforest, textOf, UlLi } from "../src/lib";

let disposers: (() => void)[] = [];

function mount(ui: () => JSX.Element): HTMLDivElement {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const dispose = render(ui, root);
  disposers.push(() => {
    dispose();
    root.remove();
  });
  return root;
}

afterEach(() => {
  for (const d of disposers) d();
  disposers = [];
});

const click = (el: Element) =>
  el.dispatchEvent(new MouseEvent("click", { bubbles: true }));

const tags = (el: Element) => Array.from(el.children).map(c => c.tagName);

function Counter() {
  const [n, setN] = createSignal(0);
  return (
    <button onClick={() => setN(n() + 1)} type="button">
      clicks: {n()}
    </button>
  );
}

describe("paragraphs", () => {
  test("wraps a loose inline run in a paragraph", () => {
    const root = mount(() => (
      <Reforest>
        hello <em>world</em>
      </Reforest>
    ));
    expect(tags(root)).toEqual(["P"]);
    expect(root.querySelector("p")?.className).toBe("nota-para");
    expect(root.querySelector("p em")?.textContent).toBe("world");
  });

  test("blocks pass through and split paragraphs", () => {
    const root = mount(() => (
      <Reforest>
        alpha
        <div class="d">a block</div>
        omega
      </Reforest>
    ));
    expect(tags(root)).toEqual(["P", "DIV", "P"]);
  });

  test("blank lines in string children break paragraphs; a lone newline stays inline", () => {
    const root = mount(() => (
      <Reforest>
        {"first line\nsame paragraph\n\nsecond paragraph"} <em>tail</em>
      </Reforest>
    ));
    const ps = root.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0].textContent).toContain("same paragraph");
    expect(ps[1].querySelector("em")).toBeTruthy();
  });
});

describe("sections nest (Nota divergence from the flat spike)", () => {
  test("an h3 after an h2 nests inside the h2 section", () => {
    const root = mount(() => (
      <Reforest>
        intro
        <h2>A</h2>
        a-text
        <h3>A.1</h3>
        a1-text
        <h2>B</h2>
        b-text
      </Reforest>
    ));
    // Top level: intro para, section A, section B — A.1 lives INSIDE A.
    expect(tags(root)).toEqual(["P", "SECTION", "SECTION"]);
    const [secA, secB] = Array.from(root.querySelectorAll(":scope > section"));
    expect(secA.querySelector(":scope > h2")?.textContent).toBe("A");
    const inner = secA.querySelector(":scope > section");
    expect(inner).toBeTruthy();
    expect(inner?.querySelector("h3")?.textContent).toBe("A.1");
    expect(inner?.querySelector("p")?.textContent).toContain("a1-text");
    // The next h2 closed both the h3 and h2 sections.
    expect(secB.querySelector("section")).toBeNull();
    expect(secB.querySelector("h2")?.textContent).toBe("B");
  });

  test("a higher-ranked heading closes deeper sections", () => {
    const root = mount(() => (
      <Reforest>
        <h3>deep</h3>
        deep-text
        <h1>top</h1>
        top-text
      </Reforest>
    ));
    expect(tags(root)).toEqual(["SECTION", "SECTION"]);
    expect(root.children[1].querySelector("h1")).toBeTruthy();
  });
});

describe("lists", () => {
  test("item runs coalesce into ul/ol by kind and carry the nota-list class", () => {
    const root = mount(() => (
      <Reforest>
        before
        <UlLi>one</UlLi>
        <UlLi>two</UlLi>
        <OlLi>uno</OlLi>
        after
      </Reforest>
    ));
    expect(tags(root)).toEqual(["P", "UL", "OL", "P"]);
    expect(root.querySelector("ul")?.className).toBe("nota-list");
    expect(root.querySelectorAll("ul > li")).toHaveLength(2);
  });

  test("whitespace (including blank lines) bridges a list run; content splits it", () => {
    const root = mount(() => (
      <Reforest>
        <UlLi>one</UlLi>
        {"\n"}
        <UlLi>two</UlLi>
        {"\n\n"}
        <UlLi>three</UlLi>
        interruption
        <UlLi>four</UlLi>
      </Reforest>
    ));
    expect(tags(root)).toEqual(["UL", "P", "UL"]);
    expect(root.querySelectorAll("ul")[0].children).toHaveLength(3);
  });

  test("extra props (hoisted attrs groups) spread onto the li", () => {
    // `- item [class: "hot"]` hoists the attrs group onto UlLi/OlLi as real props.
    const root = mount(() => (
      <Reforest>
        <UlLi class="hot" data-x="1">
          item
        </UlLi>
        <OlLi id="o1" title="tip">
          oitem
        </OlLi>
      </Reforest>
    ));
    const uli = root.querySelector("ul > li");
    if (!uli) throw new Error("no ul li");
    expect(uli.className).toBe("hot");
    expect(uli.getAttribute("data-x")).toBe("1");
    expect(uli.getAttribute("data-list")).toBe("ul"); // the static marker survives the spread
    expect(uli.textContent).toBe("item");
    const oli = root.querySelector("ol > li");
    if (!oli) throw new Error("no ol li");
    expect(oli.id).toBe("o1");
    expect(oli.getAttribute("title")).toBe("tip");
    expect(oli.getAttribute("data-list")).toBe("ol");
  });

  test("nested item runs coalesce inside a tight item interior", () => {
    const root = mount(() => (
      <Reforest>
        <UlLi>
          outer
          <UlLi>inner one</UlLi>
          <UlLi>inner two</UlLi>
        </UlLi>
        <UlLi>second outer</UlLi>
      </Reforest>
    ));
    expect(tags(root)).toEqual(["UL"]);
    const outer = root.querySelectorAll(":scope > ul > li");
    expect(outer).toHaveLength(2);
    const inner = outer[0].querySelector("ul.nota-list");
    expect(inner).toBeTruthy();
    expect(inner?.querySelectorAll("li")).toHaveLength(2);
    // Tight interior: the item's inline content is NOT paragraph-wrapped.
    expect(outer[0].querySelector("p")).toBeNull();
  });
});

describe("components categorize by rendered root", () => {
  test("sees through component boundaries", () => {
    const InlineWidget = () => <em>widget</em>;
    const BlockWidget = () => <figure>fig</figure>;
    const root = mount(() => (
      <Reforest>
        before <InlineWidget /> mid
        <BlockWidget />
        after
      </Reforest>
    ));
    expect(tags(root)).toEqual(["P", "FIGURE", "P"]);
    expect(root.children[0].querySelector("em")?.textContent).toBe("widget");
  });
});

describe("state preservation", () => {
  test("node identity and state survive restructuring", () => {
    const [blocky, setBlocky] = createSignal(false);
    const root = mount(() => (
      <Reforest>
        alpha <Counter /> beta
        <Show when={blocky()} fallback={<em>inline aside</em>}>
          <blockquote>block aside</blockquote>
        </Show>
        gamma
      </Reforest>
    ));
    expect(root.querySelectorAll("p")).toHaveLength(1);
    const btn = root.querySelector("button");
    if (!btn) throw new Error("no button");
    click(btn);
    click(btn);
    click(btn);
    expect(btn.textContent).toBe("clicks: 3");

    setBlocky(true);
    expect(tags(root)).toEqual(["P", "BLOCKQUOTE", "P"]);
    // Same node (not remounted), same state, still reactive.
    expect(root.querySelector("button")).toBe(btn);
    expect(btn.textContent).toBe("clicks: 3");
    click(btn);
    expect(btn.textContent).toBe("clicks: 4");

    setBlocky(false);
    expect(root.querySelectorAll("p")).toHaveLength(1);
    expect(root.querySelector("button")?.textContent).toBe("clicks: 4");
  });
});

describe("textOf", () => {
  test("recovers text through elements and numbers", () => {
    const root = mount(() => (
      <Reforest>
        <h2>
          The <em>fine</em> print {42}
        </h2>
      </Reforest>
    ));
    const h = root.querySelector("h2");
    if (!h) throw new Error("no h2");
    expect(textOf(h)).toBe("The fine print 42");
  });
});

describe("smart punctuation (the string rules + the DOM walk)", () => {
  test("Pollen's own test vectors", async () => {
    const { smartDashesString, smartQuotesString, smartEllipsesString } =
      await import("../src/smart");
    // Pollen sets dashes tight; Nota does not touch the author's spacing (see smart.ts).
    expect(smartDashesString("I had --- maybe 13 -- 20 --- hob-nobs.")).toBe(
      "I had — maybe 13 – 20 — hob-nobs."
    );
    expect(smartDashesString("tight---em and tight--en")).toBe(
      "tight—em and tight–en"
    );
    // An already-smart dash is a fixed point, spacing included (idempotence).
    expect(smartDashesString("a — b")).toBe("a — b");
    expect(smartDashesString("a – b")).toBe("a – b");
    const tricky =
      '"Why," she could\'ve asked, "are we in O‘ahu watching \'Mame\'?"';
    expect(smartQuotesString(tricky)).toBe(
      "“Why,” she could’ve asked, “are we in O‘ahu watching ‘Mame’?”"
    );
    expect(smartQuotesString('"what\'s in it for me?",')).toBe(
      "“what’s in it for me?”,"
    );
    expect(smartQuotesString("\"'Impossible.' Yes.\"")).toBe(
      "“‘Impossible.’ Yes.”"
    );
    expect(smartQuotesString('("No.")')).toBe("(“No.”)");
    expect(smartEllipsesString("so...")).toBe("so…");
    // The Nota divergence: dashes touch no whitespace, so the paragraph break survives.
    expect(smartDashesString("a --\n\nb")).toBe("a –\n\nb");
  });

  test("the DOM walk transforms text nodes, skips exclusions, and is idempotent", async () => {
    const { smarten } = await import("../src/smart");
    const el = document.createElement("div");
    el.innerHTML =
      'say "hi" and <code>"raw"</code> and <span data-nota-nosmart="">"keep"</span>';
    smarten([el]);
    const once = el.innerHTML;
    expect(once).toContain("say “hi”");
    expect(once).toContain('<code>"raw"</code>');
    expect(once).toContain('"keep"');
    smarten([el]);
    expect(el.innerHTML).toBe(once); // idempotent
  });

  test("an excluded region reads as one word for quote context", async () => {
    const { smarten } = await import("../src/smart");
    const el = document.createElement("div");
    el.innerHTML = "<code>f</code>'s output";
    smarten([el]);
    // The apostrophe after the code span is an apostrophe, not an opening quote.
    expect(el.innerHTML).toContain("</code>’s output");
  });
});

describe("attrs markers (client)", () => {
  test("the <Attrs> component decorates the forming paragraph; the marker leaves no DOM remnant", () => {
    const root = mount(() => (
      <Reforest>
        {"styled text "}
        <Attrs class="note" data-x="1" />
        {"\n\nplain"}
      </Reforest>
    ));
    const ps = root.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0].classList.contains("nota-para")).toBe(true);
    expect(ps[0].classList.contains("note")).toBe(true);
    expect(ps[0].getAttribute("data-x")).toBe("1");
    expect(ps[0].textContent).toContain("styled text");
    expect(ps[1].className).toBe("nota-para"); // the next paragraph is untouched
    expect(root.querySelector("[data-nota-attrs]")).toBeNull(); // marker stripped from the output
  });

  test("a lone <Attrs> decorates the preceding paragraph", () => {
    const root = mount(() => (
      <Reforest>
        {"first para"}
        {"\n\n"}
        <Attrs class="x" />
        {"\n\n"}
        {"second"}
      </Reforest>
    ));
    const ps = root.querySelectorAll("p");
    expect(ps).toHaveLength(2);
    expect(ps[0].classList.contains("x")).toBe(true);
    expect(ps[0].textContent).toBe("first para");
    expect(ps[1].classList.contains("x")).toBe(false);
    expect(root.querySelector("[data-nota-attrs]")).toBeNull();
  });

  test("parse extracts marker attributes onto the paragraph", async () => {
    const { parse } = await import("../src/reforest");
    const marker = document.createElement("span");
    marker.setAttribute("data-nota-attrs", "");
    marker.setAttribute("class", "note");
    marker.setAttribute("data-x", "1");
    const items = parse(["text ", marker]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: "para",
      attrs: { class: "note", "data-x": "1" }
    });
  });

  test("tight mode swallows markers", async () => {
    const { parse } = await import("../src/reforest");
    const marker = document.createElement("span");
    marker.setAttribute("data-nota-attrs", "");
    marker.setAttribute("class", "x");
    const items = parse(["item ", marker], { tight: true });
    expect(items).toEqual([{ kind: "bare", nodes: ["item "] }]);
  });
});
