/** Exercise effect cleanup, editor updates, preview lifecycle, and Solid dev diagnostics. */

import { render } from "@solidjs/web";
import { createSignal, flush } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { CodeView } from "../src/CodeView";
import { Editor } from "../src/Editor";
import { RenderedPane } from "../src/RenderedPane";
import type { DocFn } from "../src/solid-eval";

/** Everything Solid's dev build said while a test ran. */
let spoke: string[] = [];
beforeEach(() => {
  spoke = [];
  for (const level of ["warn", "error"] as const) {
    vi.spyOn(console, level).mockImplementation((...args: unknown[]) => {
      spoke.push(args.map(String).join(" "));
    });
  }
});
afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const expectSilent = () => expect(spoke).toEqual([]);

/** Flush writes and the preview's deferred mount. */
const settle = async () => {
  flush();
  await Promise.resolve();
};

/** Mount into a detached host the test owns, and hand back its disposer. */
function mount(code: () => unknown): {
  host: HTMLDivElement;
  stop: () => void;
} {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const dispose = render(code as () => never, host);
  return {
    host,
    stop: () => {
      dispose();
      host.remove();
    }
  };
}

/** A minimal evaluated-document stand-in: the shape `RenderedPane` mounts. */
const docNamed = (text: string): DocFn => {
  return () => {
    const p = document.createElement("p");
    p.textContent = text;
    return p;
  };
};

/** Box functions: createSignal(fn) creates a writable derived in Solid 2. */
const box = (Doc: DocFn | null) => ({ Doc });

describe("RenderedPane", () => {
  it("mounts the document, re-mounts on a new evaluation, and survives going inactive", async () => {
    const [doc, setDoc] = createSignal(box(docNamed("first")));
    const [version, setVersion] = createSignal(1);
    const [active, setActive] = createSignal(true);
    const { host, stop } = mount(() => (
      <RenderedPane Doc={doc().Doc} docVersion={version()} active={active()} />
    ));
    const frame = host.querySelector('[data-testid="pane-rendered"]');
    // The nested root mounts a microtask after the effect that requested it.
    expect(frame?.textContent).toBe("");
    await settle();
    expect(frame?.textContent).toBe("first");

    // A new evaluation replaces the mounted document. `docVersion` is the pipeline's
    // "this is new output" counter, so the apply step must run for it alone too.
    setDoc(box(docNamed("second")));
    setVersion(2);
    await settle();
    expect(frame?.textContent).toBe("second");

    // Going inactive must NOT unmount: the host is merely hidden (`display: none`) and the
    // live preview keeps its signal state across tab switches. This is why the disposer is a
    // component-level `onCleanup` and not the apply step's returned cleanup.
    setActive(false);
    await settle();
    expect(frame?.textContent).toBe("second");

    // A new evaluation arriving while inactive is deferred until the pane is shown again.
    setDoc(box(docNamed("third")));
    setVersion(3);
    await settle();
    expect(frame?.textContent).toBe("second");
    setActive(true);
    await settle();
    expect(frame?.textContent).toBe("third");

    stop();
    expectSilent();
  });

  it("tears the preview down when the pane itself is disposed", async () => {
    const { host, stop } = mount(() => (
      <RenderedPane Doc={docNamed("gone")} docVersion={1} active={true} />
    ));
    await settle();
    expect(host.textContent).toBe("gone");
    stop();
    expect(host.textContent).toBe("");
    expectSilent();
  });

  it("drops a queued mount that the pane's disposal overtook", async () => {
    const { host, stop } = mount(() => (
      <RenderedPane Doc={docNamed("never")} docVersion={1} active={true} />
    ));
    // Dispose inside the same task that queued the mount: the ticket check is the only thing
    // standing between this and a root rendered into a detached, already-torn-down host.
    stop();
    await settle();
    expect(host.textContent).toBe("");
    expectSilent();
  });

  it("reports a throwing document instead of tearing down the pane", async () => {
    const boom: DocFn = () => {
      throw new Error("kaboom");
    };
    const { host, stop } = mount(() => (
      <RenderedPane Doc={boom} docVersion={1} active={true} />
    ));
    await settle();
    expect(host.querySelector('[data-testid="pane-rendered"]')).toBeTruthy();
    expect(spoke.join("\n")).toContain("preview render failed");
    spoke = [];
    stop();
    expectSilent();
  });
});

describe("CodeView", () => {
  it("builds the editor in onSettled and dispatches later values into that same view", () => {
    const [value, setValue] = createSignal("one");
    const { host, stop } = mount(() => <CodeView value={value()} />);

    const editor = host.querySelector(".cm-editor");
    expect(editor, "onSettled constructed the CodeMirror view").toBeTruthy();
    expect(host.querySelector(".cm-content")?.textContent).toBe("one");

    setValue("two");
    flush();
    // Same view object, updated document — an effect that re-created the view instead of
    // dispatching into it would swap this element out.
    expect(host.querySelector(".cm-editor")).toBe(editor);
    expect(host.querySelector(".cm-content")?.textContent).toBe("two");

    stop();
    expect(document.querySelector(".cm-editor")).toBeNull();
    expectSilent();
  });
});

describe("Editor", () => {
  it("round-trips: external value in, user edit out, and no write loop", () => {
    const [value, setValue] = createSignal("start");
    const seen: string[] = [];
    const { host, stop } = mount(() => (
      <Editor
        value={value()}
        onChange={v => {
          seen.push(v);
          setValue(v);
        }}
      />
    ));
    expect(host.querySelector(".cm-content")?.textContent).toBe("start");

    // An external change reaches the view...
    setValue("outside");
    flush();
    expect(host.querySelector(".cm-content")?.textContent).toBe("outside");
    // ...and the resulting updateListener callback reports exactly that text, once. (The
    // callback writes a signal from inside the effect's apply step — legal in v2, where the
    // owned-scope write guard covers component bodies and pure computations, not apply.)
    expect(seen).toEqual(["outside"]);

    stop();
    expectSilent();
  });
});

describe("App", () => {
  it("debounces the source through the pipeline and shows the emitted JSX", async () => {
    const { host, stop } = mount(() => <App />);
    // The debounce is a real 150ms timer pair created in the effect's apply step.
    await new Promise(resolve => setTimeout(resolve, 250));
    await settle();

    const jsxPane = host.querySelector('[data-testid="pane-jsx"]');
    expect(jsxPane?.textContent).toContain("NotaDoc");
    expect(host.querySelector('[data-testid="error"]')).toBeNull();
    // The seed was persisted by the sibling timer.
    expect(localStorage.getItem("nota-playground:source")).toContain(
      "# Hello, Nota"
    );

    stop();
    expectSilent();
  });

  it("renders the seed document live in the rendered pane", async () => {
    const { host, stop } = mount(() => <App />);
    await new Promise(resolve => setTimeout(resolve, 250));
    await settle();

    const tabs = Array.from(host.querySelectorAll("nav.tabs button"));
    const rendered = tabs.find(t => t.textContent?.startsWith("Rendered"));
    expect(rendered, "the Rendered tab exists").toBeTruthy();
    (rendered as HTMLButtonElement).click();
    await settle();

    const frame = host.querySelector('[data-testid="pane-rendered"]');
    expect(frame?.querySelector("h1")?.textContent).toContain("Hello, Nota");
    expect(frame?.querySelectorAll("ul.nota-list > li")).toHaveLength(3);

    stop();
    expectSilent();
  });
});
