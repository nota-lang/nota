/** Forward-reference and interaction fixtures using core primitives, independent of prelude. */

import {
  children,
  createSignal,
  For,
  type ParentProps,
  untrack
} from "solid-js";
import { NotaDoc, type SmartOptions, textOf, useDocState } from "../../src/lib";

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
    // One-shot read at registration; see the note in fixtures/doc.tsx.
    text: untrack(() => textOf(resolved.toArray()))
  });
  return <h2 id={props.id}>{resolved()}</h2>;
}

function MiniToc() {
  const state = useDocState();
  return (
    <nav class="toc">
      <For each={state.read("heading")} keyed={false}>
        {e => <a href={`#${e().id as string}`}>{e().text as string}</a>}
      </For>
    </nav>
  );
}

/**
 * Registers the "colophon" trailer on first use (idempotent), renders nothing in place — core's
 * stand-in for the prelude's `DefBank`/`NotesList`, so this fixture exercises `TrailerOutlet`
 * under a real hydrate.
 */
function WithColophon() {
  useDocState().trailer("colophon", () => (
    <footer class="colophon">fin</footer>
  ));
  return null;
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
      <WithColophon />
    </NotaDoc>
  );
}

/** A second, distinct document — the client-navigation and two-documents-per-page cases. */
export function OtherDoc() {
  return (
    <NotaDoc>
      <MiniToc />
      <MiniHeading id="gamma">Gamma</MiniHeading>
      {"Gamma body text."}
    </NotaDoc>
  );
}

/** Two whole documents on one page: each hosts itself, each claims its own seed. */
export function Pair() {
  return (
    <>
      <Doc />
      <OtherDoc />
    </>
  );
}

/**
 * A document that needs a third pass: `echo` counts the headings, which the first pass has not
 * registered yet when it renders. Pass 2 sees one, pass 3 reproduces it — a fixpoint one level
 * deeper than the forward reference in {@link Doc}.
 */
export function SettlingDoc(props: { maxPasses?: number }) {
  const Echo = () => {
    const state = useDocState();
    state.register("echo", { n: state.read("heading").length });
    return null;
  };
  return (
    <NotaDoc maxPasses={props.maxPasses}>
      <Echo />
      <MiniHeading id="alpha">Alpha</MiniHeading>
    </NotaDoc>
  );
}

/** A document with no fixpoint at all: `echo` flips between 1 and 0 on every pass. */
export function DivergentDoc() {
  const Flip = () => {
    const state = useDocState();
    const prev = state.read("echo")[0]?.n as number | undefined;
    state.register("echo", { n: prev === 1 ? 0 : 1 });
    return null;
  };
  return (
    <NotaDoc>
      <Flip />
      <MiniHeading id="alpha">Alpha</MiniHeading>
    </NotaDoc>
  );
}

/** Smart-punctuation probe: straight forms in, curly forms out unless the pass is off. */
export function SmartDoc(props: { smart?: SmartOptions | false }) {
  return <NotaDoc smart={props.smart}>{'"quoted" -- dashed'}</NotaDoc>;
}

/** Stand-in for a route that is not a Nota document. */
export function PlainRoute() {
  return <p class="plain">not a document</p>;
}
