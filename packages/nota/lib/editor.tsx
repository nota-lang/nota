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
import { isOk } from "@nota-lang/nota-common/dist/result";
import classNames from "classnames";

import "../static/index.html";
import "../static/favicon.ico";
import "../css/editor.scss";

export class ViewerState {
  selected: number = 0;

  constructor() {
    makeAutoObservable(this);
  }
}

export let ViewerStateContext = React.createContext<ViewerState | null>(null);

export let ViewerConfig = observer(() => {
  let viewerState = useContext(ViewerStateContext)!;
  let options = ["Output", "Generated JS", "Parse tree"];
  return (
    <div className="viewer-config">
      <div>
        {options.map((key, i) => (
          <button
            key={key}
            onClick={action(() => {
              viewerState.selected = i;
            })}
            className={classNames({ active: viewerState.selected == i })}
          >
            {key}
          </button>
        ))}
      </div>
    </div>
  );
});

export let Viewer = observer(() => {
  let viewerState = useContext(ViewerStateContext)!;
  let state = useContext(StateContext)!;
  let ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let el = ref.current;
    if (!el) {
      return;
    }

    let lastScroll = 0;
    el.addEventListener("scroll", _ => {
      let scroll = el!.scrollTop;
      let t = state.translation;
      if (isOk(t) && scroll > 0) {
        lastScroll = scroll;
      }
    });

    reaction(
      () => [state.translation],
      () => {
        if (el!.scrollTop == 0) {
          el!.scrollTo(0, lastScroll);
        }
      }
    );
  }, [ref]);

  return (
    <div className="viewer" ref={ref}>
      <Inner selected={viewerState.selected} />
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
  let [viewerState] = useState(() => new ViewerState());
  let [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    let f = (event: KeyboardEvent) => {
      if (event.altKey && event.code == "KeyF") {
        setFullscreen(!fullscreen);
        event.preventDefault();
        event.stopPropagation();
      }
    };
    document.addEventListener("keypress", f);
    return () => document.removeEventListener("keypress", f);
  });

  let separator = (
    <div className="separator">
      <button onClick={() => setFullscreen(!fullscreen)}>{fullscreen ? ">" : "<"}</button>
    </div>
  );

  return (
    <div>
      {!state.ready ? (
        <>Loading...</>
      ) : (
        <StateContext.Provider value={state}>
          <ViewerStateContext.Provider value={viewerState}>
            <div className="header">
              <h1>Nota Editor</h1>
              <ViewerConfig />
            </div>
            <div className={classNames("panels", { fullscreen })}>
              <Editor />
              {separator}
              <Viewer />
            </div>
          </ViewerStateContext.Provider>
        </StateContext.Provider>
      )}
    </div>
  );
});

ReactDOM.render(<App />, document.getElementById("container"));
