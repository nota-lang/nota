import React, { useState, useContext, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { observer } from "mobx-react";
import { makeAutoObservable, action, reaction } from "mobx";
import {
  JsView,
  OutputView,
  ParseView,
  Editor,
  StateContext,
  RemoteState,
} from "@nota-lang/nota-editor";
import { is_ok } from "@nota-lang/nota-common";
import classNames from "classnames";

import "../static/index.html";

import "katex/dist/katex.min.css";
import "@nota-lang/nota-components/dist/nota-components.css";
import "@nota-lang/nota-theme-acm/dist/nota-theme-acm.css";
import "@nota-lang/nota-editor/dist/nota-editor.css";
import "../css/editor.scss";

export class ViewerState {
  selected: number = 0;

  constructor() {
    makeAutoObservable(this);
  }
}

export let ViewerStateContext = React.createContext<ViewerState | null>(null);

export let ViewerConfig = observer(() => {
  let viewer_state = useContext(ViewerStateContext)!;
  let options = ["Output", "Generated JS", "Parse tree"];
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

let Inner: React.FC<{ selected: number }> = observer(({ selected }) => {
  let state = useContext(StateContext)!;
  let data = state.translation;

  if (selected == 0) {
    return <OutputView result={data} />;
  } else if (selected == 1) {
    return <JsView result={data} />;
  } else if (selected == 2) {
    return <ParseView />;
  }

  return null;
});

let App = observer(() => {
  let [state] = useState(() => new RemoteState());
  let [viewer_state] = useState(() => new ViewerState());
  return (
    <div>
      {!state.ready ? (
        <>Loading...</>
      ) : (
        <StateContext.Provider value={state}>
          <ViewerStateContext.Provider value={viewer_state}>
            <div className="header">
              <h1>Nota Editor</h1>
              <ViewerConfig />
            </div>
            <div className="panels">
              <Editor />
              <Viewer />
            </div>
          </ViewerStateContext.Provider>
        </StateContext.Provider>
      )}
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById("container"));
