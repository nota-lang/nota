import React, { useState, useRef, useEffect, useCallback, forwardRef, CSSProperties } from "react";
import { useSynchronizer, useStateOnInterval } from "./utils";
import classNames from "classnames";


interface ToggleboxProps {
  Inside: React.FC;
  Outside: React.FC;
  resize?: boolean;
  registerToggle?: (toggle: (show: boolean) => void) => void;
}

export let ToggleButton: React.FC<{ on: boolean; onClick: () => void; big?: boolean }> = ({
  on,
  big,
  onClick,
}) => (
  <span className={classNames("toggle-button", { big })} onClick={onClick}>
    {on ? "A" : "∑"}
  </span>
);

export let Togglebox: React.FC<ToggleboxProps> = ({ Inside, Outside, resize, registerToggle }) => {
  let outside_ref = useRef<HTMLDivElement>(null);
  let inside_ref = useRef<HTMLDivElement>(null);
  let [show_inside, set_show_inside] = useState(false);

  if (registerToggle) {
    useEffect(() => {
      registerToggle((show: boolean) => set_show_inside(show));
    }, []);
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
            <Outside />
          </div>
          <div ref={inside_ref} style={inner_style(show_inside)}>
            <Inside />
          </div>
        </div>
      </div>
      <ToggleButton on={show_inside} onClick={() => set_show_inside(!show_inside)} />
    </div>
  );
};
