import React, { useContext, useState, useEffect, useRef } from "react";
import type { SyntaxNode } from "@lezer/common";
import { observer } from "mobx-react";
import indentString from "indent-string";
import classNames from "classnames";
import { ErrorBoundary } from "react-error-boundary";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { reaction } from "mobx";

import { StateContext, is_err, TranslateResult, is_ok } from "./state";
import { theme } from "./editor";

export let Viewer = () => {
  let state = useContext(StateContext)!;
  let [selected, set_selected] = useState(0);
  let options = ["Output", "Parse tree", "Generated JS"];
  let ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let el = ref.current;
    if (!el) {
      return;
    }

    let last_scroll = 0;
    el.addEventListener("scroll", _ => {
      let scroll = el!.scrollTop;
      let t = state.translation;
      if (t && t.translation && is_ok(t.translation) && scroll > 0) {
        last_scroll = scroll;
      }
    });

    reaction(
      () => [state.translation],
      () => {
        if (el!.scrollTop == 0) {
          el!.scrollTo(0, last_scroll);
        }
      }
    );
  }, [ref]);

  return (
    <div>
      <div>
        {options.map((key, i) => (
          <button
            key={key}
            onClick={() => set_selected(i)}
            className={classNames({ active: selected == i })}
          >
            {key}
          </button>
        ))}
      </div>
      <div className="viewer" ref={ref}>
        <Inner selected={selected} />
      </div>
    </div>
  );
};

let ErrorView: React.FC = ({ children }) => <pre className="error">{children}</pre>;

let TranslateErrorView: React.FC<{ result: TranslateResult }> = ({ result }) => {
  let err_type;
  let err;
  if (is_err(result.tree)) {
    err_type = "Parse error";
    err = result.tree.value;
  } else if (is_err(result.translation!)) {
    err_type = "Translation error";
    err = result.translation.value;
  } else if (is_err(result.imports!)) {
    err_type = "Import error";
    err = result.imports.value;
  } else if (is_err(result.Element!)) {
    err_type = "JS parsing error";
    err = result.Element.value;
  } else {
    throw `No error`;
  }

  return (
    <ErrorView>
      {err_type}: {err.toString()}
    </ErrorView>
  );
};

let Inner: React.FC<{ selected: number }> = observer(({ selected }) => {
  let state = useContext(StateContext)!;
  let data = state.translation;

  if (!data) {
    return <>Loading...</>;
  } else if (selected == 1) {
    return <ParseView result={data} />;
  } else if (selected == 2) {
    return <JSView result={data} />;
  } else if (selected == 0) {
    return <OutputView result={data} />;
  }

  return null;
});

let ParseView: React.FC<{ result: TranslateResult }> = ({ result }) => {
  if (is_err(result.tree)) {
    return <TranslateErrorView result={result} />;
  }

  let depth = (node: SyntaxNode): number => (node.parent ? 1 + depth(node.parent) : 0);

  let output = "";
  let cursor = result.tree.value.cursor();
  do {
    let sub_input = result.contents.slice(cursor.from, cursor.to);
    if (sub_input.length > 30) {
      sub_input = sub_input.slice(0, 12) + "..." + sub_input.slice(-12);
    }
    output += indentString(`${cursor.name}: "${sub_input}"`, 2 * depth(cursor.node)) + "\n";
  } while (cursor.next());

  return <pre>{output}</pre>;
};

let JSView: React.FC<{ result: TranslateResult }> = ({ result }) => {
  let translation = result.translation;
  let ref = useRef<HTMLDivElement>(null);
  let [editor, set_editor] = useState<EditorView | null>(null);

  useEffect(() => {
    if (!translation || is_err(translation)) {
      return;
    }

    if (!editor) {
      editor = new EditorView({
        state: EditorState.create({ doc: "", extensions: [basicSetup, javascript(), theme] }),
        parent: ref.current!,
      });
      set_editor(editor);
    }

    let js = translation.value.js;
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
      {!translation || is_err(translation) ? <TranslateErrorView result={result} /> : null}
      <div ref={ref} />
    </>
  );
};

let OutputView: React.FC<{ result: TranslateResult }> = ({ result }) => {
  let Element = result.Element;
  if (!Element || is_err(Element)) {
    return <TranslateErrorView result={result} />;
  }

  return (
    <ErrorBoundary
      resetKeys={[result.contents]}
      FallbackComponent={({ error }) => <ErrorView>Runtime error: {error.message}</ErrorView>}
    >
      <Element.value />
    </ErrorBoundary>
  );
};
