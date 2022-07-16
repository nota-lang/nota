import { default as classNames } from "classnames";
import { action, makeAutoObservable } from "mobx";
import { observer } from "mobx-react";
import React, { useContext, useEffect, useRef, useState } from "react";

import { useStateOnInterval } from "./utils.js";

type ToggleCallback = (show: boolean) => void;

class ToggleGroupState {
  toggles: ToggleCallback[] = [];
  allOn: boolean = false;

  constructor() {
    makeAutoObservable(this);
  }
}

let ToggleGroupContext = React.createContext<ToggleGroupState | null>(null);

export let ToggleGroup: React.FC = ({ children }) => {
  let state = new ToggleGroupState();
  return <ToggleGroupContext.Provider value={state}>{children}</ToggleGroupContext.Provider>;
};

export let ToggleGroupButton: React.FC<{ big?: boolean }> = observer(({ big }) => {
  let ctx = useContext(ToggleGroupContext)!;
  let onClick = action(() => {
    ctx.allOn = !ctx.allOn;
    ctx.toggles.forEach(cb => cb(ctx.allOn));
  });
  return <ToggleButton on={ctx.allOn} onClick={onClick} big={big} />;
});
ToggleGroupButton.displayName = "ToggleGroupButton";

export let ToggleButton: React.FC<{
  on: boolean;
  onClick: () => void;
  big?: boolean;
}> = ({ on, big, onClick }) => (
  <span className={classNames("toggle-button", { big })} onClick={onClick}>
    {on ? "A" : "∑"}
  </span>
);

interface ToggleboxProps {
  In: React.FC;
  Out: React.FC;
  resize?: boolean;
}

export let Togglebox: React.FC<ToggleboxProps> = ({ In, Out, resize }) => {
  let outsideRef = useRef<HTMLDivElement>(null);
  let insideRef = useRef<HTMLDivElement>(null);
  let [showInside, setShowInside] = useState(false);
  let ctx = useContext(ToggleGroupContext);

  if (ctx) {
    useEffect(() => {
      ctx!.toggles.push(setShowInside);
    }, [ctx]);
  }

  let style = useStateOnInterval({}, 1000, () => {
    if (resize || !outsideRef.current || !insideRef.current) {
      return {};
    }

    let getDims = (ref: React.RefObject<HTMLDivElement>) => ref.current!.getBoundingClientRect();
    let outsideDims = getDims(outsideRef);
    let insideDims = getDims(insideRef);
    return {
      width: Math.max(outsideDims.width, insideDims.width),
      height: Math.max(outsideDims.height, insideDims.height),
    };
  });

  let innerStyle = (show: boolean): any =>
    !show
      ? {
          visibility: "hidden",
          position: "absolute",
        }
      : {};

  return (
    <div className="togglebox-grandparent">
      <div className="togglebox-parent">
        <div className="togglebox" style={style}>
          <div ref={outsideRef} style={innerStyle(!showInside)}>
            <Out />
          </div>
          <div ref={insideRef} style={innerStyle(showInside)}>
            <In />
          </div>
        </div>
      </div>
      <ToggleButton on={showInside} onClick={() => setShowInside(!showInside)} />
    </div>
  );
};
