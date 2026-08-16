/**
 * A read-only CM6 viewer for output panes — same line numbers + wrapping as the {@link Editor},
 * but with editing disabled and none of the history/keymap/onChange machinery. Token colors come
 * from the optional `language` extension; without one it's plain monospace text. A thin Solid
 * wrapper owning the `EditorView`.
 */

import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { createEffect, onCleanup, onMount } from "solid-js";

export interface CodeViewProps {
  value: string;
  /** Optional language/highlighting extension (e.g. the JS mode for the compiled pane). */
  language?: Extension;
}

export function CodeView(props: CodeViewProps) {
  let host!: HTMLDivElement;
  let view: EditorView | null = null;

  onMount(() => {
    const extensions: Extension[] = [
      lineNumbers(),
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true)
    ];
    if (props.language) extensions.push(props.language);
    view = new EditorView({ doc: props.value, extensions, parent: host });
  });

  onCleanup(() => {
    view?.destroy();
    view = null;
  });

  // Mirror external `value` changes (a fresh format / a new compile) into the document.
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

  return <div class="code-view" ref={host} />;
}
