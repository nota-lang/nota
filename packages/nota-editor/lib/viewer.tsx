import { javascript } from "@codemirror/lang-javascript";
import { Result, err, isErr, isOk, ok } from "@nota-lang/nota-common/dist/result.js";
import type { DocumentProps } from "@nota-lang/nota-components/dist/document.js";
import { nota } from "@nota-lang/nota-syntax/dist/editor/mod.js";
import { treeToString } from "@nota-lang/nota-syntax/dist/translate/mod";
import { EditorView, basicSetup } from "codemirror";
import _ from "lodash";
import { action, runInAction } from "mobx";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import React, { useContext, useEffect, useRef, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";

import { State, StateContext, TranslationResult } from ".";
import { dynamicLoad } from "./dynamic-load.js";
import { theme } from "./editor.js";

let ErrorView: React.FC<React.PropsWithChildren> = ({ children }) => (
  <pre className="translate-error">{children}</pre>
);

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
        extensions: [basicSetup, javascript(), theme, EditorView.editable.of(false)],
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
  state: State
): Result<React.FC<DocumentProps>, JSX.Element> => {
  if (isErr(result)) {
    return err(<>{result.value}</>);
  }

  let Doc;
  try {
    Doc = dynamicLoad({
      script: result.value.lowered,
      url: "document.js",
      imports: state.imports || {},
    }).default;
  } catch (e: any) {
    console.error(e);
    return err(<>{e.stack}</>);
  }

  return ok(Doc);
};

let counter = 0;
export let OutputView: React.FC<{ result: TranslationResult }> = ({ result }) => {
  let state = useContext(StateContext)!;
  let [lastTranslation] = useState<{ t: JSX.Element | null }>({ t: null });

  let DocResult = execute(result, state);

  // TODO: lastTranslation thing is causing an infinite error loop?
  let fallback = (err: JSX.Element) => (
    <>
      <ErrorView>{err}</ErrorView>
      {/* {lastTranslation.t} */}
    </>
  );

  runInAction(() => {
    state.rendered = false;
  });

  let inner;
  if (isOk(DocResult)) {
    let el = (
      <DocResult.value
        key={counter++}
        editing
        renderTimeout={200}
        onRender={action(() => {
          state.rendered = true;
        })}
      />
    );
    let ResetRuntimeError = action(() => {
      state.runtimeError = undefined;
      lastTranslation.t = el;
      return null;
    });
    inner = (
      <>
        {el}
        <ResetRuntimeError />
      </>
    );
  } else {
    inner = fallback(DocResult.value);
  }

  // Some kind of weird issue w/ @types/react incompatibility?
  // TODO: Just hand-roll this component, the dependency isn't that important.
  // See: https://reactjs.org/docs/error-boundaries.html
  let Boundary: any = ErrorBoundary;

  return (
    <>
      {isOk(result) && result.value.css ? <style>{result.value.css}</style> : null}
      <Boundary
        resetKeys={[result]}
        FallbackComponent={action(({ error }: { error: Error }) => {
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
        {inner}
      </Boundary>
    </>
  );
};
