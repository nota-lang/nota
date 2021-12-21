import React, { useEffect, useRef, useContext } from "react";
import { action } from "mobx";
import { nota, js } from "@nota-lang/nota-syntax";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { keymap } from "@codemirror/view";
import { tags as t, HighlightStyle } from "@codemirror/highlight";
import { indentWithTab } from "@codemirror/commands";

import { StateContext } from "./nota-editor";

export let theme = EditorView.theme({
  "&": {
    height: "100%",
  },
  "&.cm-editor.cm-focused": {
    outline: "0",
  },
  ".cm-scroller": {
    fontFamily: "Inconsolata, monospace",
    lineHeight: '1.3',
  },
  ".cm-gutters": {
    background: "none",
    border: "none",
  },
  ".cm-highlight": {
    padding: "0 2px",
    margin: "-1px -2px",
    borderRadius: "2px",
  },
});

let nota_lang = nota();
let js_lang = js();

let nota_style = HighlightStyle.define(
  [
    { tag: t.string, class: "nota-text" },
    { tag: t.variableName, color: "#164" },
    { tag: t.definitionKeyword, color: "#219" },
    { tag: t.comment, color: "#940" },
  ],
  {
    scope: nota_lang.language.topNode,
  }
);

let js_style = HighlightStyle.define(
  [
    { tag: t.link, textDecoration: "underline" },
    { tag: t.heading, textDecoration: "underline", fontWeight: "bold" },
    { tag: t.emphasis, fontStyle: "italic" },
    { tag: t.strong, fontWeight: "bold" },
    { tag: t.strikethrough, textDecoration: "line-through" },
    { tag: t.keyword, color: "#708" },
    { tag: [t.atom, t.bool, t.url, t.contentSeparator, t.labelName], color: "#219" },
    { tag: [t.literal, t.inserted], color: "#164" },
    { tag: [t.string, t.deleted], color: "#a11" },
    { tag: [t.regexp, t.escape, t.special(t.string)], color: "#e40" },
    { tag: t.definition(t.variableName), color: "#00f" },
    { tag: t.local(t.variableName), color: "#30a" },
    { tag: [t.typeName, t.namespace], color: "#085" },
    { tag: t.className, color: "#167" },
    { tag: [t.special(t.variableName), t.macroName], color: "#256" },
    { tag: t.definition(t.propertyName), color: "#00c" },
    { tag: t.comment, color: "#940" },
    { tag: t.meta, color: "#7a757a" },
    { tag: t.invalid, color: "#f00" },
  ],
  {
    scope: js_lang.language.topNode,
  }
);

export let Editor = () => {
  let ref = useRef<HTMLDivElement>(null);
  let state = useContext(StateContext)!;

  useEffect(() => {
    let lang_exts = [nota_lang, js_lang];
    let visual_exts = [nota_style, js_style, theme, EditorView.lineWrapping];
    let editing_exts = [keymap.of([indentWithTab])];
    let custom_exts = [
      EditorView.updateListener.of(
        action(update => {
          if (update.docChanged) {
            state.contents = update.state.doc.toJSON().join("\n");
          }
        })
      ),
    ];
    let _editor = new EditorView({
      state: EditorState.create({
        doc: state.contents,
        extensions: [basicSetup, lang_exts, visual_exts, editing_exts, custom_exts],
      }),
      parent: ref.current!,
    });
  }, []);

  return <div ref={ref} />;
};
