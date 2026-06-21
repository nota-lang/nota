/**
 * The CM6 editor (left pane). Plain text in phase R; the `nota` `StreamLanguage` highlighting
 * (phase T) is wired via the optional `language` extension. A thin React wrapper that owns the
 * `EditorView` lifecycle and pushes doc changes up through `onChange`.
 */

import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import type { Extension } from "@codemirror/state";
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
  /** Optional language/highlighting extension (the `nota` StreamLanguage in phase T). */
  language?: Extension;
}

export function Editor({ value, onChange, language }: EditorProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);
  // Keep the latest onChange without recreating the editor.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  // Mount once. `language` is captured at mount; it is static for the app's lifetime.
  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      lineNumbers(),
      history(),
      highlightActiveLine(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      EditorView.lineWrapping,
      EditorView.updateListener.of(update => {
        if (update.docChanged) {
          onChangeRef.current(update.state.doc.toString());
        }
      })
    ];
    if (language) extensions.push(language);

    const v = new EditorView({
      doc: value,
      extensions,
      parent: host.current
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; value handled below.
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
