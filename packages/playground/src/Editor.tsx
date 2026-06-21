/**
 * The CM6 editor (left pane). A thin React wrapper that owns the `EditorView` lifecycle and pushes
 * doc changes up through `onChange`. The `language` extension (Nota highlighting) is held in a
 * Compartment so it can be swapped in *after* mount without rebuilding the editor — the Shiki-backed
 * highlighter loads asynchronously, so `App` passes `[]` first and the real extension once ready.
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
import { useEffect, useRef } from "react";

export interface EditorProps {
  value: string;
  onChange: (value: string) => void;
  /** Language/highlighting extension; hot-swappable (the Nota highlighter loads async). */
  language?: Extension;
}

export function Editor({ value, onChange, language }: EditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  const langCompartment = useRef(new Compartment());
  // Keep the latest onChange without recreating the editor.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Mount once. `language` enters through the compartment and is reconfigured by the effect below.
  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({
      doc: value,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        // Tab indents / Shift-Tab dedents. CM6 leaves Tab unbound by default (it keeps Tab for
        // focus traversal); this editor is the primary focus target, so we opt into tab-to-indent.
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        EditorView.lineWrapping,
        langCompartment.current.of(language ?? []),
        EditorView.updateListener.of(update => {
          if (update.docChanged) {
            onChangeRef.current(update.state.doc.toString());
          }
        })
      ],
      parent: host.current
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; value/language handled below.
  }, []);

  // Swap the language extension in/out when it changes (e.g. the async highlighter resolving).
  useEffect(() => {
    view.current?.dispatch({
      effects: langCompartment.current.reconfigure(language ?? [])
    });
  }, [language]);

  // Reflect external `value` changes (e.g. "load example") back into the editor.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({
        changes: { from: 0, to: current.length, insert: value }
      });
    }
  }, [value]);

  return <div className="editor" ref={host} />;
}
