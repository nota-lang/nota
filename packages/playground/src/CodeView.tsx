/** Solid lifecycle wrapper around a read-only CodeMirror pane. */

import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { createEffect, onCleanup, onMount } from "solid-js";

export interface CodeViewProps {
  value: string;
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
