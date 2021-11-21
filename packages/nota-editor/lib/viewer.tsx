import React, { useContext, useState, useEffect } from "react";
import type { Tree, SyntaxNode } from "@lezer/common";
import { StateContext } from "./state";
import { observer } from "mobx-react";
import * as nota_syntax from "@wcrichto/nota-syntax";
import * as nota from "@wcrichto/nota";
import indentString from "indent-string";
import classNames from "classnames";
import { ErrorBoundary } from "react-error-boundary";
import parserBabel from "prettier/parser-babel";
import prettier from "prettier/standalone";
import axios from "axios";
import _ from "lodash";

export let Viewer = () => {
  let [selected, set_selected] = useState(0);
  let options = ["Output", "Parse tree", "Generated JS"];

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
      <div className="viewer">
        <Inner selected={selected} />
      </div>
    </div>
  );
};

let Error: React.FC = ({ children }) => <pre className="error">{children}</pre>;

interface Ok<T> {
  type: "Ok";
  value: T;
}

interface Err<E> {
  type: "Err";
  value: E;
}

let ok = <T,>(value: T): Ok<T> => ({ type: "Ok", value });
let err = <E,>(value: E): Err<E> => ({ type: "Err", value });
// let is_ok = <T, E>(result: Result<T, E>): result is Ok<T> => result.type == "Ok";
let is_err = <T, E>(result: Result<T, E>): result is Err<E> => result.type == "Err";

type Result<T, E = Error> = Ok<T> | Err<E>;

interface TranslateResult {
  contents: string;
  tree: Result<Tree>;
  translation?: Result<nota_syntax.Translation>;
  imports?: Result<{ [path: string]: string }>;
  Element?: Result<React.FC>;
}

let TranslateErrorView: React.FC<{ result: TranslateResult }> = ({ result }) => {
  let err;
  if (is_err(result.tree)) {
    err = result.tree.value;
  } else if (is_err(result.translation!)) {
    err = result.translation.value;
  } else if (is_err(result.imports!)) {
    err = result.imports.value;
  } else if (is_err(result.Element!)) {
    err = result.Element.value;
  } else {
    throw `No error`;
  }

  return <Error>{err.toString()}</Error>;
};

let parser = nota_syntax.parser.configure({ strict: true });

let translate = async (contents: string): Promise<TranslateResult> => {
  let result: TranslateResult;

  try {
    result = { contents, tree: ok(parser.parse(contents)) };
  } catch (e: any) {
    result = { contents, tree: err(e) };
    return result;
  }

  try {
    result.translation = ok(nota_syntax.translate(contents, result.tree.value as Tree));
  } catch (e: any) {
    console.error(e);
    result.translation = err(e);
    return result;
  }

  try {
    result.imports = ok(
      _.fromPairs(
        await Promise.all(
          Array.from(result.translation.value.imports).map(async path => {
            let response = await axios.get(path);
            return [path, response.data];
          })
        )
      )
    );
  } catch (e: any) {
    console.error(e);
    result.imports = err(e);
    return result;
  }

  try {
    let f: () => nota_syntax.TranslatedFunction = new Function(
      `return(${result.translation.value.js})`
    ) as any;
    let symbols = { React, ...nota };
    result.Element = ok(() => f()(symbols, result.imports!.value));
  } catch (e: any) {
    console.error(e);
    result.Element = err(e);
    return result;
  }

  return result;
};

let Inner: React.FC<{ selected: number }> = observer(({ selected }) => {
  let state = useContext(StateContext);
  let [data, set_data] = useState<TranslateResult | null>(null);
  useEffect(() => {
    translate(state.contents).then(set_data);
  }, [state.contents]);

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
  if (!translation || is_err(translation)) {
    return <TranslateErrorView result={result} />;
  }

  let js = translation.value.js;
  try {
    js = prettier.format(js, { parser: "babel", plugins: [parserBabel] });
  } catch (e) {
    console.error(e);
  }
  return <pre>{js}</pre>;
};

let OutputView: React.FC<{ result: TranslateResult }> = ({ result }) => {
  let Element = result.Element;
  if (!Element || is_err(Element)) {
    return <TranslateErrorView result={result} />;
  }

  return (
    <ErrorBoundary FallbackComponent={({ error }) => <Error>{error.message}</Error>}>
      <Element.value />
    </ErrorBoundary>
  );
};
