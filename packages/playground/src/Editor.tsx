/** Solid lifecycle wrapper around the editable CodeMirror pane. */

import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";
import { Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  keymap,
  lineNumbers
} from "@codemirror/view";
import { createEffect, onSettled } from "solid-js";

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: Extension;
  extensions?: Extension;
}

export function Editor(props: EditorProps) {
  let host!: HTMLDivElement;
  let view: EditorView | null = null;
  const langCompartment = new Compartment();

  onSettled(() => {
    view = new EditorView({
      doc: props.value,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        langCompartment.of(props.language ?? []),
        props.extensions ?? [],
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            props.onChange(update.state.doc.toString());
          }
        })
      ],
      parent: host
    });
    return () => {
      view?.destroy();
      view = null;
    };
  });

  // Initial applies may precede setup; the constructor seeds both props.
  createEffect(
    () => props.language,
    language => {
      view?.dispatch({
        effects: langCompartment.reconfigure(language ?? [])
      });
    }
  );

  createEffect(
    () => props.value,
    value => {
      if (!view) return;
      const current = view.state.doc.toString();
      if (current !== value) {
        view.dispatch({
          changes: { from: 0, to: current.length, insert: value }
        });
      }
    }
  );

  return <div class="editor" ref={host} />;
}
