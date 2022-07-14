import { isOk } from "@nota-lang/nota-common/dist/result.js";
import {
  Editor,
  JsView,
  OutputView,
  ParseView,
  RemoteState,
  StateContext,
} from "@nota-lang/nota-editor";
import classNames from "classnames";
import { action, makeAutoObservable, reaction } from "mobx";
import { observer } from "mobx-react";
import React, { useContext, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom";

import "../css/editor.scss";
import "../static/favicon.ico";
import "../static/index.html";

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

    const storageKey = "__nota_viewer_scroll_position";
    let storedScroll = localStorage.getItem(storageKey);
    let lastScroll = storedScroll ? parseInt(storedScroll) : 0;
    let setScroll = (scroll: number) => {
      localStorage.setItem(storageKey, scroll.toString());
      lastScroll = scroll;
    };
    el.addEventListener("scroll", _ => {
      let scroll = el!.scrollTop;
      if (state.rendered && isOk(state.translation) && scroll > 0) {
        setScroll(scroll);
      }
    });

    reaction(
      () => [state.rendered],
      rendered => {
        if (rendered) {
          el!.scrollTo(0, lastScroll);
        }
      },
      { fireImmediately: true }
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
