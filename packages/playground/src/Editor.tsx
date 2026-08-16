/**
 * The CM6 editor (left pane). A thin Solid wrapper that owns the `EditorView` lifecycle and
 * pushes doc changes up through `onChange`. The `language` extension (Nota highlighting) is held
 * in a Compartment so it can be swapped without rebuilding the editor.
 */

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
import { createEffect, onCleanup, onMount } from "solid-js";

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Language/highlighting extension; hot-swappable. */
  language?: Extension;
  /** Static extensions included at mount (e.g. the LSP plugin); not hot-swappable. */
  extensions?: Extension;
}

export function Editor(props: EditorProps) {
  let host!: HTMLDivElement;
  let view: EditorView | null = null;
  const langCompartment = new Compartment();

  onMount(() => {
    view = new EditorView({
      doc: props.value,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        // Tab indents / Shift-Tab dedents. CM6 leaves Tab unbound by default (it keeps Tab for
        // focus traversal); this editor is the primary focus target, so we opt into tab-to-indent.
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
  });

  onCleanup(() => {
    view?.destroy();
    view = null;
  });

  // Swap the language extension in/out when it changes (e.g. an async highlighter resolving).
  createEffect(() => {
    const language = props.language;
    view?.dispatch({
      effects: langCompartment.reconfigure(language ?? [])
    });
  });

  // Reflect external `value` changes (e.g. "load example") back into the editor.
  createEffect(() => {
    const value = props.value;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value }
      });
    }
  });

  return <div class="editor" ref={host} />;
}
