import React, { useContext, useState } from "react";
import { StateContext } from "./state";
import { observer } from "mobx-react";
import { parser, translate } from "@wcrichto/nota-syntax";
import * as nota from "@wcrichto/nota";
import indentString from "indent-string";
import classNames from "classnames";
import { ErrorBoundary } from "react-error-boundary";

export let Viewer = () => {
  let [selected, set_selected] = useState(0);
  let options = [
    ["Output", OutputViewer],
    ["Parse tree", TreeViewer],
    ["Generated JS", JSViewer],
  ];
  let El = options[selected][1];
  return (
    <div>
      <div>
        {options.map(([key], i) => (
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
        <El />
      </div>
    </div>
  );
};

export let TreeViewer = observer(() => {
  let state = useContext(StateContext);
  let tree = parser.parse(state.contents);

  function depth(node) {
    return node.parent ? 1 + depth(node.parent) : 0;
  }

  let output = "";
  let cursor = tree.cursor();
  do {
    let sub_input = state.contents.slice(cursor.from, cursor.to);
    if (sub_input.length > 30) {
      sub_input = sub_input.slice(0, 12) + "..." + sub_input.slice(-12);
    }
    output += indentString(`${cursor.name}: "${sub_input}"`, 2 * depth(cursor.node)) + "\n";
  } while (cursor.next());

  return <pre>{output}</pre>;
});

export let JSViewer = observer(() => {
  let state = useContext(StateContext);
  let tree = parser.parse(state.contents);
  let js;
  try {
    js = translate(state.contents, tree);
  } catch (e) {
    console.error(e);
    return <pre>{e.toString()}</pre>;
  }

  return <pre>{js}</pre>;
});

export let OutputViewer = observer(() => {
  let state = useContext(StateContext);

  let tree = parser.parse(state.contents);
  let Generated;
  try {
    let js = translate(state.contents, tree);
    let f = new Function(`return(${js})`);
    let imports = { React, ...nota };
    Generated  = () => f()(imports);
  } catch (e) {
    console.error(e);
    return <div>{e.toString()}</div>;
  }


  return (
    <div>
      <ErrorBoundary FallbackComponent={({ error }) => <pre>{error.message}</pre>}>
        <Generated />
      </ErrorBoundary>
    </div>
  );
});
