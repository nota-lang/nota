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

type Result<T, E = Error> = Ok<T> | Err<E>;

interface TranslateResult {
  contents: string;
  tree: Tree;
  translation: Result<nota_syntax.Translation>;
  imports?: Result<{ [path: string]: string }>;
  Element?: Result<React.FC>;
}
let translate = async (contents: string): Promise<TranslateResult> => {
  let tree = nota_syntax.parser.parse(contents);

  let translation;
  try {
    translation = nota_syntax.translate(contents, tree);
  } catch (e: any) {
    console.error(e);
    return { contents, tree, translation: err(e) };
  }

  let imports: { [path: string]: string };
  try {
    imports = _.fromPairs(
      await Promise.all(
        Array.from(translation.imports).map(async path => {
          let response = await axios.get(path);
          return [path, response.data];
        })
      )
    );
  } catch (e: any) {
    console.error(e);
    return { contents, tree, translation: ok(translation), imports: err(e) };
  }

  let Element;
  try {
    let f: () => nota_syntax.TranslatedFunction = new Function(`return(${translation.js})`) as any;
    let symbols = { React, ...nota };
    Element = () => f()(symbols, imports);
  } catch (e: any) {
    console.error(e);
    return { contents, tree, translation: ok(translation), imports: ok(imports), Element: err(e) };
  }

  return {
    contents,
    tree,
    translation: ok(translation),
    imports: ok(imports),
    Element: ok(Element),
  };
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

let ParseView: React.FC<{ result: TranslateResult }> = ({ result: { tree, contents } }) => {
  let depth = (node: SyntaxNode): number => (node.parent ? 1 + depth(node.parent) : 0);

  let output = "";
  let cursor = tree.cursor();
  do {
    let sub_input = contents.slice(cursor.from, cursor.to);
    if (sub_input.length > 30) {
      sub_input = sub_input.slice(0, 12) + "..." + sub_input.slice(-12);
    }
    output += indentString(`${cursor.name}: "${sub_input}"`, 2 * depth(cursor.node)) + "\n";
  } while (cursor.next());

  return <pre>{output}</pre>;
};

let JSView: React.FC<{result: TranslateResult}> = ({ result: {translation} }) => {
  if (!translation) {
    return <Error>Did not reach this stage</Error>;
  }

  if (translation.type == "Ok") {
    let js = translation.value.js;
    try {
      js = prettier.format(js, { parser: "babel", plugins: [parserBabel] });
    } catch (e) {
      console.error(e);
    }
    return <pre>{js}</pre>;
  } else {
    return <Error>{translation.value.toString()}</Error>;
  }
};

let OutputView: React.FC<{result: TranslateResult}> = ({ result: {Element} }) => {
  if (!Element) {
    return <Error>Did not reach this stage</Error>;
  }

  if (Element.type == "Ok") {
    return (
      <ErrorBoundary FallbackComponent={({ error }) => <Error>{error.message}</Error>}>
        <Element.value />
      </ErrorBoundary>
    );
  } else {
    return <Error>{Element.value.toString()}</Error>;
  }
};
