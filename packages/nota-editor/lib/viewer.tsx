import { EditorState, EditorView, basicSetup } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { Result, err, isErr, isOk, ok, resUnwrap } from "@nota-lang/nota-common/dist/result.js";
import type { DocumentProps } from "@nota-lang/nota-components/dist/document.js";
import { nota } from "@nota-lang/nota-syntax/dist/editor/mod.js";
import { treeToString } from "@nota-lang/nota-syntax/dist/translate/mod";
import _ from "lodash";
import { action } from "mobx";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import React, { useContext, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { StateContext, TranslationResult } from ".";
import { dynamicLoad } from "./dynamic-load.js";
import { theme } from "./editor.js";

let ErrorView: React.FC = ({ children }) => <pre className="translate-error">{children}</pre>;

let notaLang = nota();
export let ParseView: React.FC = () => {
  let state = useContext(StateContext)!;
  let tree = notaLang.language.parser.parse(state.contents);
  let output = treeToString(tree, state.contents);
  return <pre>{output}</pre>;
};

export let JsView: React.FC<{ result: TranslationResult }> = ({ result }) => {
  let ref = useRef<HTMLDivElement>(null);
  let [editor, setEditor] = useState<EditorView | null>(null);

  useEffect(() => {
    if (isErr(result)) {
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
      setEditor(editor);
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
      {isErr(result) ? <ErrorView>{result.value}</ErrorView> : null}
      <div className="js-view" ref={ref} />
    </>
  );
};

let execute = (
  result: TranslationResult,
  imports: any
): Result<React.FC<DocumentProps>, JSX.Element> => {
  if (isErr(result)) {
    return err(<>{result.value}</>);
  }

  let Doc;
  try {
    Doc = dynamicLoad({
      script: result.value.lowered,
      url: "document.js",
      imports,
    }).default;
  } catch (e: any) {
    console.error(e);
    return err(<>{e.stack}</>);
  }

  return ok(Doc);
};

let counter = 0;
export let OutputView: React.FC<{ result: TranslationResult; imports?: any }> = ({
  result,
  imports,
}) => {
  let state = useContext(StateContext)!;
  let [lastTranslation] = useState<{ t: JSX.Element | null }>({ t: null });

  let DocResult = execute(result, imports || {});

  let errored = false;
  useEffect(
    action(() => {
      if (errored) {
        errored = false;
        return;
      }
      let Doc = resUnwrap(DocResult);
      lastTranslation.t = <Doc key={counter++} editing />;
    }),
    [result]
  );

  let fallback = (err: JSX.Element) => {
    errored = true;
    return (
      <>
        <ErrorView>{err}</ErrorView>
        {lastTranslation.t}
      </>
    );
  };

  let ResetRuntimeError: React.FC<{ result: any }> = action(() => {
    state.runtimeError = undefined;
    return null;
  });

  return (
    <>
      {isOk(result) && result.value.css ? <style>{result.value.css}</style> : null}
      <ErrorBoundary
        resetKeys={[result]}
        FallbackComponent={action(({ error }) => {
          // Place error into global state so editor can visualize it.
          state.runtimeError = error;

          let err = (
            <div>
              <div>Runtime exception raised: {error.message}</div>
              <div>(for a full stack trace, open the developer tools console)</div>
            </div>
          );

          return fallback(err);
        })}
      >
        {isOk(DocResult) ? <DocResult.value key={counter++} editing /> : fallback(DocResult.value)}
        <ResetRuntimeError result={result} />
      </ErrorBoundary>
    </>
  );
};
