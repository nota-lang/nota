/**
 * The fixture document for both suites: a *forward* reference (a Toc rendered above the headings
 * it lists) is the whole reason a document needs two passes, and a counter gives hydration
 * something to prove it claimed rather than rebuilt.
 *
 * Deliberately built from core's store primitives rather than the prelude, so these tests pin
 * this package's seam and not the prelude's component surface.
 */

import { children, createSignal, Index, type ParentProps } from "solid-js";
import { NotaDoc, textOf, useDocState } from "../../src/lib";

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

/** The forward-reference document: the Toc precedes the headings it must list. */
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

/** A second, distinct document — the client-navigation case (renders unseeded). */
export function OtherDoc() {
  return (
    <NotaDoc>
      <MiniToc />
      <MiniHeading id="gamma">Gamma</MiniHeading>
      {"Gamma body text."}
    </NotaDoc>
  );
}

/** A document whose facts depend on reading facts — can never converge. */
export function DivergentDoc() {
  const Echo = () => {
    const state = useDocState();
    state.register("echo", { n: state.read("heading").length });
    return null;
  };
  return (
    <NotaDoc>
      <Echo />
      <MiniHeading id="alpha">Alpha</MiniHeading>
    </NotaDoc>
  );
}

/** Stand-in for a route that is not a Nota document. */
export function PlainRoute() {
  return <p class="plain">not a document</p>;
}
