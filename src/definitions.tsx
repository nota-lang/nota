import React, { useState, useContext, useEffect, forwardRef } from "react";
import _ from "lodash";
import { usePopper } from "react-popper";
import classNames from "classnames";
import { autorun, makeObservable, observable, action, runInAction } from "mobx";
import { observer, useLocalObservable } from "mobx-react";

import { ToplevelElem } from "./document";
import { AdaptiveDisplay, HTMLAttributes } from "./utils";

export interface DefinitionData {
  Tooltip: React.FC | null;
  Label: React.FC | null;
}

export class AllDefinitionData {
  @observable defs: { [name: string]: DefinitionData } = {};
  @observable def_mode: boolean = false;
  // @observable second_pass: boolean = false;

  constructor() {
    makeObservable(this);
  }

  get_definition = (name: string): DefinitionData | undefined =>
    this.defs[name];

  add_definition = action((name: string, def: DefinitionData) => {
    if (!(name in this.defs)) {
      this.defs[name] = def;
    }
  });

  add_mode_listeners() {
    let on_keydown = action(({ key }: KeyboardEvent) => {
      if (key === "Alt") {
        this.def_mode = true;
      }
    });

    let on_keyup = action(({ key }: KeyboardEvent) => {
      if (key == "Alt") {
        this.def_mode = false;
      }
    });

    useEffect(() => {
      window.addEventListener("keydown", on_keydown);
      window.addEventListener("keyup", on_keyup);
      return () => {
        window.removeEventListener("keydown", on_keydown);
        window.removeEventListener("keyup", on_keyup);
      };
    }, []);
  }
}

export let DefinitionContext = React.createContext<AllDefinitionData>(
  new AllDefinitionData()
);

interface DefinitionProps {
  name?: string;
  block?: boolean;
  Tooltip?: React.FC | null;
  Label?: React.FC;
}

export let DefinitionAnchor: React.FC<{ name: string; block?: boolean }> = (
  props
) => (
  <AdaptiveDisplay block={props.block} id={`def-${props.name}`}>
    {props.children}
  </AdaptiveDisplay>
);

export let Definition: React.FC<DefinitionProps> = (props) => {
  let ctx = useContext(DefinitionContext);
  let [name] = useState(props.name || _.uniqueId("def-"));

  useEffect(() => {
    let Tooltip =
      typeof props.Tooltip !== "undefined"
        ? props.Tooltip
        : () => <>{props.children}</>;
    let Label = props.Label || null;
    ctx.add_definition(name, { Tooltip, Label });
  }, []);

  return (
    <DefinitionAnchor block={props.block} name={name}>
      {props.children}
    </DefinitionAnchor>
  );
};

interface RefProps {
  name: string;
  block?: boolean;
  nolink?: boolean;
}

// https://stackoverflow.com/questions/5353934/check-if-element-is-visible-on-screen
function checkVisible(elm: any): boolean {
  var rect = elm.getBoundingClientRect();
  var viewHeight = Math.max(
    document.documentElement.clientHeight,
    window.innerHeight
  );
  return !(rect.bottom < 0 || rect.top - viewHeight >= 0);
}

interface TooltipProps {
  Inner: React.FC<HTMLAttributes & { ref: any }>;
  Popup: React.FC;
}

let Tooltip = ({ Inner, Popup }: TooltipProps) => {
  const [referenceElement, setReferenceElement] = useState(null);
  const [popperElement, setPopperElement] = useState(null);
  const { styles, attributes } = usePopper(referenceElement, popperElement, {
    placement: "top",
    modifiers: [{ name: "offset", options: { offset: [0, 10] } }],
  });
  let [init, set_init] = useState(false);
  let [show, set_show] = useState(false);

  let on_click = () => {
    if (!init) {
      set_init(true);
    }
    set_show(!show);
  };

  return (
    <>
      <Inner ref={setReferenceElement} onClick={on_click} />

      {init ? (
        <ToplevelElem>
          <div
            className="tooltip"
            ref={setPopperElement as any}
            style={{ ...styles.popper, display: show ? "block" : "none" }}
            {...attributes.popper}
          >
            <Popup />
          </div>
        </ToplevelElem>
      ) : null}
    </>
  );
};

export let Ref: React.FC<RefProps> = observer((props) => {
  let ctx = useContext(DefinitionContext);
  let def = ctx.get_definition(props.name);
  if (!def) {
    return <span className="error">{props.name}</span>;
  }

  let on_click: React.MouseEventHandler = (e) => {
    e.preventDefault();
    e.stopPropagation();

    let anchor_id = `def-${props.name}`;
    let anchor_elem = document.getElementById(anchor_id)!;
    let anchor_hash = "#" + anchor_id;

    if (window.location.hash == anchor_hash) {
      // TODO: figure out how to make :target re-trigger in this instance
    }

    window.history.pushState(null, "", anchor_hash);

    // Hack to trigger :target
    // See: https://github.com/whatwg/html/issues/639
    window.history.pushState(null, "", "#" + anchor_hash);
    window.history.back();

    // Don't scroll if element is visible
    // See: https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom
    if (checkVisible(anchor_elem)) {
      return;
    }

    // Effect doesn't seem to trigger immediately after history.back()?
    // TODO: bad workaround
    setTimeout(() => {
      let block: ScrollLogicalPosition =
        anchor_elem!.offsetHeight > window.innerHeight ? "start" : "center";
      anchor_elem!.scrollIntoView({
        // behavior: "smooth",
        block,
        inline: "center",
      });
    }, 100);
  };

  let inner: JSX.Element = props.children ? (
    <>{props.children}</>
  ) : def.Label ? (
    <def.Label />
  ) : (
    <span className="error">No children or label for "{props.name}"</span>
  );

  let Inner = forwardRef<HTMLDivElement>((inner_props, ref) => (
    <AdaptiveDisplay
      ref={ref}
      block={props.block}
      className={classNames("ref", {
        nolink: props.nolink,
      })}
      {...inner_props}
      onDoubleClick={on_click}
    >
      {inner}
    </AdaptiveDisplay>
  ));

  if (def.Tooltip) {
    return <Tooltip Inner={Inner} Popup={def.Tooltip} />;
  } else {
    return <Inner />;
  }
});
