import React, { useContext, useState, useEffect, useRef } from "react";
import type { SyntaxNode } from "@lezer/common";
import indentString from "indent-string";
import { ErrorBoundary } from "react-error-boundary";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { action } from "mobx";
import { nota } from "@nota-lang/nota-syntax";
import _ from "lodash";
import { is_err, is_ok, err, ok, Result, unwrap } from "@nota-lang/nota-common";
import {peerImports} from "@nota-lang/nota-components/dist/peer-imports.js";

import { StateContext, TranslationResult } from "./nota-editor";
import { theme } from "./editor";

let ErrorView: React.FC = ({ children }) => <pre className="translate-error">{children}</pre>;

let nota_lang = nota();
export let ParseView: React.FC = () => {
  let state = useContext(StateContext)!;
  let tree = nota_lang.language.parser.parse(state.contents);

  let depth = (node: SyntaxNode): number => (node.parent ? 1 + depth(node.parent) : 0);

  let output = "";
  let cursor = tree.cursor();
  do {
    let sub_input = state.contents.slice(cursor.from, cursor.to);
    if (sub_input.length > 30) {
      sub_input = sub_input.slice(0, 12) + "..." + sub_input.slice(-12);
    }
    sub_input = sub_input.replace("\n", "\\n");
    output += indentString(`${cursor.name}: "${sub_input}"`, 2 * depth(cursor.node)) + "\n";
  } while (cursor.next());

  return <pre>{output}</pre>;
};

export let JsView: React.FC<{ result: TranslationResult }> = ({ result }) => {
  let ref = useRef<HTMLDivElement>(null);
  let [editor, set_editor] = useState<EditorView | null>(null);

  useEffect(() => {
    if (is_err(result)) {
      return;
    }

    if (!editor) {
      editor = new EditorView({
        state: EditorState.create({
          doc: "",
          extensions: [basicSetup, javascript(), theme, EditorView.editable.of(false)],
        }),
        parent: ref.current!,
      });
      set_editor(editor);
    }

    let js = result.value.transpiled;
    try {
      js = prettier.format(js, { parser: "babel", plugins: [parserBabel] });
    } catch (e) {
      console.error(e);
    }

    editor.dispatch({
      changes: { from: 0, to: editor.state.doc.toString().length, insert: js },
    });
  }, [result]);

  return (
    <>
      {is_err(result) ? <ErrorView>{result.value}</ErrorView> : null}
      <div className="js-view" ref={ref} />
    </>
  );
};

let nota_require = (path: string): any => {
  if (path == "@nota-lang/nota-components/dist/peer-imports.mjs") {
    return { peerImports };
  }
  if (!(path in peerImports)) {
    throw `Cannot import ${path}`;
  }
  return peerImports[path];
};

let execute = (result: TranslationResult): Result<React.FC, JSX.Element> => {
  if (is_err(result)) {
    return err(<>{result.value}</>);
  }

  let Doc;
  try {
    let f = new Function(
      "require",
      result.value.lowered + `\n; return nota_document.default; //# sourceURL=document.js`
    );
    Doc = f(nota_require);
  } catch (e: any) {
    console.error(e);
    return err(<>{e.stack}</>);
  }

  return ok(Doc);
};

let counter = 0;
export let OutputView: React.FC<{ result: TranslationResult }> = ({ result }) => {
  let [last_translation] = useState<{ t: JSX.Element | null }>({ t: null });

  let DocResult = execute(result);

  let errored = false;
  useEffect(
    action(() => {
      if (errored) {
        errored = false;
        return;
      }
      let Doc = unwrap(DocResult);
      last_translation.t = <Doc key={counter++} />;
    }),
    [result]
  );

  let fallback = (err: JSX.Element) => {
    errored = true;
    return (
      <>
        <ErrorView>{err}</ErrorView>
        {last_translation.t}
      </>
    );
  };

  return (
    <>
      {is_ok(result) && result.value.css ? <style>{result.value.css}</style> : null}
      <ErrorBoundary
        resetKeys={[result]}
        FallbackComponent={({ error }) => fallback(<>{error.stack}</>)}
      >
        {is_ok(DocResult) ? <DocResult.value key={counter++} /> : fallback(DocResult.value)}
      </ErrorBoundary>
    </>
  );
};
