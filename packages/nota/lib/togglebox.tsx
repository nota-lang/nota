import React, { useState, useRef, useEffect, useContext } from "react";
import { useStateOnInterval } from "./utils";
import classNames from "classnames";
import { action, makeAutoObservable, makeObservable, observable } from "mobx";
import { observer } from "mobx-react";

type ToggleCallback = (_show: boolean) => void;

class ToggleGroupState {
  toggles: ToggleCallback[] = [];
  all_on: boolean = false;

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
  let on_click = action(() => {
    ctx.all_on = !ctx.all_on;
    ctx.toggles.forEach(cb => cb(ctx.all_on));
  });
  return <ToggleButton on={ctx.all_on} onClick={on_click} big={big} />;
});

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
  let outside_ref = useRef<HTMLDivElement>(null);
  let inside_ref = useRef<HTMLDivElement>(null);
  let [show_inside, set_show_inside] = useState(false);
  let ctx = useContext(ToggleGroupContext);

  if (ctx) {
    useEffect(() => {
      ctx!.toggles.push(set_show_inside);
    }, [ctx]);
  }

  let style = useStateOnInterval({}, 1000, () => {
    if (resize || !outside_ref.current || !inside_ref.current) {
      return {};
    }

    let get_dims = (ref: React.RefObject<HTMLDivElement>) => ref.current!.getBoundingClientRect();
    let outside_dims = get_dims(outside_ref);
    let inside_dims = get_dims(inside_ref);
    return {
      width: Math.max(outside_dims.width, inside_dims.width),
      height: Math.max(outside_dims.height, inside_dims.height),
    };
  });

  let inner_style = (show: boolean): any =>
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
          <div ref={outside_ref} style={inner_style(!show_inside)}>
            <Out />
          </div>
          <div ref={inside_ref} style={inner_style(show_inside)}>
            <In />
          </div>
        </div>
      </div>
      <ToggleButton on={show_inside} onClick={() => set_show_inside(!show_inside)} />
    </div>
  );
};
