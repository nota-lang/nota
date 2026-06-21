/**
 * A read-only CM6 viewer for output panes — same line numbers + wrapping as the {@link Editor}, but
 * with editing disabled and none of the history/keymap/onChange machinery. Token colors come from the
 * optional `language` extension (the JS parser + Catppuccin highlight in {@link jsLanguage}); without
 * one it's plain, theme-inherited monospace text. A thin React wrapper owning the `EditorView`.
 */

import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { useEffect, useRef } from "react";

export interface CodeViewProps {
  value: string;
  /** Optional language/highlighting extension (e.g. {@link jsLanguage} for the Generated-JS pane). */
  language?: Extension;
}

export function CodeView({ value, language }: CodeViewProps) {
  const host = useRef<HTMLDivElement | null>(null);
  const view = useRef<EditorView | null>(null);

  // Mount once. `language` is captured at mount; it is static for the pane's lifetime.
  useEffect(() => {
    if (!host.current) return;
    const extensions: Extension[] = [
      lineNumbers(),
      EditorView.lineWrapping,
      EditorView.editable.of(false),
      EditorState.readOnly.of(true)
    ];
    if (language) extensions.push(language);

    const v = new EditorView({ doc: value, extensions, parent: host.current });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-once; value handled below.
  }, [language]);

  // Mirror external `value` changes (a fresh format / a new compile) into the document.
  useEffect(() => {
    const v = view.current;
    if (!v) return;
    const current = v.state.doc.toString();
    if (current !== value) {
      v.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return <div className="code-view" ref={host} />;
}
