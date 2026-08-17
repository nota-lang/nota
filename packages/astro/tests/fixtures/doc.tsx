/**
 * The shared fixture document for the client-entry suite: compiled twice from this one source —
 * SSR (tests/ssg.mjs, producing the island's server bytes with renderId-scoped hydration keys)
 * and DOM (tests/client.test.ts, the program the client entry hydrates with). A forward
 * reference (Toc above its headings) exercises the doc-state seed, a counter exercises
 * interactivity on claimed nodes.
 *
 * The mini Heading/Toc use the store primitives directly — the prelude's real components layer
 * slugs/numbering on the same calls.
 */

import { NotaDoc, textOf, useDocState } from "@nota-lang/core";
import { children, createSignal, Index, type ParentProps } from "solid-js";

function Counter() {
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

export function Doc() {
  return (
    <NotaDoc>
      {"Intro paragraph with a "}
      <Counter />
      {" widget riding along."}
      <MiniToc />
      <MiniHeading id="alpha">Alpha</MiniHeading>
      {"Alpha body text."}
      <MiniHeading id="beta">Beta</MiniHeading>
      {"Beta body text."}
    </NotaDoc>
  );
}
