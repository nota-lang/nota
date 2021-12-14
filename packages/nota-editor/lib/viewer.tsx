import React, { useContext, useState, useEffect, useRef } from "react";
import type { SyntaxNode } from "@lezer/common";
import { observer, useLocalObservable } from "mobx-react";
import indentString from "indent-string";
import classNames from "classnames";
import { ErrorBoundary } from "react-error-boundary";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import { basicSetup, EditorView, EditorState } from "@codemirror/basic-setup";
import { javascript } from "@codemirror/lang-javascript";
import { action, makeAutoObservable, reaction } from "mobx";
import { is_err, is_ok, err, ok, Result, unwrap } from "@wcrichto/nota-common";
import type { BuildFailure } from "esbuild";
import * as nota from "@wcrichto/nota";

import { StateContext } from "./state";
import { theme } from "./editor";
import { TranslationResult } from "../bin/server";

export class ViewerState {
  selected: number = 0;

  constructor() {
    makeAutoObservable(this);
  }
}

export let ViewerStateContext = React.createContext<ViewerState | null>(null);

export let ViewerConfig = observer(() => {
  let viewer_state = useContext(ViewerStateContext)!;
  let options = ["Output" /*, "Parse tree", "Generated JS"*/];
  return (
    <div className="viewer-config">
      <div>
        {options.map((key, i) => (
          <button
            key={key}
            onClick={action(() => {
              viewer_state.selected = i;
            })}
            className={classNames({ active: viewer_state.selected == i })}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
});

export let Viewer = observer(() => {
  let viewer_state = useContext(ViewerStateContext)!;
  let state = useContext(StateContext)!;
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
      if (is_ok(t) && scroll > 0) {
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
    <div className="viewer" ref={ref}>
      <Inner selected={viewer_state.selected} />
    </div>
  );
});

let ErrorView: React.FC = ({ children }) => <pre className="error">{children}</pre>;

let TranslateErrorView: React.FC<{ result: BuildFailure }> = ({ result }) => {
  // let err_type;
  // let err;
  // if (is_err(result.tree)) {
  //   err_type = "Parse error";
  //   err = result.tree.value;
  // } else if (is_err(result.translation!)) {
  //   err_type = "Translation error";
  //   err = result.translation.value;
  // } else if (is_err(result.imports!)) {
  //   err_type = "Import error";
  //   err = result.imports.value;
  // } else if (is_err(result.Element!)) {
  //   err_type = "JS parsing error";
  //   err = result.Element.value;
  // } else {
  //   throw `No error`;
  // }

  return (
    <ErrorView>
      {result.errors.map(msg => (
        <div>{msg.text}</div>
      ))}
    </ErrorView>
  );
};

let Inner: React.FC<{ selected: number }> = observer(({ selected }) => {
  let state = useContext(StateContext)!;
  let data = state.translation;

  if (selected == 0) {
    return <OutputView result={data} />;
  }
  /*else if (selected == 1) {
    return <ParseView result={data} />;
  } else if (selected == 2) {
    return <JSView result={data} />;
  } */

  return null;
});

// let ParseView: React.FC<{ result: TranslateResult }> = ({ result }) => {
//   if (is_err(result.tree)) {
//     return <TranslateErrorView result={result} />;
//   }

//   let depth = (node: SyntaxNode): number => (node.parent ? 1 + depth(node.parent) : 0);

//   let output = "";
//   let cursor = result.tree.value.cursor();
//   do {
//     let sub_input = result.contents.slice(cursor.from, cursor.to);
//     if (sub_input.length > 30) {
//       sub_input = sub_input.slice(0, 12) + "..." + sub_input.slice(-12);
//     }
//     output += indentString(`${cursor.name}: "${sub_input}"`, 2 * depth(cursor.node)) + "\n";
//   } while (cursor.next());

//   return <pre>{output}</pre>;
// };

// let JSView: React.FC<{ result: TranslateResult }> = ({ result }) => {
//   let translation = result.translation;
//   let ref = useRef<HTMLDivElement>(null);
//   let [editor, set_editor] = useState<EditorView | null>(null);

//   useEffect(() => {
//     if (!translation || is_err(translation)) {
//       return;
//     }

//     if (!editor) {
//       editor = new EditorView({
//         state: EditorState.create({ doc: "", extensions: [basicSetup, javascript(), theme] }),
//         parent: ref.current!,
//       });
//       set_editor(editor);
//     }

//     let js = translation.value.js;
//     try {
//       js = prettier.format(js, { parser: "babel", plugins: [parserBabel] });
//     } catch (e) {
//       console.error(e);
//     }

//     editor.dispatch({
//       changes: { from: 0, to: editor.state.doc.toString().length, insert: js },
//     });
//   }, [result]);

//   return (
//     <>
//       {!translation || is_err(translation) ? <TranslateErrorView result={result} /> : null}
//       <div ref={ref} />
//     </>
//   );
// };

let prelude = { "@wcrichto/nota": nota, react: { React } };
let nota_require = (path: string) => {
  if (!(path in prelude)) {
    throw `Cannot import ${path}`;
  }
  return prelude[path];
};

let execute = (result: TranslationResult): Result<JSX.Element, JSX.Element> => {
  if (is_err(result)) {
    return err(
      <>
        {result.value.errors.map(msg => (
          <div>{msg.text}</div>
        ))}
      </>
    );
  }

  let Doc;
  try {
    let f = new Function("require", result.value + `\n; return document.default;`);
    Doc = f(nota_require);
  } catch (e: any) {
    console.error(e);
    return err(<>{e.toString()}</>);
  }

  return ok(Doc);
};

let OutputView: React.FC<{ result: TranslationResult }> = observer(({ result }) => {
  let last_translation = useLocalObservable(() => ({
    t: null,
  }));

  let Doc = execute(result);

  let OnSuccess = action(() => {
    let doc = unwrap(Doc);
    if (doc != last_translation.t) {
      last_translation.t = doc;
    }
    return null;
  });

  let fallback = err => (
    <>
      <ErrorView>{err}</ErrorView>
      {last_translation.t}
    </>
  );

  return (
    <ErrorBoundary resetKeys={[result]} FallbackComponent={({ error }) => fallback(error.message)}>
      {is_ok(Doc) ? (
        <>
          {Doc.value}
          <OnSuccess />
        </>
      ) : (
        fallback(Doc.value)
      )}
    </ErrorBoundary>
  );
});
