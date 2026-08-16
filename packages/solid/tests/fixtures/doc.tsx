/**
 * The shared fixture document for the render (ssr) and hydrate (dom) suites: exercises the
 * Reforest pass (paragraph inference, list coalescing, sections) and the doc-state store with a
 * *forward* reference (a Toc above its headings), a stateful widget, a trailer, and a
 * `<Show>`-gated heading for post-hydration doc-state reactivity.
 *
 * The mini Heading/Toc here use the store primitives directly — the prelude's real components
 * layer slugs/numbering on the same calls.
 */
import {
  children,
  createSignal,
  Index,
  type ParentProps,
  Show
} from "solid-js";
import { NotaDoc, textOf, UlLi, useDocState } from "../../src/lib";

export function Counter() {
  const [n, setN] = createSignal(0);
  return (
    <button class="counter" type="button" onClick={() => setN(n() + 1)}>
      clicks: {n()}
    </button>
  );
}

function MiniHeading(props: ParentProps & { id: string }) {
  const state = useDocState();
  const resolved = children(() => props.children);
  state.register("heading", {
    id: props.id,
    rank: 2,
    text: textOf(resolved.toArray())
  });
  return <h2 id={props.id}>{resolved()}</h2>;
}

function MiniToc() {
  const state = useDocState();
  return (
    <nav class="toc">
      <Index each={state.read("heading")}>
        {e => <a href={`#${e().id as string}`}>{e().text as string}</a>}
      </Index>
    </nav>
  );
}

/** Registers the "colophon" trailer on first use (idempotent), renders nothing in place. */
function WithColophon() {
  const state = useDocState();
  state.trailer("colophon", () => <footer class="colophon">fin</footer>);
  return null;
}

export function Doc() {
  const [extra, setExtra] = createSignal(false);
  return (
    <NotaDoc>
      {"Intro paragraph with a "}
      <Counter />
      {" widget riding along.\n\nSecond paragraph before the contents."}
      <MiniToc />
      <MiniHeading id="alpha">Alpha</MiniHeading>
      {"Alpha body text."}
      <UlLi>one</UlLi>
      <UlLi>two</UlLi>
      <MiniHeading id="beta">Beta</MiniHeading>
      {"Beta body text."}
      <Show when={extra()}>
        <MiniHeading id="gamma">Gamma</MiniHeading>
      </Show>
      <button class="add-heading" type="button" onClick={() => setExtra(true)}>
        add heading
      </button>
      <WithColophon />
    </NotaDoc>
  );
}
